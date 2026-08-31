import type {
  RunEvent,
  RunPreview,
  RunRecord,
  RunSpec,
  RunSummary,
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
  historyList: 'history:list',
  historyGet: 'history:get',
  resultsOpen: 'results:open',
  dialogPickFile: 'dialog:pickFile',
  dialogPickDirectory: 'dialog:pickDirectory',
} as const;

export type FilePickerKind = 'replay' | 'ydk' | 'solver';

export type ResultAction = 'edopro' | 'reveal';

export interface ResultOpenRequest {
  runId: string;
  /** Artifact file name within the run's outdir, or 'log' for log.txt. */
  file: string;
  action: ResultAction;
}

/** The api exposed on window.api by the preload bridge. */
export interface RendererApi {
  getSettings(): Promise<Settings>;
  setSettings(settings: Settings): Promise<Settings>;
  probeWorkdir(path: string): Promise<WorkdirHealth>;
  previewRun(spec: RunSpec): Promise<RunPreview>;
  startRun(spec: RunSpec): Promise<StartResult>;
  stopRun(runId: string): Promise<void>;
  listHistory(): Promise<RunSummary[]>;
  getRun(runId: string): Promise<RunRecord | null>;
  openResult(request: ResultOpenRequest): Promise<{ ok: boolean; error?: string }>;
  pickFile(kind: FilePickerKind): Promise<string | null>;
  pickDirectory(): Promise<string | null>;
  onRunEvent(cb: (event: RunEvent) => void): () => void;
}
