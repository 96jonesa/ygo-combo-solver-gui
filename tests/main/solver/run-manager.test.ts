import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RunManager } from '../../../src/main/solver/run-manager';
import type { RunHandle, SolverRunner } from '../../../src/main/solver/runner';
import type { RunEvent, RunSpec } from '../../../src/shared/types';

/** Scripted SolverRunner: the test drives lines and exit by hand. */
class MockRunner implements SolverRunner {
  lineCb: (stream: 'out' | 'err', line: string) => void = () => {};
  exitCb: (code: number | null, signal: string | null) => void = () => {};
  killed = false;
  lastArgv: string[] = [];

  describe() {
    return { kind: 'native' as const, path: 'mock-solver' };
  }

  start(argv: string[]): RunHandle {
    this.lastArgv = argv;
    return {
      onLine: (cb) => (this.lineCb = cb),
      onExit: (cb) => (this.exitCb = cb),
      kill: () => {
        this.killed = true;
      },
    };
  }
}

describe('RunManager', () => {
  let runsDir: string;
  let runner: MockRunner;
  let events: RunEvent[];
  let manager: RunManager;

  const spec: RunSpec = { kind: 'verify', replay: 'duel.yrpX', common: {} };

  beforeEach(() => {
    vi.useFakeTimers();
    runsDir = mkdtempSync(path.join(os.tmpdir(), 'runs-'));
    runner = new MockRunner();
    events = [];
    manager = new RunManager({
      makeRunner: () => runner,
      runsDir,
      resolveSpec: (s) => ({ ...s, common: { ...s.common, workdir: '/edopro' } }),
      emit: (event) => events.push(event),
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    rmSync(runsDir, { recursive: true, force: true });
  });

  describe('start', () => {
    it('serializes the resolved spec with a per-run outdir', () => {
      const started = manager.start(spec);
      expect(runner.lastArgv[0]).toBe('duel.yrpX');
      expect(runner.lastArgv).toContain('--workdir');
      expect(runner.lastArgv).toContain('--outdir');
      expect(started.outdir).toContain(started.runId);
      expect(started.display).toContain('mock-solver');
    });

    it('rejects a second run while one is active', () => {
      manager.start(spec);
      expect(() => manager.start(spec)).toThrow(/already in progress/);
    });

    it('allows a new run after the previous one exits', () => {
      manager.start(spec);
      runner.exitCb(0, null);
      expect(() => manager.start(spec)).not.toThrow();
    });
  });

  describe('stop', () => {
    it('kills the child and maps the exit to stopped, not failed', () => {
      const { runId } = manager.start(spec);
      manager.stop(runId);
      expect(runner.killed).toBe(true);
      runner.exitCb(null, 'SIGKILL');
      expect(events.at(-1)?.statusUpdate?.status).toBe('stopped');
    });

    it('ignores a stop for an unknown run id', () => {
      manager.start(spec);
      manager.stop('other-run');
      expect(runner.killed).toBe(false);
    });
  });

  // Log batching and exit mapping span the run lifecycle rather than a
  // single method, so their tests live directly in RunManager's group.

  it('batches lines on the flush interval', () => {
    const { runId } = manager.start(spec);
    runner.lineCb('out', 'line 1');
    runner.lineCb('out', 'line 2');
    expect(events).toHaveLength(0);
    vi.advanceTimersByTime(60);
    expect(events).toEqual([{ runId, logBatch: ['line 1', 'line 2'] }]);
  });

  it('flushes pending lines before the exit event', () => {
    const { runId } = manager.start(spec);
    runner.lineCb('out', 'tail line');
    runner.exitCb(0, null);
    expect(events[0]).toEqual({ runId, logBatch: ['tail line'] });
    expect(events[1]?.statusUpdate?.status).toBe('finished');
  });

  it('writes every line to log.txt', () => {
    const { logPath } = manager.start(spec);
    runner.lineCb('out', 'persisted');
    runner.exitCb(0, null);
    vi.useRealTimers();
    // The write stream flushes asynchronously; poll briefly.
    return vi.waitFor(() => {
      const log = readFileSync(logPath, 'utf8');
      expect(log).toContain('$ mock-solver');
      expect(log).toContain('persisted');
    });
  });

  it('maps exit 0 to finished', () => {
    manager.start(spec);
    runner.exitCb(0, null);
    expect(events.at(-1)?.statusUpdate).toMatchObject({ status: 'finished', exitCode: 0 });
  });

  it('maps exit 2 to failed with a usage-error message', () => {
    manager.start(spec);
    runner.exitCb(2, null);
    const update = events.at(-1)?.statusUpdate;
    expect(update?.status).toBe('failed');
    expect(update?.message).toMatch(/usage error/);
  });

  it('maps exit 1 to failed with a load/health message', () => {
    manager.start(spec);
    runner.exitCb(1, null);
    expect(events.at(-1)?.statusUpdate?.message).toMatch(/load or health/);
  });
});
