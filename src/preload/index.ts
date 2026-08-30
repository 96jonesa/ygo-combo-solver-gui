import { contextBridge } from 'electron';

// The typed RendererApi lands with the IPC layer; until then the bridge
// exposes only a marker so the renderer can assert preload ran.
contextBridge.exposeInMainWorld('api', {});
