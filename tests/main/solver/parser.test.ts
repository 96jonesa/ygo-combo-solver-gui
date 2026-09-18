import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { SolverOutputParser } from '../../../src/main/solver/parser';

// Fixtures are SYNTHETIC, written against the report format documented
// in the solver README at fd5d30e. TDD §7.3 calls for real captured
// logs per pinned solver commit; swap these when a solver build is
// available to capture from.
function parseFixture(name: string) {
  const text = readFileSync(
    path.join(import.meta.dirname, '../../fixtures/logs/synthetic', name),
    'utf8',
  );
  const parser = new SolverOutputParser();
  for (const line of text.split('\n')) parser.feed(line);
  return parser.snapshot();
}

describe('SolverOutputParser', () => {
  it('distills a healthy optimize run', () => {
    const status = parseFixture('optimize-ok.txt');
    expect(status.phase).toBe('output');
    expect(status.msgRetry).toBe(0);
    expect(status.selfChecks).toEqual({
      pass: true,
      detail: 'enumerator coverage ok, snapshot stress ok, width ok',
    });
    expect(status.seed).toBe(888);
    expect(status.ladder).toEqual({ discrepancies: 2, solutions: 2 });
    expect(status.solutionsWritten).toEqual({ written: 2, candidates: 5 });
    expect(status.inertFlags).toEqual([]);
    expect(status.errors).toEqual([]);
  });

  it('surfaces a script-mismatch failure', () => {
    const status = parseFixture('verify-bad-scripts.txt');
    expect(status.msgRetry).toBe(46);
    expect(status.selfChecks?.pass).toBe(false);
    expect(status.errors).toEqual([
      'replay diverged: card scripts do not match the recording',
    ]);
    expect(status.inertFlags).toEqual(['--burn-limit']);
  });

  it('tracks phase transitions through section markers', () => {
    const parser = new SolverOutputParser();
    expect(parser.snapshot().phase).toBeUndefined();
    parser.feed('loading');
    expect(parser.snapshot().phase).toBe('loading');
    parser.feed('results');
    expect(parser.snapshot().phase).toBe('replay');
    parser.feed('--- bounded-discrepancy search around the plan ---');
    expect(parser.snapshot().phase).toBe('search');
    parser.feed('--- output ---');
    expect(parser.snapshot().phase).toBe('output');
  });

  it('reads ladder rows only inside the discrepancy table', () => {
    const parser = new SolverOutputParser();
    // The reference-cost table has numeric rows too; they must not
    // register as ladder progress.
    parser.feed('--- cost of the reference line ---');
    parser.feed('  0             1         9          61');
    expect(parser.snapshot().ladder).toBeUndefined();
    parser.feed('--- bounded-discrepancy search around the plan ---');
    parser.feed('  0                 0        184213        9921      41203      3.2 s');
    expect(parser.snapshot().ladder).toEqual({ discrepancies: 0, solutions: 0 });
    // The solutions table after the search section ends the ladder.
    parser.feed('--- output ---');
    parser.feed('  1             3         9          61');
    expect(parser.snapshot().ladder).toEqual({ discrepancies: 0, solutions: 0 });
  });

  it('deduplicates repeated INERT flags and errors', () => {
    const parser = new SolverOutputParser();
    parser.feed('  --burn-limit 3 !! INERT (no --solve)');
    parser.feed('  --burn-limit 3 !! INERT (no --solve)');
    parser.feed('!! no EDOPro installation: pass --workdir <dir>');
    parser.feed('!! no EDOPro installation: pass --workdir <dir>');
    const status = parser.snapshot();
    expect(status.inertFlags).toEqual(['--burn-limit']);
    expect(status.errors).toHaveLength(1);
  });

  it('reads the fire verdict line', () => {
    const parser = new SolverOutputParser();
    parser.feed('=== --fire verdict: 4 window(s) out of 6 converted (3 full board, 1 without the sacrificed card) ===');
    expect(parser.snapshot().fireVerdict).toEqual({ converted: 4, windows: 6 });
  });

  describe('@event lines', () => {
    it('applies every event type directly', () => {
      const parser = new SolverOutputParser();
      for (const e of [
        '{"type":"phase","phase":"search"}',
        '{"type":"health","msgRetry":3}',
        '{"type":"selfChecks","pass":false,"detail":"stress 1/2/1"}',
        '{"type":"seed","seed":42}',
        '{"type":"ladder","discrepancies":4,"solutions":7}',
        '{"type":"written","written":24,"candidates":185}',
        '{"type":"fireVerdict","converted":2,"windows":3}',
        '{"type":"inert","mode":"solve","flags":"reenter 0.50"}',
      ])
        expect(parser.feed('@event ' + e)).toBe(true);
      const s = parser.snapshot();
      expect(s.phase).toBe('search');
      expect(s.msgRetry).toBe(3);
      expect(s.selfChecks).toEqual({ pass: false, detail: 'stress 1/2/1' });
      expect(s.seed).toBe(42);
      expect(s.ladder).toEqual({ discrepancies: 4, solutions: 7 });
      expect(s.solutionsWritten).toEqual({ written: 24, candidates: 185 });
      expect(s.fireVerdict).toEqual({ converted: 2, windows: 3 });
      expect(s.inertFlags).toEqual(['reenter 0.50']);
    });

    it('routes the solver\'s "REQUESTED but INERT" text line to warnings, not errors', () => {
      // This exact phrasing used to land in the red error bucket.
      const parser = new SolverOutputParser();
      parser.feed('!! REQUESTED but INERT here (dependency absent in this mode): reenter 0.50');
      const s = parser.snapshot();
      expect(s.inertFlags).toEqual(['reenter 0.50']);
      expect(s.errors).toEqual([]);
    });

    it('falls back to the regex path on malformed events', () => {
      const parser = new SolverOutputParser();
      expect(() => parser.feed('@event {broken')).not.toThrow();
      parser.feed('  MSG_RETRY           : 0');
      expect(parser.snapshot().msgRetry).toBe(0);
    });
  });

  it('never throws on arbitrary junk lines', () => {
    const parser = new SolverOutputParser();
    for (const junk of ['', '   ', '\t', '💥', '--- ---', '!!', '0 1 2 3', 'MSG_RETRY'])
      expect(() => parser.feed(junk)).not.toThrow();
  });

  it('reports whether a line changed the snapshot', () => {
    const parser = new SolverOutputParser();
    expect(parser.feed('some banter')).toBe(false);
    expect(parser.feed('  MSG_RETRY           : 0')).toBe(true);
    expect(parser.feed('  MSG_RETRY           : 0')).toBe(false);
  });
});
