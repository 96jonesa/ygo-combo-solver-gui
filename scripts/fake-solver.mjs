#!/usr/bin/env node
/**
 * Development stand-in for combosolver.exe on machines without a solver
 * build (point Settings → Solver path at this file). Emits output shaped
 * like the real solver's report, honors --solve-ms as its runtime, and
 * exits 0. Not a mock for tests — those script a mock SolverRunner.
 */

const argv = process.argv.slice(2);
const replay = argv[0] ?? '(no replay)';
const solveMsIndex = argv.indexOf('--solve-ms');
const budgetMs = solveMsIndex >= 0 ? Number(argv[solveMsIndex + 1]) : 5000;
const runtimeMs = Math.min(budgetMs, 15_000);
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

console.log('fake-solver (development stand-in, not the real engine)');
console.log(`replay: ${replay}`);
console.log(`argv: ${argv.join(' ')}`);
console.log('');
console.log('loading');
console.log('  cards             : 13842 from 34 database(s)  (412 ms)');
console.log('  script dirs       : 12');
await sleep(300);
console.log('');
console.log('results');
console.log('  answers consumed    : 284 / 284');
console.log('  MSG_RETRY           : 0   (faithful replay)');
console.log('  seed: 888  (--seed 888 to replay)');
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
