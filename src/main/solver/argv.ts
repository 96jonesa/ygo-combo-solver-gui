import type { CommonRunOptions, RunSpec } from '../../shared/types';

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
  return argv;
}

export function buildArgv(spec: RunSpec): string[] {
  // Deterministic order: positional replay, workflow flags, common flags, extra args.
  const argv: string[] = [spec.replay];
  switch (spec.kind) {
    case 'verify':
      break; // verify is the bare invocation: replay + no --solve
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
