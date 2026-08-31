import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildLaunchPlan, copyIntoReplayDir } from '../../../src/main/edopro/launcher';

describe('buildLaunchPlan', () => {
  it('opens .app bundles via open on macOS', () => {
    expect(buildLaunchPlan('/edopro/EDOPro.app', 'darwin')).toEqual({
      program: 'open',
      args: ['/edopro/EDOPro.app'],
    });
  });

  it('runs the executable directly elsewhere', () => {
    expect(buildLaunchPlan('C:\\ProjectIgnis\\EDOPro.exe', 'win32')).toEqual({
      program: 'C:\\ProjectIgnis\\EDOPro.exe',
      args: [],
    });
    expect(buildLaunchPlan('/edopro/EDOPro', 'darwin')).toEqual({
      program: '/edopro/EDOPro',
      args: [],
    });
  });
});

describe('copyIntoReplayDir', () => {
  let workdir: string;

  beforeEach(() => {
    workdir = mkdtempSync(path.join(os.tmpdir(), 'edopro-'));
  });

  afterEach(() => {
    rmSync(workdir, { recursive: true, force: true });
  });

  it('copies under a collision-safe run-prefixed name, creating replay/', () => {
    const source = path.join(workdir, 'solution_00_b1_a9.yrp');
    writeFileSync(source, 'replay bytes');
    const target = copyIntoReplayDir(workdir, source, 'run-42');
    expect(target).toBe(path.join(workdir, 'replay', 'gui_run-42_solution_00_b1_a9.yrp'));
    expect(readFileSync(target, 'utf8')).toBe('replay bytes');
    expect(existsSync(source)).toBe(true); // copy, not move
  });
});
