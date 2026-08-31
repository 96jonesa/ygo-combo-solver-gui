import { existsSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import type { WorkdirHealth } from '../../shared/types';

/**
 * Validates an EDOPro install directory (TDD §9.1), mirroring how the
 * solver collects assets: cards.cdb only if non-empty, then recursive
 * .cdb scans of expansions/ and repositories/; script roots at
 * repositories/x/script, expansions/script, script.
 */
export function probeWorkdir(workdir: string): WorkdirHealth {
  const problems: string[] = [];
  if (!existsSync(workdir) || !statSync(workdir).isDirectory()) {
    return {
      ok: false,
      workdir,
      cardDbs: [],
      scriptRoots: [],
      edoproExe: null,
      problems: ['directory does not exist'],
    };
  }

  const cardDbs: string[] = [];
  const rootCdb = path.join(workdir, 'cards.cdb');
  if (existsSync(rootCdb)) {
    if (statSync(rootCdb).size > 0) cardDbs.push(rootCdb);
    else problems.push('cards.cdb is empty (treated as missing, matching the solver)');
  }
  for (const sub of ['expansions', 'repositories']) {
    cardDbs.push(...findFilesRecursive(path.join(workdir, sub), '.cdb'));
  }
  if (cardDbs.length === 0) problems.push('no card databases (.cdb) found');

  const scriptRoots = [
    ...listSubdirs(path.join(workdir, 'repositories')).map((d) => path.join(d, 'script')),
    path.join(workdir, 'expansions', 'script'),
    path.join(workdir, 'script'),
  ].filter((dir) => existsSync(dir) && statSync(dir).isDirectory());
  if (scriptRoots.length === 0) problems.push('no card script directories found');

  const edoproExe = findEdoproExe(workdir);
  if (edoproExe === null)
    problems.push('EDOPro executable not found (open-in-EDOPro will be unavailable)');

  // The executable is a convenience, not a requirement, for a solver run.
  const ok = cardDbs.length > 0 && scriptRoots.length > 0;
  return { ok, workdir, cardDbs, scriptRoots, edoproExe, problems };
}

/** Platform-conventional install locations tried before asking the user. */
export function candidateWorkdirs(platform: NodeJS.Platform, home: string): string[] {
  if (platform === 'win32') return ['C:\\ProjectIgnis', 'C:\\Games\\ProjectIgnis'];
  return [path.join(home, 'ProjectIgnis'), '/Applications/ProjectIgnis'];
}

export function findEdoproExe(workdir: string): string | null {
  for (const name of ['EDOPro.exe', 'EDOPro.app', 'EDOPro']) {
    const candidate = path.join(workdir, name);
    if (existsSync(candidate)) return candidate;
  }
  return null;
}

function listSubdirs(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true })
    .filter((e) => e.isDirectory() && !e.name.startsWith('.'))
    .map((e) => path.join(dir, e.name))
    .sort();
}

function findFilesRecursive(dir: string, ext: string): string[] {
  if (!existsSync(dir)) return [];
  const found: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) found.push(...findFilesRecursive(full, ext));
    else if (entry.isFile() && entry.name.toLowerCase().endsWith(ext) && statSync(full).size > 0)
      found.push(full);
  }
  return found.sort();
}
