import { BrowserWindow, app, dialog, ipcMain, session, shell } from 'electron';
import { existsSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { IpcChannels } from '../shared/ipc';
import type { FilePickerKind, ResultOpenRequest } from '../shared/ipc';
import type { RunSpec, Settings } from '../shared/types';
import { openReplayInEdopro } from './edopro/launcher';
import { candidateWorkdirs, probeWorkdir } from './edopro/probe';
import { NativeRunner } from './solver/native-runner';
import { RunManager } from './solver/run-manager';
import { HistoryStore } from './store/history';
import { SettingsStore } from './store/settings';

const settingsStore = new SettingsStore(app.getPath('userData'));
const historyStore = new HistoryStore(path.join(app.getPath('userData'), 'runs'));

function bundledSolverPath(): string {
  // Packaged builds carry the solver under resources/ (TDD §12); in dev
  // the same tree sits at the project root, and is typically absent on
  // machines without a fetched artifact — settings.solver.nativePath
  // (e.g. scripts/fake-solver.mjs) covers development.
  const root = app.isPackaged ? process.resourcesPath : app.getAppPath();
  return path.join(root, 'resources', 'solver', 'win', 'combosolver.exe');
}

function solverPath(): string {
  return settingsStore.get().solver.nativePath ?? bundledSolverPath();
}

function resolveSpec(spec: RunSpec): RunSpec {
  const settings = settingsStore.get();
  const common = { ...spec.common };
  common.workdir ??= settings.workdir ?? undefined;
  if (common.scriptdirs === undefined && settings.scriptdirs.length > 0)
    common.scriptdirs = settings.scriptdirs;
  common.solveMs ??= settings.defaults.solveMs;
  if (common.threads === undefined && settings.defaults.threads !== null)
    common.threads = settings.defaults.threads;
  return { ...spec, common };
}

function createRunManager(window: BrowserWindow): RunManager {
  return new RunManager({
    makeRunner: () => new NativeRunner(solverPath()),
    runsDir: path.join(app.getPath('userData'), 'runs'),
    resolveSpec,
    emit: (event) => {
      if (!window.isDestroyed()) window.webContents.send(IpcChannels.runEvent, event);
    },
    history: historyStore,
  });
}

const pickerFilters: Record<FilePickerKind, Electron.FileFilter[]> = {
  replay: [{ name: 'EDOPro replays', extensions: ['yrpX', 'yrp1', 'yrp'] }],
  ydk: [{ name: 'Decklists', extensions: ['ydk'] }],
  solver: [{ name: 'Solver', extensions: ['exe', 'mjs', 'cjs', 'js'] }],
};

function registerIpc(window: BrowserWindow): void {
  const runManager = createRunManager(window);

  ipcMain.handle(IpcChannels.settingsGet, () => settingsStore.get());
  ipcMain.handle(IpcChannels.settingsSet, (_e, settings: Settings) => settingsStore.set(settings));
  ipcMain.handle(IpcChannels.workdirProbe, (_e, dir: string) => probeWorkdir(dir));
  ipcMain.handle(IpcChannels.runPreview, (_e, spec: RunSpec) => runManager.preview(spec));
  ipcMain.handle(IpcChannels.runStart, (_e, spec: RunSpec) => runManager.start(spec));
  ipcMain.handle(IpcChannels.runStop, (_e, runId: string) => runManager.stop(runId));
  ipcMain.handle(IpcChannels.historyList, () => historyStore.list());
  ipcMain.handle(IpcChannels.historyGet, (_e, runId: string) => historyStore.get(runId));

  ipcMain.handle(IpcChannels.resultsOpen, (_e, request: ResultOpenRequest) => {
    const record = historyStore.get(request.runId);
    if (record === null) return { ok: false, error: 'run not found' };
    const target =
      request.file === 'log' ? record.logPath : path.join(record.outdir, request.file);
    if (request.action === 'reveal') {
      shell.showItemInFolder(target);
      return { ok: true };
    }
    const workdir = settingsStore.get().workdir;
    if (workdir === null)
      return { ok: false, error: 'set the EDOPro directory in Settings first' };
    return openReplayInEdopro(workdir, target, request.runId);
  });

  ipcMain.handle(IpcChannels.dialogPickFile, async (_e, kind: FilePickerKind) => {
    const result = await dialog.showOpenDialog(window, {
      properties: ['openFile'],
      filters: pickerFilters[kind],
    });
    return result.canceled ? null : (result.filePaths[0] ?? null);
  });
  ipcMain.handle(IpcChannels.dialogPickDirectory, async () => {
    const result = await dialog.showOpenDialog(window, { properties: ['openDirectory'] });
    return result.canceled ? null : (result.filePaths[0] ?? null);
  });
}

function autodetectWorkdir(): void {
  const settings = settingsStore.get();
  if (settings.workdir !== null) return;
  for (const candidate of candidateWorkdirs(process.platform, os.homedir())) {
    if (existsSync(candidate) && probeWorkdir(candidate).ok) {
      settingsStore.set({ ...settings, workdir: candidate });
      return;
    }
  }
}

function createWindow(): void {
  const window = new BrowserWindow({
    width: 1150,
    height: 780,
    webPreferences: {
      preload: path.join(import.meta.dirname, '../preload/index.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  // External links open in the browser, never inside the app.
  window.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url);
    return { action: 'deny' };
  });

  registerIpc(window);

  if (process.env.ELECTRON_RENDERER_URL) {
    void window.loadURL(process.env.ELECTRON_RENDERER_URL);
  } else {
    void window.loadFile(path.join(import.meta.dirname, '../renderer/index.html'));
  }
}

function applyContentSecurityPolicy(): void {
  // Applied only to packaged builds: the dev server needs the inline
  // react-refresh preamble that script-src 'self' would block, while a
  // production bundle contains no inline scripts at all.
  if (!app.isPackaged) return;
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': ["default-src 'self'; style-src 'self' 'unsafe-inline'"],
      },
    });
  });
}

void app.whenReady().then(() => {
  applyContentSecurityPolicy();
  autodetectWorkdir();
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
