import type { CardRef, CommonRunOptions, RunSpec, TargetSpec } from '../../shared/types';

/**
 * Single source of truth mapping RunSpecs to solver argv (TDD §6).
 * The command preview shown in the renderer comes from the same
 * function that spawns, so the two can never drift.
 */

/**
 * Split an extra-arguments string shlex-style: whitespace-separated
 * tokens, single or double quotes group, backslash escapes the next
 * character outside single quotes. No shell interpolation of any kind.
 */
export function splitExtraArgs(input: string): string[] {
  const args: string[] = [];
  let current = '';
  let started = false;
  let quote: '"' | "'" | null = null;
  for (let i = 0; i < input.length; i++) {
    const ch = input[i]!;
    if (quote === "'") {
      if (ch === "'") quote = null;
      else current += ch;
    } else if (ch === '\\' && i + 1 < input.length) {
      current += input[++i]!;
      started = true;
    } else if (quote === '"') {
      if (ch === '"') quote = null;
      else current += ch;
    } else if (ch === '"' || ch === "'") {
      quote = ch;
      started = true;
    } else if (/\s/.test(ch)) {
      if (started) {
        args.push(current);
        current = '';
        started = false;
      }
    } else {
      current += ch;
      started = true;
    }
  }
  if (quote !== null) throw new Error(`unterminated ${quote} quote in extra arguments`);
  if (started) args.push(current);
  return args;
}

function commonFlags(common: CommonRunOptions): string[] {
  const argv: string[] = [];
  if (common.workdir !== undefined) argv.push('--workdir', common.workdir);
  for (const dir of common.scriptdirs ?? []) argv.push('--scriptdir', dir);
  if (common.outdir !== undefined) argv.push('--outdir', common.outdir);
  if (common.solveMs !== undefined) argv.push('--solve-ms', String(common.solveMs));
  if (common.threads !== undefined) argv.push('--threads', String(common.threads));
  if (common.seed !== undefined) argv.push('--seed', String(common.seed));
  if (common.maxWritten !== undefined) argv.push('--max-written', String(common.maxWritten));
  // Machine-readable @event lines: the parser consumes them first and falls
  // back to report regexes. Solvers older than the fork's --json flag will
  // reject this as an unknown option — the bundled solver is never older.
  argv.push('--json');
  return argv;
}

/** Cards in a hand-style list flag are pipe-joined passcodes: "1|2|3". */
function pipeJoin(cards: CardRef[]): string {
  return cards.map((c) => String(c.passcode)).join('|');
}

/** --target grammar: code@zone with :fd for face-down (zone always explicit). */
function targetArg(target: TargetSpec): string {
  return `${target.card.passcode}@${target.zone}${target.facedown ? ':fd' : ''}`;
}

export function buildArgv(spec: RunSpec): string[] {
  // Deterministic order: positional replay, workflow flags, common flags, extra args.
  const argv: string[] = [spec.replay];
  switch (spec.kind) {
    case 'verify':
      break; // verify is the bare invocation: replay + no --solve
    case 'optimize':
      argv.push('--solve', '--optimize');
      break;
    case 'deckhand':
      // --deck implies --solve.
      argv.push('--deck', spec.deck);
      if (spec.hand.length > 0) argv.push('--hand', pipeJoin(spec.hand));
      break;
    case 'board':
      argv.push('--no-ref', '--deck', spec.deck);
      if (spec.hand.length > 0) argv.push('--hand', pipeJoin(spec.hand));
      for (const target of spec.targets) argv.push('--target', targetArg(target));
      break;
    case 'fire':
      // --fire implies --solve; repeats count for repeated targets.
      for (const card of spec.fire) argv.push('--fire', String(card.passcode));
      for (const card of spec.fireSpare) argv.push('--fire-spare', String(card.passcode));
      if (spec.oppHand.length > 0) argv.push('--opp-hand', pipeJoin(spec.oppHand));
      for (const guard of spec.guards) argv.push('--guard', guard);
      break;
  }
  argv.push(...commonFlags(spec.common));
  if (spec.common.extraArgs?.trim()) argv.push(...splitExtraArgs(spec.common.extraArgs));
  return argv;
}

/** Quote a token for display only; the spawn always receives the raw array. */
function displayToken(token: string): string {
  if (token === '' || /[\s"'\\]/.test(token)) return `"${token.replaceAll('"', '\\"')}"`;
  return token;
}

export function displayCommand(program: string, argv: string[]): string {
  return [program, ...argv].map(displayToken).join(' ');
}
