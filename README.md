# ygo-combo-solver-gui

A desktop GUI for [ygo-combo-solver](https://github.com/Armytille/ygo-combo-solver) — Armytille's Yu-Gi-Oh! combo solver, which searches for combo lines: given an EDOPro replay (or a decklist and a described board), it finds move sequences that reach a target end board — cheaper lines, lines from different opening hands, lines that hold up under interruption — and writes them as `.yrp` replays that open in [EDOPro](https://projectignis.github.io/).

The solver is a powerful but demanding command-line tool: 124 flags, a constraint mini-grammar, and a plain-text report. This app wraps its common workflows in guided forms so you can go from "I have a replay" to "EDOPro is playing a cheaper line" without touching a terminal.

Targets **macOS** and **Windows**.

## Status

**Feature-complete on macOS; release engineering (M4) in progress.** M0–M3 are merged: all five workflows, the card picker over EDOPro's databases, health banners, live status, ranked results with open-in-EDOPro, run history, and a natively ported solver ([fork](https://github.com/96jonesa/ygo-combo-solver)) bundled for macOS (arm64) with full dirty-page-tracking performance. The complete loop — record a duel in EDOPro, verify it, solve for cheaper lines, watch the solution back in EDOPro — works today. Remaining: Windows solver artifact + installer, mac signing/notarization. Design docs:

| Document | Contents |
| --- | --- |
| [PRD](docs/PRD.md) | Goals, users, the five MVP workflows, feature requirements, platform strategy, risks, milestones |
| [TDD](docs/TDD.md) | Electron architecture, solver-runner abstraction, argv serialization, stdout parser contract, storage, packaging, testing |

Work is tracked in [Linear](https://linear.app/ygo-combo-solver-gui). To get running, start with the [Installation & Setup guide](docs/INSTALL.md); the [User Guide](docs/GUIDE.md) covers everything after that.

## Development

```sh
npm install
npm run dev        # launch the app with hot reload
npm test           # unit + integration tests (vitest)
npm run typecheck  # strict tsc
npm run build      # production bundles into out/
```

Releases are produced by `.github/workflows/release.yml`: pushing a version tag (`vX.Y.Z`, matching `package.json`) builds both installers — each with the solver compiled from the locked commit, gate-checked on Windows — and attaches them to a **draft** GitHub Release for manual review and publishing. A `workflow_dispatch` run of the same workflow is a dry run (workflow artifacts, no release).

Solver artifacts are not checked in; `solver.lock.json` pins the [fork](https://github.com/96jonesa/ygo-combo-solver) commit they must be built from. On macOS, `scripts/build-solver.sh` builds the pinned solver (native arm64, requires a sibling `ygo-combo-solver` clone with its dependency layout — see that repo's README) and installs it under `resources/solver/mac/`, where the app picks it up automatically. On Windows, drop a `combosolver.exe` built from the same commit under `resources/solver/win/`. Without an artifact, point **Settings → Solver path** at `scripts/fake-solver.mjs` — a stand-in that emits solver-shaped output and writes fake solution files.

## What it does

- **Verify a replay** — health-check that a replay reproduces under your card scripts before spending a solve budget on it
- **Find a cheaper line** — same end board, fewer cards spent
- **Solve from another deck/hand** — reach a reference board from a different `.ydk` decklist or opening hand
- **Build a described board** — no reference line, just "get me these cards in these zones", composed with a card picker
- **Test against interruption** — prove a line converts through a handtrap or opposing card

Plus: live solver log with health/status parsing, ranked results with one-click open in EDOPro, run history with duplicate-and-tweak, and a raw extra-arguments escape hatch so the GUI is never less capable than the CLI.

## How it works

Electron + TypeScript. The GUI drives the solver as a black-box subprocess: serialize the form to CLI flags, stream its stdout live, then rank the `.yrp` files it writes. Both platforms spawn a native solver binary built from the commit pinned in `solver.lock.json` — arm64 on macOS (ported in the [fork](https://github.com/96jonesa/ygo-combo-solver): mmap arena backing + an mprotect fault-handler dirty-page tracker), x64 on Windows. The card picker reads your EDOPro install's own card databases, so cards are always submitted by exact passcode.

Requires a local [EDOPro (Project Ignis)](https://projectignis.github.io/) installation — the solver reads its card databases and scripts, and results open in it.

## Roadmap

| Milestone | Contents | Status |
| --- | --- | --- |
| M0 | Electron skeleton: settings, EDOPro detection, solver spawn, raw log streaming | done |
| M1 | Core loop: verify + cheaper-line workflows, results, run history | done |
| M2 | Remaining MVP forms: deck/hand, described board with card picker, interruption test | done |
| M3 | macOS: natively ported solver, bundling + provenance | done |
| M4 | Release: installers, license compliance, docs | in progress |

## License

GNU Affero General Public License version 3 or later — matching the solver it bundles (which statically links ocgcore, also AGPL). Full text in [LICENSE](LICENSE), component notices in [NOTICE](NOTICE). Each bundled solver binary ships with the solver's own LICENSE/NOTICE beside it, and its manifest records the exact source commit it was built from.
