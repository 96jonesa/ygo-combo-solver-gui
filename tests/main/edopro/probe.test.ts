import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { candidateWorkdirs, probeWorkdir } from '../../../src/main/edopro/probe';

describe('probeWorkdir', () => {
  let workdir: string;

  beforeEach(() => {
    workdir = mkdtempSync(path.join(os.tmpdir(), 'edopro-'));
  });

  afterEach(() => {
    rmSync(workdir, { recursive: true, force: true });
  });

  function addFile(rel: string, content = 'x'): void {
    const full = path.join(workdir, rel);
    mkdirSync(path.dirname(full), { recursive: true });
    writeFileSync(full, content);
  }

  it('fails for a missing directory', () => {
    const health = probeWorkdir(path.join(workdir, 'nope'));
    expect(health.ok).toBe(false);
    expect(health.problems).toContain('directory does not exist');
  });

  it('accepts a conventional install', () => {
    addFile('cards.cdb');
    addFile('script/c1.lua');
    addFile('EDOPro.exe');
    const health = probeWorkdir(workdir);
    expect(health.ok).toBe(true);
    expect(health.cardDbs).toEqual([path.join(workdir, 'cards.cdb')]);
    expect(health.scriptRoots).toEqual([path.join(workdir, 'script')]);
    expect(health.edoproExe).toBe(path.join(workdir, 'EDOPro.exe'));
    expect(health.problems).toEqual([]);
  });

  it('treats an empty cards.cdb as missing, matching the solver', () => {
    addFile('cards.cdb', '');
    addFile('script/c1.lua');
    const health = probeWorkdir(workdir);
    expect(health.ok).toBe(false);
    expect(health.cardDbs).toEqual([]);
    expect(health.problems.join(' ')).toContain('cards.cdb is empty');
  });

  it('finds cdbs recursively under expansions and repositories', () => {
    addFile('expansions/pack1/cards1.cdb');
    addFile('repositories/delta/deep/cards2.cdb');
    addFile('repositories/delta/script/c1.lua');
    const health = probeWorkdir(workdir);
    expect(health.ok).toBe(true);
    expect(health.cardDbs).toHaveLength(2);
    expect(health.scriptRoots).toEqual([path.join(workdir, 'repositories', 'delta', 'script')]);
  });

  it('collects script roots in the solver order: repositories, expansions, root', () => {
    addFile('cards.cdb');
    addFile('repositories/a/script/x.lua');
    addFile('expansions/script/x.lua');
    addFile('script/x.lua');
    const health = probeWorkdir(workdir);
    expect(health.scriptRoots).toEqual([
      path.join(workdir, 'repositories', 'a', 'script'),
      path.join(workdir, 'expansions', 'script'),
      path.join(workdir, 'script'),
    ]);
  });

  it('reports a missing EDOPro executable as a problem but stays usable', () => {
    addFile('cards.cdb');
    addFile('script/c1.lua');
    const health = probeWorkdir(workdir);
    expect(health.ok).toBe(true);
    expect(health.edoproExe).toBeNull();
    expect(health.problems.join(' ')).toContain('EDOPro executable not found');
  });
});

describe('candidateWorkdirs', () => {
  it('offers windows drive locations on win32', () => {
    expect(candidateWorkdirs('win32', 'C:\\Users\\a')).toContain('C:\\ProjectIgnis');
  });

  it('offers home-relative locations elsewhere', () => {
    expect(candidateWorkdirs('darwin', '/Users/a')).toContain('/Users/a/ProjectIgnis');
  });
});
