/** Shared types crossing the IPC boundary. Everything here must be structured-cloneable. */

/** Common run options shared by every workflow (TDD §6). */
export interface CommonRunOptions {
  /** Resolved from settings by main when absent. */
  workdir?: string;
  scriptdirs?: string[];
  /** Resolved to the per-run folder by main when absent. */
  outdir?: string;
  solveMs?: number;
  threads?: number;
  seed?: number;
  /** Appended verbatim after generated flags. */
  extraArgs?: string;
}

/**
 * M0 carries only the verify workflow (replay + flags, no --solve);
 * M1/M2 add the remaining kinds per TDD §6.
 */
export type RunSpec = { kind: 'verify'; replay: string; common: CommonRunOptions };

export type RunStatus = 'running' | 'finished' | 'failed' | 'stopped';

export interface RunStatusUpdate {
  status: RunStatus;
  exitCode: number | null;
  /** Human-readable failure hint (usage error vs load/health failure). */
  message?: string;
}

export interface RunEvent {
  runId: string;
  logBatch?: string[];
  statusUpdate?: RunStatusUpdate;
}

export interface StartResult {
  runId: string;
  argv: string[];
  display: string;
  logPath: string;
  outdir: string;
}
