import { contextBridge, ipcRenderer } from 'electron';
import { IpcChannels } from '../shared/ipc';
import type { FilePickerKind, RendererApi, ResultOpenRequest } from '../shared/ipc';
import type { RunEvent, RunSpec, Settings } from '../shared/types';

const api: RendererApi = {
  getSettings: () => ipcRenderer.invoke(IpcChannels.settingsGet),
  setSettings: (settings: Settings) => ipcRenderer.invoke(IpcChannels.settingsSet, settings),
  probeWorkdir: (path: string) => ipcRenderer.invoke(IpcChannels.workdirProbe, path),
  searchCards: (query: string) => ipcRenderer.invoke(IpcChannels.cardsSearch, query),
  cardStatus: () => ipcRenderer.invoke(IpcChannels.cardsStatus),
  onUpdateAvailable: (cb: (info: { latest: string; url: string }) => void) => {
    const listener = (_e: Electron.IpcRendererEvent, info: { latest: string; url: string }) =>
      cb(info);
    ipcRenderer.on(IpcChannels.updateAvailable, listener);
    return () => ipcRenderer.removeListener(IpcChannels.updateAvailable, listener);
  },
  previewRun: (spec: RunSpec) => ipcRenderer.invoke(IpcChannels.runPreview, spec),
  startRun: (spec: RunSpec) => ipcRenderer.invoke(IpcChannels.runStart, spec),
  stopRun: (runId: string) => ipcRenderer.invoke(IpcChannels.runStop, runId),
  listHistory: () => ipcRenderer.invoke(IpcChannels.historyList),
  getRun: (runId: string) => ipcRenderer.invoke(IpcChannels.historyGet, runId),
  openResult: (request: ResultOpenRequest) => ipcRenderer.invoke(IpcChannels.resultsOpen, request),
  pickFile: (kind: FilePickerKind) => ipcRenderer.invoke(IpcChannels.dialogPickFile, kind),
  pickDirectory: () => ipcRenderer.invoke(IpcChannels.dialogPickDirectory),
  onRunEvent: (cb: (event: RunEvent) => void) => {
    const listener = (_e: Electron.IpcRendererEvent, event: RunEvent) => cb(event);
    ipcRenderer.on(IpcChannels.runEvent, listener);
    return () => ipcRenderer.removeListener(IpcChannels.runEvent, listener);
  },
};

contextBridge.exposeInMainWorld('api', api);
