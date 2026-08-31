import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { NativeRunner } from '../../../src/main/solver/native-runner';

const fakeSolver = path.join(import.meta.dirname, '../../../scripts/fake-solver.mjs');

/**
 * Real-subprocess coverage of the spawn → line stream → exit path,
 * using the fake solver script via the runner's Node-script branch
 * (the same branch the M3 WasmRunner will rely on).
 */
describe('NativeRunner', () => {
  function run(argv: string[]): Promise<{ lines: string[]; code: number | null }> {
    return new Promise((resolve) => {
      const lines: string[] = [];
      const handle = new NativeRunner(fakeSolver).start(argv, { cwd: import.meta.dirname });
      handle.onLine((_stream, line) => lines.push(line));
      handle.onExit((code) => resolve({ lines, code }));
    });
  }

  it('streams the solver report line by line and exits 0', async () => {
    const { lines, code } = await run(['duel.yrpX', '--solve-ms', '100']);
    expect(code).toBe(0);
    expect(lines.some((l) => l.includes('MSG_RETRY'))).toBe(true);
    expect(lines.some((l) => l.includes('--- output ---'))).toBe(true);
  });

  it('passes argv through positionally without shell mangling', async () => {
    const { lines } = await run(['my duel.yrpX', '--solve-ms', '100']);
    expect(lines.some((l) => l === 'replay: my duel.yrpX')).toBe(true);
  });

  it('reports a spawn failure as an error line and a null exit', async () => {
    const missing = new NativeRunner(path.join(import.meta.dirname, 'missing.exe'));
    const result = await new Promise<{ lines: string[]; code: number | null }>((resolve) => {
      const lines: string[] = [];
      const handle = missing.start([], { cwd: import.meta.dirname });
      handle.onLine((_stream, line) => lines.push(line));
      handle.onExit((code) => resolve({ lines, code }));
    });
    expect(result.code).toBeNull();
    expect(result.lines.some((l) => l.includes('failed to start solver'))).toBe(true);
  });

  it('kill terminates a running solver', async () => {
    const runner = new NativeRunner(fakeSolver);
    const handle = runner.start(['duel.yrpX', '--solve-ms', '60000'], {
      cwd: import.meta.dirname,
    });
    const exited = new Promise<string | null>((resolve) => {
      handle.onExit((_code, signal) => resolve(signal));
    });
    // Give the child a moment to start before killing it.
    await new Promise((r) => setTimeout(r, 300));
    handle.kill();
    await expect(exited).resolves.toBe('SIGKILL');
  }, 10_000);
});
