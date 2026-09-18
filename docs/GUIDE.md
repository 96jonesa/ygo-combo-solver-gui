# User Guide: YGO Combo Solver

| Status | Author | Date | Tracking | Related |
| --- | --- | --- | --- | --- |
| Current | Andy (with Claude) | 2026-09-17 | [YGO-11](https://linear.app/ygo-combo-solver-gui/issue/YGO-11/m4-release-installers-license-compliance-docs) | [README](../README.md), [PRD](PRD.md) |

## What this app does

The app is a desktop frontend for [ygo-combo-solver](https://github.com/96jonesa/ygo-combo-solver): given a Yu-Gi-Oh! duel recorded in EDOPro, it searches for other legal move sequences that reach the same end board — cheaper lines, lines from a different hand or deck, lines that survive an opposing card — and writes them as replays you can watch in EDOPro. The engine is the real ocgcore rules engine, so every result is a legal, playable line.

## Install

See the [Installation & Setup guide](INSTALL.md) — it covers everything from a machine with no prerequisites to your first solve, on both platforms, with prebuilt-installer and build-from-source tracks.

## First-run setup (Settings tab)

- **EDOPro installation**: point it at your EDOPro folder (macOS default: `~/Applications/ProjectIgnis`). The panel below reports what was found — card databases, script directories, and whether the EDOPro executable was located (that arms the *Open in EDOPro* button). The card index line should report tens of thousands of cards; that index powers the card-search pickers.
- **Card script override**: leave empty for normal use. See [Replays and card scripts](#replays-and-card-scripts) for when to fill it.
- **Solver**: leave on "bundled" — the app ships its own solver binary, built from the exact source commit recorded next to it.

## The one rule: verify first

A replay only reproduces under card scripts contemporary with its recording. Under mismatched scripts the engine silently plays a *different duel* and every result describes a game that never happened. The app surfaces this as the health banner:

- **Green — "faithful replay, MSG_RETRY 0"**: trust everything downstream.
- **Red — "MSG_RETRY N"**: stop; nothing from this run is meaningful. See [Troubleshooting](#troubleshooting).

Run the *Verify a replay* workflow once for every new replay before spending a real search budget on it.

## Workflows (Run tab)

| Workflow | Question it answers |
| --- | --- |
| Verify a replay | Does this recording reproduce under my card scripts? |
| Find a cheaper line | Can the same end board be reached spending fewer cards? |
| Solve from another deck/hand | Can a different decklist (or a forced opening hand) reach this board? |
| Build a described board | Is this board — described card by card — reachable from this deck at all? |
| Test against interruption | Does the line still convert when the opponent resolves a card against it? |

Common controls: a time budget (the solver is *anytime* — it reports the best lines found when the budget expires; difficult boards deserve a full budget and a retry before concluding "unreachable"), threads, and a seed (shown after every run; rerunning with the same seed and one thread reproduces a search exactly). The **Extra arguments** field appends anything to the command line — the [solver's full flag reference](https://github.com/96jonesa/ygo-combo-solver#flag-reference) is available there, and the command preview always shows exactly what will run.

Card pickers search by name and always submit exact card IDs, so ambiguous-name errors can't happen. Add a card twice to require two copies.

**Stopping a run is safe**: the Stop button asks the solver to finish up — it ends the search where it stands and writes every solution found so far, usually within a second or two. (A solver that doesn't respond is force-killed after a grace period.)

## Results

Solutions are ranked the way the solver ranks them: fewest **burned** cards (sent to grave/banished) first, then fewest **actions**. Beside solutions you may see *best approach* files (closest partial board — not a solution, but reusable as a search seed) and *rejected witnesses* (near-misses that failed verification, kept for diagnosis).

Per result: **Open in EDOPro** copies the replay into EDOPro's replay folder and launches it — pick it from EDOPro's replay list. **Use as input** feeds it back into the form (solver outputs are valid inputs). **Reveal** shows the file.

The **History** tab keeps every run — outcome, exact command, seed, solver version, results — and **Duplicate run** reloads any past configuration into the form.

## Replays and card scripts

Card scripts update constantly upstream. A replay recorded *today* wants *today's* scripts — which your EDOPro install provides automatically. A replay recorded months ago wants the scripts of *its* era: exporting them from the [CardScripts repository](https://github.com/ProjectIgnis/CardScripts) at a commit near the recording date and adding that directory under **Settings → Card script override** is what makes old replays verify green.

## Troubleshooting

| Symptom | Likely cause and fix |
| --- | --- |
| Red MSG_RETRY banner on a fresh replay | The bundled solver's engine version is older than your EDOPro client's. Check for an app update; or report it — the solver pin needs bumping. |
| Red MSG_RETRY banner on an old replay | Script era mismatch — add an era-matched script export as a Card script override (see above). |
| "REQUESTED but INERT" lines in the log | The solver ignoring an option that has no effect in this mode. Informational, not an error. |
| Card pickers greyed out | No usable card database — fix the EDOPro directory in Settings until the probe goes green. |
| *Open in EDOPro* greyed out | The probe didn't find the EDOPro executable in the configured directory. |
| `scripts not found (1): c0.lua` | Harmless — a placeholder card id with no script. |
| Stopped run has no results | The stop came before any solution existed (e.g. seconds into a hard board) — nothing to collect yet. |

## License

AGPL-3.0-or-later, like the solver it bundles. Sources: [GUI](https://github.com/96jonesa/ygo-combo-solver-gui) · [solver](https://github.com/96jonesa/ygo-combo-solver). Each bundled solver binary records the exact commit it was built from in a `manifest.json` beside it.
