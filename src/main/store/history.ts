import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import type { RunRecord, RunSummary } from '../../shared/types';

/**
 * Run history as self-contained per-run folders (TDD §10.2): each
 * runs/<runId>/run.json is written at start and patched at exit, so
 * there is no central index file to corrupt. Listing reads the headers
 * newest-first (runIds sort chronologically by construction).
 */
export class HistoryStore {
  constructor(private readonly runsDir: string) {}

  private file(runId: string): string {
    return path.join(this.runsDir, runId, 'run.json');
  }

  write(record: RunRecord): void {
    const file = this.file(record.runId);
    mkdirSync(path.dirname(file), { recursive: true });
    // Write-then-rename so a crash mid-write can't corrupt the record.
    const tmp = file + '.tmp';
    writeFileSync(tmp, JSON.stringify(record, null, 2) + '\n');
    renameSync(tmp, file);
  }

  patch(runId: string, changes: Partial<RunRecord>): RunRecord | null {
    const existing = this.get(runId);
    if (existing === null) return null;
    const updated = { ...existing, ...changes, runId, version: 1 as const };
    this.write(updated);
    return updated;
  }

  get(runId: string): RunRecord | null {
    const file = this.file(runId);
    if (!existsSync(file)) return null;
    try {
      return JSON.parse(readFileSync(file, 'utf8')) as RunRecord;
    } catch {
      return null; // A corrupt record hides that run, never blocks the list.
    }
  }

  list(): RunSummary[] {
    if (!existsSync(this.runsDir)) return [];
    return readdirSync(this.runsDir, { withFileTypes: true })
      .filter((e) => e.isDirectory())
      .map((e) => this.get(e.name))
      .filter((r): r is RunRecord => r !== null)
      .sort((a, b) => b.runId.localeCompare(a.runId))
      .map((r) => ({
        runId: r.runId,
        kind: r.spec.kind,
        replay: r.spec.replay,
        startedAt: r.startedAt,
        endedAt: r.endedAt,
        outcome: r.outcome,
        solutions: r.artifacts?.filter((a) => a.kind === 'solution').length,
      }));
  }
}
