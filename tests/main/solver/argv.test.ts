import { describe, expect, it } from 'vitest';
import { buildArgv, displayCommand, splitExtraArgs } from '../../../src/main/solver/argv';
import type { RunSpec } from '../../../src/shared/types';

describe('splitExtraArgs', () => {
  it('splits on whitespace', () => {
    expect(splitExtraArgs('--solve --optimize -v')).toEqual(['--solve', '--optimize', '-v']);
  });

  it('handles multiple spaces and tabs', () => {
    expect(splitExtraArgs('  --solve\t\t--verbose  ')).toEqual(['--solve', '--verbose']);
  });

  it('groups double-quoted tokens with spaces', () => {
    expect(splitExtraArgs('--hand "Ash Blossom|Ash Blossom"')).toEqual([
      '--hand',
      'Ash Blossom|Ash Blossom',
    ]);
  });

  it('groups single-quoted tokens', () => {
    expect(splitExtraArgs("--guard '5:Crystal Wing|Zalen@field'")).toEqual([
      '--guard',
      '5:Crystal Wing|Zalen@field',
    ]);
  });

  it('honors backslash escapes outside single quotes', () => {
    expect(splitExtraArgs('--deck C:\\\\decks\\\\a\\ b.ydk')).toEqual(['--deck', 'C:\\decks\\a b.ydk']);
  });

  it('keeps quotes embedded mid-token', () => {
    expect(splitExtraArgs('--target "90590304@def"x')).toEqual(['--target', '90590304@defx']);
  });

  it('returns empty for blank input', () => {
    expect(splitExtraArgs('')).toEqual([]);
    expect(splitExtraArgs('   ')).toEqual([]);
  });

  it('preserves an explicit empty quoted token', () => {
    expect(splitExtraArgs('--x ""')).toEqual(['--x', '']);
  });

  it('rejects unterminated quotes', () => {
    expect(() => splitExtraArgs('--hand "Ash Blossom')).toThrow(/unterminated/);
  });

  it('performs no shell interpolation', () => {
    expect(splitExtraArgs('$HOME `id` "$(rm x)"')).toEqual(['$HOME', '`id`', '$(rm x)']);
  });
});

describe('buildArgv', () => {
  it('puts the replay first with no flags for a bare verify', () => {
    const spec: RunSpec = { kind: 'verify', replay: 'duel.yrpX', common: {} };
    expect(buildArgv(spec)).toEqual(['duel.yrpX']);
  });

  it('serializes common options in deterministic order', () => {
    const spec: RunSpec = {
      kind: 'verify',
      replay: 'duel.yrpX',
      common: {
        workdir: 'C:\\ProjectIgnis',
        scriptdirs: ['a', 'b'],
        outdir: 'solutions',
        solveMs: 300000,
        threads: 8,
        seed: 888,
      },
    };
    expect(buildArgv(spec)).toEqual([
      'duel.yrpX',
      '--workdir',
      'C:\\ProjectIgnis',
      '--scriptdir',
      'a',
      '--scriptdir',
      'b',
      '--outdir',
      'solutions',
      '--solve-ms',
      '300000',
      '--threads',
      '8',
      '--seed',
      '888',
    ]);
  });

  it('serializes optimize as --solve --optimize before common flags', () => {
    const spec: RunSpec = {
      kind: 'optimize',
      replay: 'duel.yrpX',
      common: { solveMs: 300000 },
    };
    expect(buildArgv(spec)).toEqual([
      'duel.yrpX',
      '--solve',
      '--optimize',
      '--solve-ms',
      '300000',
    ]);
  });

  it('serializes deckhand with pipe-joined passcode hand', () => {
    const spec: RunSpec = {
      kind: 'deckhand',
      replay: 'ref.yrpX',
      deck: 'C:\\decks\\Lunalight.ydk',
      hand: [
        { passcode: 24094653, name: 'Assault Zone' },
        { passcode: 14558127, name: 'Ash Blossom & Joyous Spring' },
        { passcode: 14558127, name: 'Ash Blossom & Joyous Spring' },
      ],
      common: {},
    };
    expect(buildArgv(spec)).toEqual([
      'ref.yrpX',
      '--deck',
      'C:\\decks\\Lunalight.ydk',
      '--hand',
      '24094653|14558127|14558127',
    ]);
  });

  it('serializes a described board as --no-ref with explicit target zones', () => {
    const spec: RunSpec = {
      kind: 'board',
      replay: 'template.yrpX',
      deck: 'd.ydk',
      hand: [],
      targets: [
        { card: { passcode: 54701958, name: 'Liger' }, zone: 'mzone', facedown: false },
        { card: { passcode: 54701958, name: 'Liger' }, zone: 'mzone', facedown: false },
        { card: { passcode: 90590304, name: 'Omega' }, zone: 'grave', facedown: false },
        { card: { passcode: 27204311, name: 'Zone' }, zone: 'szone', facedown: true },
      ],
      common: {},
    };
    expect(buildArgv(spec)).toEqual([
      'template.yrpX',
      '--no-ref',
      '--deck',
      'd.ydk',
      '--target',
      '54701958@mzone',
      '--target',
      '54701958@mzone', // repeats count: two copies on board
      '--target',
      '90590304@grave',
      '--target',
      '27204311@szone:fd',
    ]);
  });

  it('serializes fire with repeatable flags and raw guards', () => {
    const spec: RunSpec = {
      kind: 'fire',
      replay: 'duel.yrpX',
      fire: [{ passcode: 27204311, name: 'Zone' }],
      fireSpare: [{ passcode: 63977008, name: 'Junk Signal' }],
      oppHand: [{ passcode: 27204311, name: 'Nibiru' }],
      guards: ['5:Crystal Wing|Zalen@field+Junk Signal@hand'],
      common: {},
    };
    expect(buildArgv(spec)).toEqual([
      'duel.yrpX',
      '--fire',
      '27204311',
      '--fire-spare',
      '63977008',
      '--opp-hand',
      '27204311',
      '--guard',
      '5:Crystal Wing|Zalen@field+Junk Signal@hand',
    ]);
  });

  it('appends extra arguments verbatim, last', () => {
    const spec: RunSpec = {
      kind: 'verify',
      replay: 'duel.yrpX',
      common: { solveMs: 120000, extraArgs: '--solve --optimize' },
    };
    expect(buildArgv(spec)).toEqual([
      'duel.yrpX',
      '--solve-ms',
      '120000',
      '--solve',
      '--optimize',
    ]);
  });

  it('ignores whitespace-only extra arguments', () => {
    const spec: RunSpec = { kind: 'verify', replay: 'duel.yrpX', common: { extraArgs: '   ' } };
    expect(buildArgv(spec)).toEqual(['duel.yrpX']);
  });
});

describe('displayCommand', () => {
  it('quotes tokens containing spaces', () => {
    expect(displayCommand('combosolver.exe', ['my duel.yrpX', '--solve'])).toBe(
      'combosolver.exe "my duel.yrpX" --solve',
    );
  });

  it('leaves plain tokens unquoted', () => {
    expect(displayCommand('solver', ['duel.yrpX', '--threads', '8'])).toBe(
      'solver duel.yrpX --threads 8',
    );
  });

  it('escapes embedded double quotes', () => {
    expect(displayCommand('solver', ['a"b'])).toBe('solver "a\\"b"');
  });
});
