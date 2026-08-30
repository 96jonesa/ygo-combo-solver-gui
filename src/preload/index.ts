import { contextBridge, ipcRenderer } from 'electron';
import { IpcChannels } from '../shared/ipc';
import type { FilePickerKind, RendererApi } from '../shared/ipc';
import type { RunEvent, RunSpec, Settings } from '../shared/types';

const api: RendererApi = {
  getSettings: () => ipcRenderer.invoke(IpcChannels.settingsGet),
  setSettings: (settings: Settings) => ipcRenderer.invoke(IpcChannels.settingsSet, settings),
  probeWorkdir: (path: string) => ipcRenderer.invoke(IpcChannels.workdirProbe, path),
  previewRun: (spec: RunSpec) => ipcRenderer.invoke(IpcChannels.runPreview, spec),
  startRun: (spec: RunSpec) => ipcRenderer.invoke(IpcChannels.runStart, spec),
  stopRun: (runId: string) => ipcRenderer.invoke(IpcChannels.runStop, runId),
  pickFile: (kind: FilePickerKind) => ipcRenderer.invoke(IpcChannels.dialogPickFile, kind),
  pickDirectory: () => ipcRenderer.invoke(IpcChannels.dialogPickDirectory),
  onRunEvent: (cb: (event: RunEvent) => void) => {
    const listener = (_e: Electron.IpcRendererEvent, event: RunEvent) => cb(event);
    ipcRenderer.on(IpcChannels.runEvent, listener);
    return () => ipcRenderer.removeListener(IpcChannels.runEvent, listener);
  },
};

contextBridge.exposeInMainWorld('api', api);
