import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { classifyArtifact, scanOutdir } from '../../../src/main/solver/results';

describe('classifyArtifact', () => {
  it('parses solution filenames into rank, burned, actions', () => {
    expect(classifyArtifact('solution_00_b1_a9.yrp')).toEqual({
      file: 'solution_00_b1_a9.yrp',
      kind: 'solution',
      rank: 0,
      burned: 1,
      actions: 9,
      alt: false,
    });
  });

  it('marks alt-goal solutions', () => {
    expect(classifyArtifact('solution_03_b2_a14_alt.yrp')).toMatchObject({
      kind: 'solution',
      rank: 3,
      alt: true,
    });
  });

  it('parses approaches, joints and rejected witnesses', () => {
    expect(classifyArtifact('best_approach_5of8.yrp')).toEqual({
      file: 'best_approach_5of8.yrp',
      kind: 'approach',
      reached: 5,
      of: 8,
    });
    expect(classifyArtifact('best_joint_2r_6of8.yrp')).toEqual({
      file: 'best_joint_2r_6of8.yrp',
      kind: 'joint',
      rips: 2,
      reached: 6,
      of: 8,
    });
    expect(classifyArtifact('but_rejete_01_constraint.yrp')).toEqual({
      file: 'but_rejete_01_constraint.yrp',
      kind: 'rejected',
      index: 1,
      reason: 'constraint',
    });
  });

  it('classifies anything unmatched as other, never hides it', () => {
    expect(classifyArtifact('notes.txt')).toEqual({ file: 'notes.txt', kind: 'other' });
    expect(classifyArtifact('solution_xx.yrp')).toEqual({
      file: 'solution_xx.yrp',
      kind: 'other',
    });
  });
});

describe('scanOutdir', () => {
  let outdir: string;

  beforeEach(() => {
    outdir = mkdtempSync(path.join(os.tmpdir(), 'outdir-'));
  });

  afterEach(() => {
    rmSync(outdir, { recursive: true, force: true });
  });

  it('returns empty for a missing directory', () => {
    expect(scanOutdir(path.join(outdir, 'nope'))).toEqual([]);
  });

  it('sorts solutions by cost then groups the rest by kind', () => {
    for (const name of [
      'but_rejete_00_retry.yrp',
      'solution_01_b2_a7.yrp',
      'best_approach_5of8.yrp',
      'solution_00_b1_a9.yrp',
      'readme.txt',
    ])
      writeFileSync(path.join(outdir, name), 'x');
    mkdirSync(path.join(outdir, 'subdir')); // directories are ignored

    expect(scanOutdir(outdir).map((a) => a.file)).toEqual([
      'solution_00_b1_a9.yrp', // burned 1 beats burned 2 despite more actions
      'solution_01_b2_a7.yrp',
      'best_approach_5of8.yrp',
      'but_rejete_00_retry.yrp',
      'readme.txt',
    ]);
  });
});
