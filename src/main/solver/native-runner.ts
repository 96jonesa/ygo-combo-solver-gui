import { spawn } from 'node:child_process';
import type { RunHandle, SolverRunner } from './runner';
import { LineSplitter } from './runner';

/**
 * Spawns the solver executable directly (TDD §5.1). Never shell: true —
 * argv stays an array, which sidesteps Windows quoting entirely.
 *
 * Dev affordance: a .js/.mjs/.cjs path is run on Electron-as-Node
 * (ELECTRON_RUN_AS_NODE=1), so a fake solver script can stand in for
 * combosolver.exe on macOS during development. This is also the spawn
 * shape the M3 WasmRunner will use.
 */
export class NativeRunner implements SolverRunner {
  constructor(
    private readonly exePath: string,
    private readonly solverCommit?: string,
  ) {}

  describe() {
    return { kind: 'native' as const, path: this.exePath, solverCommit: this.solverCommit };
  }

  start(argv: string[], opts: { cwd: string }): RunHandle {
    const asNodeScript = /\.(mjs|cjs|js)$/i.test(this.exePath);
    const child = asNodeScript
      ? spawn(process.execPath, [this.exePath, ...argv], {
          cwd: opts.cwd,
          env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' },
        })
      : spawn(this.exePath, argv, { cwd: opts.cwd, windowsHide: true });

    let lineCb: (stream: 'out' | 'err', line: string) => void = () => {};
    let exitCb: (code: number | null, signal: string | null) => void = () => {};

    const out = new LineSplitter((line) => lineCb('out', line));
    const err = new LineSplitter((line) => lineCb('err', line));
    child.stdout.setEncoding('utf8').on('data', (chunk: string) => out.feed(chunk));
    child.stderr.setEncoding('utf8').on('data', (chunk: string) => err.feed(chunk));

    // A spawn failure (e.g. missing exe) emits 'error' and no 'close'.
    child.on('error', (error) => {
      lineCb('err', `!! failed to start solver: ${error.message}`);
      exitCb(null, null);
    });
    child.on('close', (code, signal) => {
      out.flush();
      err.flush();
      exitCb(code, signal);
    });

    return {
      onLine: (cb) => (lineCb = cb),
      onExit: (cb) => (exitCb = cb),
      kill: () => {
        if (child.pid === undefined || child.killed) return;
        if (process.platform === 'win32') {
          // Kill the whole tree; SIGKILL alone can orphan solver workers.
          spawn('taskkill', ['/pid', String(child.pid), '/t', '/f'], { windowsHide: true });
        } else {
          child.kill('SIGKILL');
        }
      },
    };
  }
}
