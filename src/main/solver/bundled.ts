import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

/**
 * Locating the bundled solver (TDD §12): artifacts live under
 * resources/solver/<platform>/ next to a manifest.json recording the
 * solver commit they were built from, written by scripts/build-solver.sh.
 * Artifacts are not in git; the settings override covers machines
 * without one (e.g. scripts/fake-solver.mjs for development).
 */

export interface SolverManifest {
  solverCommit?: string;
  target?: string;
  builtAt?: string;
}

/** Path segments of the bundled solver binary for a platform. */
export function bundledSolverRelPath(platform: NodeJS.Platform): string[] {
  if (platform === 'win32') return ['resources', 'solver', 'win', 'combosolver.exe'];
  if (platform === 'darwin') return ['resources', 'solver', 'mac', 'combosolver'];
  return ['resources', 'solver', 'linux', 'combosolver'];
}

/** Best-effort read of the manifest sitting next to a solver binary. */
export function readSolverManifest(solverPath: string): SolverManifest {
  const manifestPath = path.join(path.dirname(solverPath), 'manifest.json');
  if (!existsSync(manifestPath)) return {};
  try {
    return JSON.parse(readFileSync(manifestPath, 'utf8')) as SolverManifest;
  } catch {
    return {};
  }
}
