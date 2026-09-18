/** The single seam between the GUI and solver deliveries (TDD §5). */

export interface SolverRunner {
  /** Spawn a run. argv excludes the program itself. */
  start(argv: string[], opts: { cwd: string }): RunHandle;
  /** Where this runner's solver came from, for display and history. */
  describe(): { kind: 'native' | 'wasm'; path: string; solverCommit?: string };
}

export interface RunHandle {
  onLine(cb: (stream: 'out' | 'err', line: string) => void): void;
  onExit(cb: (code: number | null, signal: string | null) => void): void;
  /** Graceful stop: ask the solver to finish the run and write what it has. */
  stop(): void;
  /** Hard kill, the fallback when a stop request goes unanswered. */
  kill(): void;
}

/**
 * Incremental line splitter for a byte stream: feed chunks, get whole
 * lines; a trailing unterminated line is emitted on flush().
 */
export class LineSplitter {
  private buffer = '';
  constructor(private readonly emit: (line: string) => void) {}

  feed(chunk: string): void {
    this.buffer += chunk;
    let index: number;
    while ((index = this.buffer.indexOf('\n')) >= 0) {
      let line = this.buffer.slice(0, index);
      if (line.endsWith('\r')) line = line.slice(0, -1);
      this.buffer = this.buffer.slice(index + 1);
      this.emit(line);
    }
  }

  flush(): void {
    if (this.buffer.length > 0) {
      this.emit(this.buffer);
      this.buffer = '';
    }
  }
}
