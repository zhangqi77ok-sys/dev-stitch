#!/bin/bash
# Build the static export for the GitHub Pages demo and push it to the
# gh-pages branch. Branch push ONLY — this script never touches repo
# settings. Enabling Pages itself (Settings -> Pages -> Deploy from
# branch gh-pages) is a manual step, documented in docs/devpost-submission-draft.md.
#
# Why app/api moves aside: `output: export` refuses to build while a
# route handler exists (build error on /api/crew). The Pages demo
# therefore runs heuristic-only + seeded demo — exactly like no-key
# mode — and that is stated on the page and in the submission draft.
#
# The API directory is restored on every exit path (trap), and the
# worktree is removed afterwards. Usage: bash scripts/build-pages.sh
set -euo pipefail
cd "$(dirname "$0")/.."
MAIN_DIR="$PWD"

STAGE="$(mktemp -d)"
API_BACKUP="$STAGE/api"
WORKTREE="$STAGE/pages"
cleanup() {
  cd "$MAIN_DIR" || true
  if [ -d "$API_BACKUP" ]; then
    rm -rf app/api
    mv "$API_BACKUP" app/api
  fi
  git worktree remove --force "$WORKTREE" 2>/dev/null || true
  rm -rf "$STAGE"
}
trap cleanup EXIT

mv app/api "$API_BACKUP"
DEV_STITCH_STATIC_EXPORT=1 npm run build
# Restore the API route immediately after the build, before any git work.
rm -rf app/api
mv "$API_BACKUP" app/api

if git show-ref --verify --quiet refs/heads/gh-pages; then
  git worktree add "$WORKTREE" gh-pages
else
  git worktree add -b gh-pages "$WORKTREE"
fi
# Worktree starts empty for a new branch; clear tracked leftovers so the
# export is exactly out/.
find "$WORKTREE" -mindepth 1 -maxdepth 1 ! -name ".git" -exec rm -rf {} +
cp -r out/. "$WORKTREE"/
cd "$WORKTREE"
git add -A
if git diff --cached --quiet; then
  echo "gh-pages: no changes to publish."
else
  git -c user.name="dev-stitch" -c user.email="dev-stitch@local" commit -m "Pages export: static demo (heuristic + seeded, no server routes)"
  git push origin gh-pages
  echo "gh-pages pushed. Enable Pages in repo Settings if not already on."
fi
