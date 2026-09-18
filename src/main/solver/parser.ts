import type { ParsedStatus } from '../../shared/types';

/**
 * Best-effort, line-oriented parser over the solver's stdout (TDD §7).
 *
 * Contract: never throws, never gates the run. Unrecognized lines
 * produce no change. Patterns anchor to the most stable output features
 * (section markers, "MSG_RETRY", "!!" prefixes) and were written
 * against the report format documented in the solver README at commit
 * fd5d30e; drift downgrades the status display, nothing else.
 */
export class SolverOutputParser {
  private readonly status: ParsedStatus = { inertFlags: [], errors: [] };
  private inLadderTable = false;

  /** The accumulated status after every line fed so far. */
  snapshot(): ParsedStatus {
    return {
      ...this.status,
      inertFlags: [...this.status.inertFlags],
      errors: [...this.status.errors],
    };
  }

  /** Feed one log line; returns true when the snapshot changed. */
  feed(line: string): boolean {
    const before = JSON.stringify(this.status);
    this.consume(line);
    return JSON.stringify(this.status) !== before;
  }

  private applyEvent(e: Record<string, unknown>): void {
    switch (e.type) {
      case 'phase':
        if (e.phase === 'loading' || e.phase === 'replay' || e.phase === 'search' || e.phase === 'output')
          this.status.phase = e.phase;
        break;
      case 'health':
        if (typeof e.msgRetry === 'number') this.status.msgRetry = e.msgRetry;
        break;
      case 'selfChecks':
        if (typeof e.pass === 'boolean')
          this.status.selfChecks = { pass: e.pass, detail: String(e.detail ?? '') };
        break;
      case 'seed':
        if (typeof e.seed === 'number') this.status.seed = e.seed;
        break;
      case 'ladder':
        if (typeof e.discrepancies === 'number' && typeof e.solutions === 'number')
          this.status.ladder = { discrepancies: e.discrepancies, solutions: e.solutions };
        break;
      case 'written':
        if (typeof e.written === 'number')
          this.status.solutionsWritten = {
            written: e.written,
            candidates: typeof e.candidates === 'number' ? e.candidates : undefined,
          };
        break;
      case 'fireVerdict':
        if (typeof e.converted === 'number' && typeof e.windows === 'number')
          this.status.fireVerdict = { converted: e.converted, windows: e.windows };
        break;
      case 'inert': {
        const flags = String(e.flags ?? '');
        if (flags !== '' && !this.status.inertFlags.includes(flags))
          this.status.inertFlags.push(flags);
        break;
      }
    }
  }

  private consume(line: string): void {
    const trimmed = line.trim();

    // Structured channel first (solver --json): "@event {...}" lines carry
    // the same milestones as the report, without the wording fragility. A
    // malformed event falls through to the regex path like any other line.
    if (trimmed.startsWith('@event ')) {
      try {
        this.applyEvent(JSON.parse(trimmed.slice(7)) as Record<string, unknown>);
        return;
      } catch {
        // fall through
      }
    }

    // Coarse phase from headers and section markers.
    if (trimmed === 'loading') {
      this.status.phase = 'loading';
    } else if (trimmed === 'results') {
      this.status.phase = 'replay';
      this.inLadderTable = false;
    } else if (/^--- bounded-discrepancy search/.test(trimmed)) {
      this.status.phase = 'search';
      this.inLadderTable = true;
    } else if (/^--- output ---/.test(trimmed)) {
      this.status.phase = 'output';
      this.inLadderTable = false;
    } else if (/^--- /.test(trimmed)) {
      this.inLadderTable = false;
    } else if (/^#\s/.test(trimmed) || /line\(s\) reaching the board/.test(trimmed)) {
      // The per-solution cost table and its "N line(s) reaching" lead-in
      // follow the ladder inside the same section; their numeric rows
      // must not register as ladder progress.
      this.inLadderTable = false;
    }

    let match: RegExpMatchArray | null;

    if ((match = trimmed.match(/^MSG_RETRY\s*:\s*(\d+)/))) {
      this.status.msgRetry = Number(match[1]);
    }

    if ((match = trimmed.match(/^self-checks\s*:\s*(\S+?),?(\s.*)?$/))) {
      this.status.selfChecks = {
        pass: match[1] === 'pass',
        detail: (match[2] ?? '').trim(),
      };
    }

    if ((match = trimmed.match(/^seed:\s*(\d+)/))) {
      this.status.seed = Number(match[1]);
    }

    if (trimmed.includes('!! INERT')) {
      // Typical shape: "--foo ... !! INERT (reason)"; fall back to the line.
      const flag = trimmed.match(/(--[a-z-]+)/)?.[1] ?? trimmed;
      if (!this.status.inertFlags.includes(flag)) this.status.inertFlags.push(flag);
    } else if (trimmed.startsWith('!!')) {
      const message = trimmed.replace(/^!+\s*/, '');
      if (message.length > 0 && !this.status.errors.includes(message))
        this.status.errors.push(message);
    }

    // Ladder rows: "  0        2      1902881   210394   883021   58.4 s ..."
    // Only while inside the discrepancy table, to avoid misreading other
    // numeric report rows.
    if (this.inLadderTable && (match = line.match(/^\s+(\d+)\s+(\d+)\s+\d+/))) {
      this.status.ladder = { discrepancies: Number(match[1]), solutions: Number(match[2]) };
    }

    if ((match = trimmed.match(/^=== --fire verdict: (\d+) window\(s\) out of (\d+) converted/))) {
      this.status.fireVerdict = { converted: Number(match[1]), windows: Number(match[2]) };
    }

    if ((match = trimmed.match(/^(\d+) replay\(s\) written to \S+(?:\s+\(out of (\d+) candidate\(s\)\))?/))) {
      this.status.solutionsWritten = {
        written: Number(match[1]),
        candidates: match[2] !== undefined ? Number(match[2]) : undefined,
      };
    }
  }
}
