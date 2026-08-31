import { copyFileSync, existsSync, mkdirSync } from 'node:fs';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { findEdoproExe } from './probe';

/**
 * "Open in EDOPro" (TDD §9.3): EDOPro lists replays from
 * <workdir>/replay/, so copy the .yrp there under a collision-safe name
 * and launch EDOPro; the user picks it from the replay list. The copy
 * also persists the replay inside EDOPro regardless of how launch goes.
 */

export interface LaunchPlan {
  program: string;
  args: string[];
}

/** Pure: how to launch the EDOPro executable on a given platform. */
export function buildLaunchPlan(exePath: string, platform: NodeJS.Platform): LaunchPlan {
  if (platform === 'darwin' && exePath.endsWith('.app')) return { program: 'open', args: [exePath] };
  return { program: exePath, args: [] };
}

/** Copy a replay into <workdir>/replay/ under a collision-safe name. */
export function copyIntoReplayDir(workdir: string, replayPath: string, runId: string): string {
  const replayDir = path.join(workdir, 'replay');
  mkdirSync(replayDir, { recursive: true });
  const target = path.join(replayDir, `gui_${runId}_${path.basename(replayPath)}`);
  copyFileSync(replayPath, target);
  return target;
}

export function openReplayInEdopro(
  workdir: string,
  replayPath: string,
  runId: string,
): { ok: boolean; copiedTo?: string; error?: string } {
  if (!existsSync(replayPath)) return { ok: false, error: `replay not found: ${replayPath}` };
  const exe = findEdoproExe(workdir);
  if (exe === null)
    return { ok: false, error: 'EDOPro executable not found in the configured install' };
  const copiedTo = copyIntoReplayDir(workdir, replayPath, runId);
  const plan = buildLaunchPlan(exe, process.platform);
  const child = spawn(plan.program, plan.args, { detached: true, stdio: 'ignore' });
  child.on('error', () => {
    // Launch failure still leaves the copy in place; surfaceable later.
  });
  child.unref();
  return { ok: true, copiedTo };
}
