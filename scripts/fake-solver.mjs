#!/usr/bin/env node
/**
 * Development stand-in for combosolver.exe on machines without a solver
 * build (point Settings → Solver path at this file). Emits output shaped
 * like the real solver's report, honors --solve-ms as its runtime, and
 * exits 0. Not a mock for tests — those script a mock SolverRunner.
 */

const argv = process.argv.slice(2);
const replay = argv[0] ?? '(no replay)';
const flagValue = (name) => {
  const index = argv.indexOf(name);
  return index >= 0 ? Number(argv[index + 1]) : undefined;
};
const budgetMs = flagValue('--solve-ms') ?? 5000;
const runtimeMs = Math.min(budgetMs, 15_000);
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Failure simulation, driven from the GUI's extra-arguments field:
//   --fake-retry N   report MSG_RETRY N (red health banner path)
//   --fake-inert     emit an "!! INERT" flag warning
//   --fake-exit N    exit with code N (2 = usage error, 1 = load/health)
const fakeRetry = flagValue('--fake-retry') ?? 0;
const fakeInert = argv.includes('--fake-inert');
const fakeExit = flagValue('--fake-exit') ?? 0;

if (fakeExit === 2) {
  console.log('!! unknown option --such-nonsense (simulated by --fake-exit 2)');
  process.exit(2);
}

console.log('fake-solver (development stand-in, not the real engine)');
console.log(`replay: ${replay}`);
console.log(`argv: ${argv.join(' ')}`);
console.log('');
console.log('loading');
console.log('  cards             : 13842 from 34 database(s)  (412 ms)');
console.log('  script dirs       : 12');
if (fakeInert) console.log('  --burn-limit 3 !! INERT (no --solve: nothing to limit)');
await sleep(300);
console.log('');
console.log('results');
if (fakeRetry > 0) {
  console.log(`  answers consumed    : ${284 - fakeRetry} / 284`);
  console.log(`  MSG_RETRY           : ${fakeRetry}`);
  console.log('!! replay diverged: card scripts do not match the recording (simulated)');
  console.log('  self-checks  : FAIL, snapshot stress ok');
  process.exit(1);
}
console.log('  answers consumed    : 284 / 284');
console.log('  MSG_RETRY           : 0   (faithful replay)');
console.log('  seed: 888  (--seed 888 to replay)');
if (fakeExit === 1) {
  console.log('!! arena init failed (simulated by --fake-exit 1)');
  process.exit(1);
}
console.log('');
console.log('--- bounded-discrepancy search around the plan ---');
const start = Date.now();
let rung = 0;
while (Date.now() - start < runtimeMs) {
  await sleep(Math.min(1000, runtimeMs - (Date.now() - start)));
  console.log(
    `  ${rung}                 ${rung >= 2 ? 1 : 0}        ${184213 * (rung + 1)}      ${(((Date.now() - start) / 1000)).toFixed(1)} s`,
  );
  rung += 1;
}
if (argv.includes('--fire')) {
  console.log('');
  console.log('--- injection windows ---');
  console.log('  window 1: converted (full board)');
  console.log('  window 2: converted (without the sacrificed card)');
  console.log('  window 3: failed');
  console.log('=== --fire verdict: 2 window(s) out of 3 converted (1 full board, 1 without the sacrificed card) ===');
}
console.log('');
console.log('--- output ---');
// Write fake artifacts so the results panel has something to list.
const outdirIndex = argv.indexOf('--outdir');
if (outdirIndex >= 0 && argv[outdirIndex + 1]) {
  const { writeFileSync, mkdirSync } = await import('node:fs');
  const { join } = await import('node:path');
  const outdir = argv[outdirIndex + 1];
  mkdirSync(outdir, { recursive: true });
  for (const name of ['solution_00_b1_a9.yrp', 'solution_01_b2_a7.yrp', 'best_approach_5of8.yrp'])
    writeFileSync(join(outdir, name), 'fake replay bytes');
  console.log('  2 replay(s) written to solutions  (out of 5 candidate(s))');
} else {
  console.log('  0 replay(s) written to solutions');
}
process.exit(0);
