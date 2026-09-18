#!/usr/bin/env node
// Same-commit artifact check (PRD §9): every bundled solver artifact must be
// built from the commit pinned in solver.lock.json, and the platforms must
// therefore match each other. Absent artifacts are skipped (dev machines
// usually carry one platform); present-but-wrong fails the build.
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const lock = JSON.parse(readFileSync(path.join(root, 'solver.lock.json'), 'utf8'));

let checked = 0;
let failed = false;
for (const platform of ['mac', 'win', 'linux']) {
  const manifestPath = path.join(root, 'resources', 'solver', platform, 'manifest.json');
  if (!existsSync(manifestPath)) continue;
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  checked += 1;
  if (manifest.solverCommit === lock.commit) {
    console.log(`ok   ${platform}: ${manifest.solverCommit.slice(0, 12)} matches solver.lock.json`);
  } else {
    console.error(
      `FAIL ${platform}: manifest ${manifest.solverCommit?.slice(0, 12)} != lock ${lock.commit.slice(0, 12)}`,
    );
    failed = true;
  }
}
if (checked === 0) console.log('no solver artifacts present; nothing to check');
process.exit(failed ? 1 : 0);
