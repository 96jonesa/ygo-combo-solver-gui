import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import type { Settings } from '../../shared/types';

export function defaultSettings(): Settings {
  return {
    version: 1,
    workdir: null,
    scriptdirs: [],
    solver: { nativePath: null, forceWasm: false },
    defaults: { solveMs: 120_000, threads: null },
  };
}

/** Versioned JSON settings under userData (TDD §10.1). */
export class SettingsStore {
  private readonly file: string;
  private cached: Settings | null = null;

  constructor(userDataDir: string) {
    this.file = path.join(userDataDir, 'settings.json');
  }

  get(): Settings {
    if (this.cached !== null) return this.cached;
    let loaded: Partial<Settings> = {};
    if (existsSync(this.file)) {
      try {
        loaded = JSON.parse(readFileSync(this.file, 'utf8')) as Partial<Settings>;
      } catch {
        // Corrupt settings fall back to defaults rather than blocking startup.
      }
    }
    const base = defaultSettings();
    this.cached = {
      ...base,
      ...loaded,
      solver: { ...base.solver, ...loaded.solver },
      defaults: { ...base.defaults, ...loaded.defaults },
      version: 1,
    };
    return this.cached;
  }

  set(settings: Settings): Settings {
    this.cached = { ...settings, version: 1 };
    mkdirSync(path.dirname(this.file), { recursive: true });
    // Write-then-rename so a crash mid-write can't corrupt the file.
    const tmp = this.file + '.tmp';
    writeFileSync(tmp, JSON.stringify(this.cached, null, 2) + '\n');
    renameSync(tmp, this.file);
    return this.cached;
  }
}
