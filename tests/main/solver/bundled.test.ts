import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { bundledSolverRelPath, readSolverManifest } from '../../../src/main/solver/bundled';

describe('bundledSolverRelPath', () => {
  it('maps each platform to its artifact', () => {
    expect(bundledSolverRelPath('win32')).toEqual([
      'resources',
      'solver',
      'win',
      'combosolver.exe',
    ]);
    expect(bundledSolverRelPath('darwin')).toEqual(['resources', 'solver', 'mac', 'combosolver']);
    expect(bundledSolverRelPath('linux')).toEqual(['resources', 'solver', 'linux', 'combosolver']);
  });
});

describe('readSolverManifest', () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(path.join(os.tmpdir(), 'manifest-'));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('reads the manifest next to the binary', () => {
    writeFileSync(path.join(dir, 'manifest.json'), JSON.stringify({ solverCommit: 'abc123' }));
    expect(readSolverManifest(path.join(dir, 'combosolver')).solverCommit).toBe('abc123');
  });

  it('returns empty for a missing or corrupt manifest', () => {
    expect(readSolverManifest(path.join(dir, 'combosolver'))).toEqual({});
    writeFileSync(path.join(dir, 'manifest.json'), '{broken');
    expect(readSolverManifest(path.join(dir, 'combosolver'))).toEqual({});
  });
});
