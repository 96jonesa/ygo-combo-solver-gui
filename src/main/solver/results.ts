import { existsSync, readdirSync } from 'node:fs';
import type { RunArtifact } from '../../shared/types';

/**
 * Classifies the files the solver wrote to an outdir by filename
 * (TDD §10.3). The names are produced by the solver's own printf
 * patterns and encode the ranking, so no log parsing is needed.
 */

const SOLUTION = /^solution_(\d+)_b(\d+)_a(\d+)(_alt)?\.yrp$/;
const APPROACH = /^best_approach_(\d+)of(\d+)\.yrp$/;
const JOINT = /^best_joint_(\d+)r_(\d+)of(\d+)\.yrp$/;
const REJECTED = /^but_rejete_(\d+)_(retry|constraint|board)\.yrp$/;

export function classifyArtifact(file: string): RunArtifact {
  let match: RegExpMatchArray | null;
  if ((match = file.match(SOLUTION))) {
    return {
      file,
      kind: 'solution',
      rank: Number(match[1]),
      burned: Number(match[2]),
      actions: Number(match[3]),
      alt: match[4] !== undefined,
    };
  }
  if ((match = file.match(APPROACH))) {
    return { file, kind: 'approach', reached: Number(match[1]), of: Number(match[2]) };
  }
  if ((match = file.match(JOINT))) {
    return {
      file,
      kind: 'joint',
      rips: Number(match[1]),
      reached: Number(match[2]),
      of: Number(match[3]),
    };
  }
  if ((match = file.match(REJECTED))) {
    return {
      file,
      kind: 'rejected',
      index: Number(match[1]),
      reason: match[2] as 'retry' | 'constraint' | 'board',
    };
  }
  return { file, kind: 'other' };
}

const KIND_ORDER: Record<RunArtifact['kind'], number> = {
  solution: 0,
  approach: 1,
  joint: 2,
  rejected: 3,
  other: 4,
};

/**
 * Scan an outdir into classified artifacts: solutions first, sorted by
 * the solver's own cost order (burned, then actions); everything else
 * after, grouped by kind. Unmatched files are listed, never hidden.
 */
export function scanOutdir(outdir: string): RunArtifact[] {
  if (!existsSync(outdir)) return [];
  const artifacts = readdirSync(outdir, { withFileTypes: true })
    .filter((e) => e.isFile())
    .map((e) => classifyArtifact(e.name));
  return artifacts.sort((a, b) => {
    if (a.kind !== b.kind) return KIND_ORDER[a.kind] - KIND_ORDER[b.kind];
    if (a.kind === 'solution' && b.kind === 'solution') {
      return a.burned - b.burned || a.actions - b.actions || a.rank - b.rank;
    }
    return a.file.localeCompare(b.file);
  });
}
