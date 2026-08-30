import type {
  RunEvent,
  RunPreview,
  RunSpec,
  Settings,
  StartResult,
  WorkdirHealth,
} from './types';

export const IpcChannels = {
  settingsGet: 'settings:get',
  settingsSet: 'settings:set',
  workdirProbe: 'workdir:probe',
  runPreview: 'run:preview',
  runStart: 'run:start',
  runStop: 'run:stop',
  runEvent: 'run:event',
  dialogPickFile: 'dialog:pickFile',
  dialogPickDirectory: 'dialog:pickDirectory',
} as const;

export type FilePickerKind = 'replay' | 'ydk' | 'solver';

/** The api exposed on window.api by the preload bridge. */
export interface RendererApi {
  getSettings(): Promise<Settings>;
  setSettings(settings: Settings): Promise<Settings>;
  probeWorkdir(path: string): Promise<WorkdirHealth>;
  previewRun(spec: RunSpec): Promise<RunPreview>;
  startRun(spec: RunSpec): Promise<StartResult>;
  stopRun(runId: string): Promise<void>;
  pickFile(kind: FilePickerKind): Promise<string | null>;
  pickDirectory(): Promise<string | null>;
  onRunEvent(cb: (event: RunEvent) => void): () => void;
}
