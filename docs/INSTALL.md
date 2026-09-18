# Installation & Setup

| Status | Author | Date | Tracking | Related |
| --- | --- | --- | --- | --- |
| Current | Andy (with Claude) | 2026-09-18 | [YGO-16](https://linear.app/ygo-combo-solver-gui/issue/YGO-16/installation-and-setup-guide-zero-to-running-on-mac-and-windows) | [User Guide](GUIDE.md), [README](../README.md) |

From nothing to your first solve, on macOS (Apple Silicon) or Windows (x64). Two tracks after the EDOPro step: **Track A** installs a prebuilt app (no developer tools needed); **Track B** builds from source. If a Track A installer isn't published for your platform yet, use Track B.

## Step 1 — Install EDOPro (everyone)

The app reads card databases and scripts from a local [EDOPro (Project Ignis)](https://projectignis.github.io/) installation, and results open in it.

**Windows**: download the installer from the [Project Ignis download page](https://projectignis.github.io/download.html) and run it (default location `C:\ProjectIgnis`).

**macOS**: download the macOS build from the same page. Gatekeeper will warn that the app "might contain malware" — this means *unsigned*, not *malicious* (Project Ignis doesn't buy an Apple certificate): right-click the app → **Open**, or allow it under System Settings → Privacy & Security. It installs to `~/Applications/ProjectIgnis`.

**Both**: launch EDOPro once and give it a minute on the menu screen — its updater downloads the current card databases and scripts on first run. Without this, the app's card search will be nearly empty.

## Step 2, Track A — Prebuilt app (no developer tools)

1. Download the installer for your platform from the [Releases page](https://github.com/96jonesa/ygo-combo-solver-gui/releases): the `.dmg` (macOS, Apple Silicon) or the `Setup.exe` (Windows).
2. Expect the same unsigned-app friction as EDOPro's: macOS → right-click → Open; Windows SmartScreen → **More info → Run anyway**.
3. Install and launch, then skip to [Step 3](#step-3--first-run-setup-in-the-app).

## Step 2, Track B — From source

### Prerequisites

- **git** ([git-scm.com](https://git-scm.com); on macOS, `xcode-select --install` provides it)
- **Node.js 22 LTS** — [nodejs.org](https://nodejs.org), or `winget install OpenJS.NodeJS.LTS` (Windows) / `brew install node@22` (macOS). **Version matters**: anything below 20.19 fails at launch with `ERR_REQUIRE_ESM`. Check with `node --version`; after installing, open a fresh terminal.

### Get and build the app

```sh
git clone https://github.com/96jonesa/ygo-combo-solver-gui
cd ygo-combo-solver-gui
npm install
```

If a later step complains **"Electron failed to install correctly"**, the ~100 MB Electron binary download was interrupted: run `node node_modules/electron/install.js` (silent on success), verify with `npx electron --version`. If the download itself is blocked (AV/proxy), retry with `ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/` set.

### Get the solver binary

The solver is bundled per platform under `resources/solver/` — a directory that is **git-ignored, so it doesn't exist after cloning; you create it**. `solver.lock.json` pins the exact [solver fork](https://github.com/96jonesa/ygo-combo-solver) commit the binary must come from, and `npm run check:artifacts` verifies what you put there.

**Windows** — download the prebuilt CI artifact:

1. Open the fork's [Actions page](https://github.com/96jonesa/ygo-combo-solver/actions/workflows/windows.yml), pick the newest green run on `master`, download the `combosolver-win-x64-…` artifact whose commit matches `solver.lock.json`.
2. `mkdir resources\solver\win`, then place these files from the zip **flat** into it: `combosolver.exe` and `manifest.json` (found under `bin/Release/` in the zip), plus `LICENSE` and `NOTICE` (zip root).

**macOS** — build it (one-time toolchain: `brew install premake`; compiler from `xcode-select --install`). The build script expects the solver repo and its dependency sources as siblings of this repo's parent:

```sh
cd ..
git clone https://github.com/96jonesa/ygo-combo-solver
git clone --depth 1 https://github.com/edo9300/edopro
git -C edopro submodule update --init ocgcore
git -C edopro/ocgcore submodule update --init lua/src
cd ygo-combo-solver-gui
./scripts/build-solver.sh
```

The script checks out the pinned commit in a temporary worktree, builds it, and installs the binary + manifest into `resources/solver/mac/`.

**Both platforms, verify**: `npm run check:artifacts` must print `ok <platform>: <commit> matches solver.lock.json`.

### Run it

```sh
npm run dev          # development mode, hot reload
# or build a real installer for your platform:
npm run package:mac  # → dist/*.dmg
npm run package:win  # → dist/*Setup*.exe
```

## Updating to a new version

There's no auto-updater yet — upgrading is a manual reinstall, and it keeps everything:

- **Track A (installer)**: download the newer `.dmg` / `Setup.exe` from [Releases](https://github.com/96jonesa/ygo-combo-solver-gui/releases) and install it over the existing app (Windows: run the new installer; macOS: replace the app in Applications).
- **Track B (source)**: `git pull`, then `npm install`, then rebuild/rebundle the solver only if `solver.lock.json` changed (`npm run check:artifacts` tells you — a FAIL means fetch/build the new pinned solver).

Your settings, EDOPro path, and full run history live in the OS's app-data directory (`~/Library/Application Support/ygo-combo-solver-gui` on macOS, `%APPDATA%\ygo-combo-solver-gui` on Windows), untouched by a reinstall — so an upgrade never loses them.

## Step 3 — First-run setup (in the app)

1. **Settings → EDOPro installation → Browse** to your install (`C:\ProjectIgnis` / `~/Applications/ProjectIgnis`). The probe panel should go green, report multiple databases and script directories, say **"EDOPro executable found"**, and show a card index of ~15,000+ cards. If the card count is tiny, EDOPro's first-run updater hasn't finished — launch EDOPro again and wait for it.
2. **Settings → Solver**: leave on "bundled".
3. **Settings → Card script override**: leave empty (it exists for replaying old recordings — see the [User Guide](GUIDE.md#replays-and-card-scripts)).

## Step 4 — Your first solve

1. In EDOPro: **Deck Editor** → pick any deck → **Hand Test** → play a few moves (summon, activate something) → end the duel and save the replay. It lands in EDOPro's `replay/` folder.
2. In the app: Run tab → **Verify a replay** → pick your recording → Run. You want the green **"faithful replay — MSG_RETRY 0"** banner ([why this matters](GUIDE.md#the-one-rule-verify-first)).
3. Switch to **Find a cheaper line** → Run → when it finishes, click **Open in EDOPro** on a result and watch the solver's line played back.

From here, the [User Guide](GUIDE.md) covers the workflows, reading results, and troubleshooting.

## Setup troubleshooting

| Symptom | Fix |
| --- | --- |
| `ERR_REQUIRE_ESM` on `npm run dev` | Node too old — install Node 22 LTS, open a fresh terminal, delete `node_modules`, `npm install` again |
| "Electron failed to install correctly" | `node node_modules/electron/install.js`, then `npx electron --version`; blocked download → `ELECTRON_MIRROR` (see above) |
| `rmdir`/delete of `node_modules` denied (Windows) | Close running app/editor/terminals holding it (check Task Manager for `node.exe`/`electron.exe`), retry |
| `check:artifacts` FAIL | The binary in `resources/solver/<plat>/` wasn't built from the commit in `solver.lock.json` — fetch/build the matching one |
| macOS "app might contain malware" | Unsigned, not malicious: right-click → Open (applies to EDOPro and, for now, this app) |
| Windows SmartScreen blocks the installer | More info → Run anyway (unsigned installer) |
| Probe green but card index near zero | EDOPro's first-launch updater hasn't run — launch EDOPro, let it update, re-pick the directory |
