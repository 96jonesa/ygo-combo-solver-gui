import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { SettingsStore, defaultSettings } from '../../../src/main/store/settings';

describe('SettingsStore', () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(path.join(os.tmpdir(), 'settings-'));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('returns defaults when no file exists', () => {
    expect(new SettingsStore(dir).get()).toEqual(defaultSettings());
  });

  it('round-trips settings through disk', () => {
    const store = new SettingsStore(dir);
    const next = { ...defaultSettings(), workdir: '/edopro' };
    store.set(next);
    expect(new SettingsStore(dir).get().workdir).toBe('/edopro');
  });

  it('merges partial files over defaults per section', () => {
    writeFileSync(path.join(dir, 'settings.json'), JSON.stringify({ workdir: '/w' }));
    const settings = new SettingsStore(dir).get();
    expect(settings.workdir).toBe('/w');
    expect(settings.solver).toEqual(defaultSettings().solver);
    expect(settings.defaults).toEqual(defaultSettings().defaults);
  });

  it('falls back to defaults on a corrupt file', () => {
    writeFileSync(path.join(dir, 'settings.json'), '{not json');
    expect(new SettingsStore(dir).get()).toEqual(defaultSettings());
  });

  it('writes human-readable versioned json', () => {
    new SettingsStore(dir).set(defaultSettings());
    const raw = readFileSync(path.join(dir, 'settings.json'), 'utf8');
    expect(JSON.parse(raw).version).toBe(1);
    expect(raw).toContain('\n');
  });
});
