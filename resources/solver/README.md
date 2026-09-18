# Solver artifacts land here

This directory is intentionally empty in git: solver binaries are never
committed. Each platform's artifact goes in a subdirectory —
`mac/combosolver` or `win/combosolver.exe`, each with its `manifest.json`
and the solver's `LICENSE`/`NOTICE` beside it.

- The commit every artifact must be built from is pinned in
  [`solver.lock.json`](../../solver.lock.json).
- macOS: `scripts/build-solver.sh` builds and installs it here.
- Windows: download the matching CI artifact from the
  [solver fork's Actions](https://github.com/96jonesa/ygo-combo-solver/actions).
- `npm run check:artifacts` verifies whatever is here against the lockfile.

Full instructions: [docs/INSTALL.md](../../docs/INSTALL.md).
