# ygo-combo-solver-gui

A desktop GUI for [ygo-combo-solver](https://github.com/Armytille/ygo-combo-solver) — Armytille's Yu-Gi-Oh! combo solver, which searches for combo lines: given an EDOPro replay (or a decklist and a described board), it finds move sequences that reach a target end board — cheaper lines, lines from different opening hands, lines that hold up under interruption — and writes them as `.yrp` replays that open in [EDOPro](https://projectignis.github.io/).

The solver is a powerful but demanding command-line tool: 124 flags, a constraint mini-grammar, and a plain-text report. This app wraps its common workflows in guided forms so you can go from "I have a replay" to "EDOPro is playing a cheaper line" without touching a terminal.

Targets **macOS** and **Windows**.

## Status

**In development — M2 (full MVP forms).** Merged so far: M0 (Electron skeleton: settings, EDOPro detection, solver spawning, live log streaming) and M1 (verify + cheaper-line workflows, health banners, live status, ranked results, run history). M2 adds the card picker over EDOPro's card databases and the remaining workflows: solve from another deck/hand, build a described board, and test against interruption. Design docs:

| Document | Contents |
| --- | --- |
| [PRD](docs/PRD.md) | Goals, users, the five MVP workflows, feature requirements, platform strategy, risks, milestones |
| [TDD](docs/TDD.md) | Electron architecture, solver-runner abstraction, argv serialization, stdout parser contract, storage, packaging, testing |

Work is tracked in [Linear](https://linear.app/ygo-combo-solver-gui).

## Development

```sh
npm install
npm run dev        # launch the app with hot reload
npm test           # unit + integration tests (vitest)
npm run typecheck  # strict tsc
npm run build      # production bundles into out/
```

No solver binary ships with the repo yet. To exercise the full run loop on any machine, point **Settings → Solver path** at `scripts/fake-solver.mjs` — a stand-in that emits solver-shaped output, honors `--solve-ms`, and writes fake solution files. The real `combosolver.exe` works today on Windows via the same setting; macOS solving arrives with the M3 wasm build.

## What the MVP will do

- **Verify a replay** — health-check that a replay reproduces under your card scripts before spending a solve budget on it
- **Find a cheaper line** — same end board, fewer cards spent
- **Solve from another deck/hand** — reach a reference board from a different `.ydk` decklist or opening hand
- **Build a described board** — no reference line, just "get me these cards in these zones", composed with a card picker
- **Test against interruption** — prove a line converts through a handtrap or opposing card

Plus: live solver log with health/status parsing, ranked results with one-click open in EDOPro, run history with duplicate-and-tweak, and a raw extra-arguments escape hatch so the GUI is never less capable than the CLI.

## How it works (planned)

Electron + TypeScript. The GUI drives the solver as a black-box subprocess: serialize the form to CLI flags, stream its stdout live, then rank the `.yrp` files it writes. On Windows it spawns the native `combosolver.exe`; on macOS it runs the solver's WebAssembly build on Electron's bundled Node (≈0.9× native speed, identical CLI). The card picker reads your EDOPro install's own card databases, so cards are always submitted by exact passcode.

Requires a local [EDOPro (Project Ignis)](https://projectignis.github.io/) installation — the solver reads its card databases and scripts, and results open in it.

## Roadmap

| Milestone | Contents |
| --- | --- |
| M0 | Electron skeleton: settings, EDOPro detection, solver spawn, raw log streaming (Windows) |
| M1 | Core loop: verify + cheaper-line workflows, results, run history |
| M2 | Remaining MVP forms: deck/hand, described board with card picker, interruption test |
| M3 | macOS: wasm solver on Electron's Node, mac packaging |
| M4 | Release: installers, license compliance, docs |

## License

Not yet chosen — the solver is AGPL-3.0-or-later, and how that shapes this repo's license is an open question tracked in the [PRD](docs/PRD.md#11-open-questions). Until a license file lands, all rights reserved.
