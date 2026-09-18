import { createWriteStream, mkdirSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import path from 'node:path';
import type {
  RunArtifact,
  RunEvent,
  RunRecord,
  RunSpec,
  RunStatus,
  StartResult,
} from '../../shared/types';
import { buildArgv, displayCommand } from './argv';
import { SolverOutputParser } from './parser';
import { scanOutdir } from './results';
import type { RunHandle, SolverRunner } from './runner';

const LOG_FLUSH_MS = 50;
// How long a graceful stop may take before the process is killed outright.
const STOP_GRACE_MS = 10_000;

/** The slice of HistoryStore the run manager needs (kept narrow for tests). */
export interface RunRecorder {
  write(record: RunRecord): void;
  patch(runId: string, changes: Partial<RunRecord>): RunRecord | null;
}

export interface RunManagerDeps {
  /** Called at preview/start time so settings changes (solver path) apply per run. */
  makeRunner: () => SolverRunner;
  /** Root directory for per-run folders (userData/runs). */
  runsDir: string;
  /** Fills spec.common.workdir etc. from settings before serialization. */
  resolveSpec: (spec: RunSpec) => RunSpec;
  emit: (event: RunEvent) => void;
  history: RunRecorder;
  /** Injectable for tests; defaults to the real outdir scanner. */
  scanResults?: (outdir: string) => RunArtifact[];
}

interface ActiveRun {
  runId: string;
  handle: RunHandle;
  status: RunStatus;
  outdir: string;
  parser: SolverOutputParser;
  parserChanged: boolean;
  pendingLines: string[];
  flushTimer: NodeJS.Timeout | null;
  graceTimer: NodeJS.Timeout | null;
  logStream: ReturnType<typeof createWriteStream>;
  stopRequested: boolean;
}

/**
 * Owns the solver subprocess lifecycle (TDD §4): one run at a time,
 * line batching to the renderer every 50 ms, full log on disk, parsed
 * status piggybacked on log batches, and a history record written at
 * start and completed at exit.
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
      outdir: resolved.common.outdir,
      parser: new SolverOutputParser(),
      parserChanged: false,
      pendingLines: [],
      flushTimer: null,
      graceTimer: null,
      logStream: createWriteStream(logPath),
      stopRequested: false,
    };
    this.active = run;
    // A failed log write (disk full, folder removed) must not take down the run.
    run.logStream.on('error', (error) => console.error('log write failed:', error.message));
    run.logStream.write(`$ ${display}\n`);

    this.deps.history.write({
      version: 1,
      runId,
      spec: resolved,
      argv,
      display,
      solver: runner.describe(),
      startedAt: new Date().toISOString(),
      logPath,
      outdir: run.outdir,
    });

    run.handle.onLine((_stream, line) => {
      run.logStream.write(line + '\n');
      // @event lines feed the parser but stay out of the visible log; the
      // full stream, events included, is always in log.txt.
      if (!line.startsWith('@event ')) run.pendingLines.push(line);
      if (run.parser.feed(line)) run.parserChanged = true;
      run.flushTimer ??= setTimeout(() => this.flushLines(run), LOG_FLUSH_MS);
    });
    run.handle.onExit((code) => this.onExit(run, code));

    return { runId, argv, display, logPath, outdir: run.outdir };
  }

  stop(runId: string): void {
    const run = this.active;
    if (run === null || run.runId !== runId || run.status !== 'running') return;
    run.stopRequested = true;
    // Graceful first: the solver finishes the run and writes what it found.
    // A solver that doesn't answer within the grace window is killed.
    run.handle.stop();
    run.graceTimer ??= setTimeout(() => run.handle.kill(), STOP_GRACE_MS);
  }

  private flushLines(run: ActiveRun): void {
    if (run.flushTimer !== null) {
      clearTimeout(run.flushTimer);
      run.flushTimer = null;
    }
    if (run.pendingLines.length === 0 && !run.parserChanged) return;
    const event: RunEvent = { runId: run.runId };
    if (run.pendingLines.length > 0) {
      event.logBatch = run.pendingLines;
      run.pendingLines = [];
    }
    if (run.parserChanged) {
      event.parsed = run.parser.snapshot();
      run.parserChanged = false;
    }
    this.deps.emit(event);
  }

  private onExit(run: ActiveRun, code: number | null): void {
    if (run.graceTimer !== null) {
      clearTimeout(run.graceTimer);
      run.graceTimer = null;
    }
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

    const artifacts = (this.deps.scanResults ?? scanOutdir)(run.outdir);
    this.deps.history.patch(run.runId, {
      endedAt: new Date().toISOString(),
      outcome: run.status,
      exitCode: code,
      status: run.parser.snapshot(),
      artifacts,
    });

    this.deps.emit({
      runId: run.runId,
      statusUpdate: { status: run.status, exitCode: code, message },
      parsed: run.parser.snapshot(),
    });
    this.active = null;
  }
}
