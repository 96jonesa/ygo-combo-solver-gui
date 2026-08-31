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
