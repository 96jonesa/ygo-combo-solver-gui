import { existsSync } from 'node:fs';
import type { RunSpec } from '../../shared/types';

/**
 * Pre-launch validation (PRD §5.2.2): structured errors instead of a
 * spawned process that exits 2. Returns human-readable problems; empty
 * means the spec is launchable.
 */
export function validateSpec(spec: RunSpec, opts: { checkPaths?: boolean } = {}): string[] {
  const checkPaths = opts.checkPaths ?? true;
  const problems: string[] = [];

  if (spec.replay.trim() === '') problems.push('pick a replay file');
  else if (checkPaths && !existsSync(spec.replay))
    problems.push(`replay not found: ${spec.replay}`);

  if (spec.kind === 'deckhand' || spec.kind === 'board') {
    if (spec.deck.trim() === '') problems.push('pick a .ydk decklist');
    else {
      if (!spec.deck.toLowerCase().endsWith('.ydk'))
        problems.push('the decklist must be a .ydk file');
      if (checkPaths && !existsSync(spec.deck)) problems.push(`decklist not found: ${spec.deck}`);
    }
  }

  if (spec.kind === 'board' && spec.targets.length === 0)
    problems.push('describe at least one target card');

  if (spec.kind === 'fire' && spec.fire.length === 0)
    problems.push('pick at least one card to fire');

  const solveMs = spec.common.solveMs;
  if (solveMs !== undefined && (!Number.isFinite(solveMs) || solveMs < 1000))
    problems.push('budget must be at least 1 second');
  const threads = spec.common.threads;
  if (threads !== undefined && (!Number.isInteger(threads) || threads < 1))
    problems.push('threads must be a positive integer');

  // The solver refuses --deck with --start; forms never emit --start,
  // but the extra-args escape hatch can. Catch the one known fatal mix.
  if (
    (spec.kind === 'deckhand' || spec.kind === 'board') &&
    spec.common.extraArgs !== undefined &&
    /(^|\s)--start(\s|$)/.test(spec.common.extraArgs)
  )
    problems.push('--start (extra arguments) cannot be combined with a --deck workflow');

  return problems;
}
