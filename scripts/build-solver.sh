#!/usr/bin/env bash
# Builds the solver at the commit pinned in solver.lock.json and installs the
# binary + manifest into resources/solver/mac/ for bundling (TDD §12).
#
# Requirements: a local clone of the solver repo (default ../ygo-combo-solver,
# override with SOLVER_SRC) whose PARENT directory carries the replay2video
# layout the solver's dep fetcher expects (edopro/ clone with submodules,
# deps/). The clone itself is never modified: the pinned commit is checked out
# into a temporary git worktree next to it and removed afterwards.
set -euo pipefail

gui_root="$(cd "$(dirname "$0")/.." && pwd)"
lock="$gui_root/solver.lock.json"
commit="$(python3 -c "import json;print(json.load(open('$lock'))['commit'])")"
scripts_commit="$(python3 -c "import json;print(json.load(open('$lock'))['scriptsCommit'])")"

src="${SOLVER_SRC:-$gui_root/../ygo-combo-solver}"
src="$(cd "$src" && pwd)"
parent="$(dirname "$src")"
worktree="$parent/ygo-combo-solver-build"

if [ "$(git -C "$src" cat-file -t "$commit" 2>/dev/null)" != "commit" ]; then
    echo "fetching pinned solver commit..."
    git -C "$src" fetch --quiet fork 2>/dev/null || git -C "$src" fetch --quiet origin
fi
git -C "$src" cat-file -t "$commit" >/dev/null

echo "building solver @ ${commit:0:12} in $worktree"
git -C "$src" worktree remove --force "$worktree" 2>/dev/null || true
git -C "$src" worktree add --detach "$worktree" "$commit" --quiet
trap 'git -C "$src" worktree remove --force "$worktree" 2>/dev/null || true' EXIT

(cd "$worktree" \
    && SCRIPTS_COMMIT="$scripts_commit" ./tools/fetch_solver_deps.sh \
    && premake5 gmake2 > /dev/null \
    && make -C build config=release_arm64 -j "$(sysctl -n hw.ncpu)" > /dev/null)

dest="$gui_root/resources/solver/mac"
mkdir -p "$dest"
cp "$worktree/bin/Release/combosolver" "$dest/combosolver"
cp "$worktree/LICENSE" "$worktree/NOTICE" "$dest/"
python3 - "$dest/manifest.json" "$commit" <<'EOF'
import json, sys, time, platform
json.dump({"solverCommit": sys.argv[2],
           "target": f"{platform.machine()}-macos",
           "builtAt": time.strftime("%Y-%m-%dT%H:%M:%S%z")},
          open(sys.argv[1], "w"), indent=2)
EOF

echo "ok -> resources/solver/mac/combosolver (solver ${commit:0:12})"
"$dest/combosolver" --help > /dev/null && echo "binary smoke: ok"
