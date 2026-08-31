import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { HistoryStore } from '../../../src/main/store/history';
import type { RunRecord } from '../../../src/shared/types';

function record(runId: string, overrides: Partial<RunRecord> = {}): RunRecord {
  return {
    version: 1,
    runId,
    spec: { kind: 'verify', replay: 'duel.yrpX', common: {} },
    argv: ['duel.yrpX'],
    display: 'solver duel.yrpX',
    solver: { kind: 'native', path: 'solver' },
    startedAt: '2026-08-31T00:00:00Z',
    logPath: `/runs/${runId}/log.txt`,
    outdir: `/runs/${runId}/solutions`,
    ...overrides,
  };
}

describe('HistoryStore', () => {
  let runsDir: string;
  let store: HistoryStore;

  beforeEach(() => {
    runsDir = mkdtempSync(path.join(os.tmpdir(), 'history-'));
    store = new HistoryStore(runsDir);
  });

  afterEach(() => {
    rmSync(runsDir, { recursive: true, force: true });
  });

  it('round-trips a record through disk', () => {
    store.write(record('2026-a1'));
    expect(store.get('2026-a1')?.spec.replay).toBe('duel.yrpX');
  });

  it('returns null for an unknown or corrupt record', () => {
    expect(store.get('missing')).toBeNull();
    mkdirSync(path.join(runsDir, 'corrupt'));
    writeFileSync(path.join(runsDir, 'corrupt', 'run.json'), '{broken');
    expect(store.get('corrupt')).toBeNull();
  });

  describe('patch', () => {
    it('merges changes into the stored record', () => {
      store.write(record('2026-a1'));
      const updated = store.patch('2026-a1', { outcome: 'finished', exitCode: 0 });
      expect(updated?.outcome).toBe('finished');
      expect(store.get('2026-a1')?.exitCode).toBe(0);
      expect(store.get('2026-a1')?.spec.replay).toBe('duel.yrpX'); // untouched fields survive
    });

    it('returns null when the run does not exist', () => {
      expect(store.patch('missing', { outcome: 'finished' })).toBeNull();
    });
  });

  describe('list', () => {
    it('lists newest-first with solution counts, skipping corrupt entries', () => {
      store.write(record('2026-01-old'));
      store.write(
        record('2026-02-new', {
          outcome: 'finished',
          artifacts: [
            { file: 'solution_00_b1_a9.yrp', kind: 'solution', rank: 0, burned: 1, actions: 9, alt: false },
            { file: 'readme.txt', kind: 'other' },
          ],
        }),
      );
      mkdirSync(path.join(runsDir, '2026-03-corrupt'));
      writeFileSync(path.join(runsDir, '2026-03-corrupt', 'run.json'), '{broken');

      const list = store.list();
      expect(list.map((s) => s.runId)).toEqual(['2026-02-new', '2026-01-old']);
      expect(list[0]).toMatchObject({ outcome: 'finished', solutions: 1 });
      expect(list[1]?.solutions).toBeUndefined();
    });

    it('returns empty for a missing runs directory', () => {
      expect(new HistoryStore(path.join(runsDir, 'nope')).list()).toEqual([]);
    });
  });
});
