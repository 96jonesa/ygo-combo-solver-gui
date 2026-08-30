import { createWriteStream, mkdirSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import path from 'node:path';
import type { RunEvent, RunSpec, RunStatus, StartResult } from '../../shared/types';
import { buildArgv, displayCommand } from './argv';
import type { RunHandle, SolverRunner } from './runner';

const LOG_FLUSH_MS = 50;

export interface RunManagerDeps {
  /** Called at preview/start time so settings changes (solver path) apply per run. */
  makeRunner: () => SolverRunner;
  /** Root directory for per-run folders (userData/runs). */
  runsDir: string;
  /** Fills spec.common.workdir etc. from settings before serialization. */
  resolveSpec: (spec: RunSpec) => RunSpec;
  emit: (event: RunEvent) => void;
}

interface ActiveRun {
  runId: string;
  handle: RunHandle;
  status: RunStatus;
  pendingLines: string[];
  flushTimer: NodeJS.Timeout | null;
  logStream: ReturnType<typeof createWriteStream>;
  stopRequested: boolean;
}

/**
 * Owns the solver subprocess lifecycle (TDD §4): one run at a time,
 * line batching to the renderer every 50 ms, full log on disk.
 */
export class RunManager {
  private active: ActiveRun | null = null;

  constructor(private readonly deps: RunManagerDeps) {}

  get isRunning(): boolean {
    return this.active !== null && this.active.status === 'running';
  }

  preview(spec: RunSpec) {
    const resolved = this.deps.resolveSpec(spec);
    const argv = buildArgv(resolved);
    return { argv, display: displayCommand(this.deps.makeRunner().describe().path, argv) };
  }

  start(spec: RunSpec): StartResult {
    if (this.isRunning) throw new Error('a run is already in progress');

    const runId = `${new Date().toISOString().replaceAll(/[:.]/g, '-')}-${randomBytes(3).toString('hex')}`;
    const runDir = path.join(this.deps.runsDir, runId);
    const outdir = path.join(runDir, 'solutions');
    mkdirSync(outdir, { recursive: true });

    const resolved = this.deps.resolveSpec(spec);
    if (resolved.common.outdir === undefined) resolved.common.outdir = outdir;
    const runner = this.deps.makeRunner();
    const argv = buildArgv(resolved);
    const display = displayCommand(runner.describe().path, argv);
    const logPath = path.join(runDir, 'log.txt');

    const run: ActiveRun = {
      runId,
      handle: runner.start(argv, { cwd: runDir }),
      status: 'running',
      pendingLines: [],
      flushTimer: null,
      logStream: createWriteStream(logPath),
      stopRequested: false,
    };
    this.active = run;
    // A failed log write (disk full, folder removed) must not take down the run.
    run.logStream.on('error', (error) => console.error('log write failed:', error.message));
    run.logStream.write(`$ ${display}\n`);

    run.handle.onLine((_stream, line) => {
      run.logStream.write(line + '\n');
      run.pendingLines.push(line);
      run.flushTimer ??= setTimeout(() => this.flushLines(run), LOG_FLUSH_MS);
    });
    run.handle.onExit((code) => this.onExit(run, code));

    return { runId, argv, display, logPath, outdir: resolved.common.outdir };
  }

  stop(runId: string): void {
    const run = this.active;
    if (run === null || run.runId !== runId || run.status !== 'running') return;
    run.stopRequested = true;
    run.handle.kill();
  }

  private flushLines(run: ActiveRun): void {
    if (run.flushTimer !== null) {
      clearTimeout(run.flushTimer);
      run.flushTimer = null;
    }
    if (run.pendingLines.length === 0) return;
    const logBatch = run.pendingLines;
    run.pendingLines = [];
    this.deps.emit({ runId: run.runId, logBatch });
  }

  private onExit(run: ActiveRun, code: number | null): void {
    this.flushLines(run);
    run.logStream.end();

    // Exit mapping per TDD §4.
    let message: string | undefined;
    if (run.stopRequested) run.status = 'stopped';
    else if (code === 0) run.status = 'finished';
    else {
      run.status = 'failed';
      message =
        code === 2
          ? 'usage error (exit 2) — bad arguments; this is likely a GUI bug, see the log'
          : code === 1
            ? 'load or health failure (exit 1) — see the log'
            : `solver terminated unexpectedly (code ${code ?? 'none'})`;
    }
    this.deps.emit({
      runId: run.runId,
      statusUpdate: { status: run.status, exitCode: code, message },
    });
    this.active = null;
  }
}
