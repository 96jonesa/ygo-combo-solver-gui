import { describe, expect, it } from 'vitest';
import { validateSpec } from '../../../src/main/solver/validate';
import type { CardRef, RunSpec } from '../../../src/shared/types';

const card: CardRef = { passcode: 14558127, name: 'Ash Blossom & Joyous Spring' };
const noPaths = { checkPaths: false };

describe('validateSpec', () => {
  it('accepts a minimal verify spec', () => {
    const spec: RunSpec = { kind: 'verify', replay: 'duel.yrpX', common: {} };
    expect(validateSpec(spec, noPaths)).toEqual([]);
  });

  it('requires a replay', () => {
    const spec: RunSpec = { kind: 'verify', replay: '  ', common: {} };
    expect(validateSpec(spec, noPaths)).toEqual(['pick a replay file']);
  });

  it('checks replay existence when paths are checked', () => {
    const spec: RunSpec = { kind: 'verify', replay: '/definitely/missing.yrpX', common: {} };
    expect(validateSpec(spec).join(' ')).toContain('replay not found');
  });

  it('requires a .ydk decklist for deck workflows', () => {
    const missing: RunSpec = { kind: 'deckhand', replay: 'r.yrpX', deck: '', hand: [], common: {} };
    expect(validateSpec(missing, noPaths)).toEqual(['pick a .ydk decklist']);

    const wrongExt: RunSpec = {
      kind: 'deckhand',
      replay: 'r.yrpX',
      deck: 'deck.txt',
      hand: [],
      common: {},
    };
    expect(validateSpec(wrongExt, noPaths)).toEqual(['the decklist must be a .ydk file']);
  });

  it('requires at least one target for a described board', () => {
    const spec: RunSpec = {
      kind: 'board',
      replay: 'r.yrpX',
      deck: 'd.ydk',
      hand: [],
      targets: [],
      common: {},
    };
    expect(validateSpec(spec, noPaths)).toEqual(['describe at least one target card']);
  });

  it('requires at least one fired card for an interruption test', () => {
    const spec: RunSpec = {
      kind: 'fire',
      replay: 'r.yrpX',
      fire: [],
      fireSpare: [],
      oppHand: [card],
      guards: [],
      common: {},
    };
    expect(validateSpec(spec, noPaths)).toEqual(['pick at least one card to fire']);
  });

  it('rejects sub-second budgets and non-positive threads', () => {
    const spec: RunSpec = {
      kind: 'verify',
      replay: 'r.yrpX',
      common: { solveMs: 500, threads: 0 },
    };
    expect(validateSpec(spec, noPaths)).toEqual([
      'budget must be at least 1 second',
      'threads must be a positive integer',
    ]);
  });

  it('rejects --start in extra arguments alongside a deck workflow', () => {
    const spec: RunSpec = {
      kind: 'deckhand',
      replay: 'r.yrpX',
      deck: 'd.ydk',
      hand: [],
      common: { extraArgs: '--start other.yrpX' },
    };
    expect(validateSpec(spec, noPaths).join(' ')).toContain('--start');
  });

  it('allows --start in extra arguments for non-deck workflows', () => {
    const spec: RunSpec = {
      kind: 'verify',
      replay: 'r.yrpX',
      common: { extraArgs: '--start other.yrpX' },
    };
    expect(validateSpec(spec, noPaths)).toEqual([]);
  });
});
