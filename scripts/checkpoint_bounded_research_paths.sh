#!/usr/bin/env bash
set -euo pipefail

# Concurrency-safe checkpoint helper for bounded append/research writers.
# Usage:
#   scripts/checkpoint_bounded_research_paths.sh "commit message" path [path ...]
#
# Contract:
# 1. stage only the explicitly supplied bounded paths;
# 2. commit locally and try a direct push first;
# 3. if origin/main moved, fetch + hard-reset to origin/main;
# 4. replay only files changed by the bounded local checkpoint;
# 5. immutable exact-path artifacts already on origin/main are remote-wins;
# 6. never use git pull --rebase.

if [[ "$#" -lt 2 ]]; then
  echo "usage: $0 <commit-message> <path> [path ...]" >&2
  exit 2
fi

message="$1"
shift
paths=("$@")

is_remote_wins_immutable() {
  local file="$1"
  case "$file" in
    data_tdcc_shareholding/history/*/[0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9].json) return 0 ;;
    data_research/institutional-flow/histock/*/daily/[0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9].json) return 0 ;;
    data_research/institutional-flow/histock/*/batch-status/archive/*) return 0 ;;
    data_research/institutional-flow/histock/*/batch-status/validation-run-*.json) return 0 ;;
    *) return 1 ;;
  esac
}

stage_and_commit() {
  git add -- "${paths[@]}"
  if git diff --cached --quiet; then
    return 1
  fi
  git commit -m "$message"
  return 0
}

if ! stage_and_commit; then
  echo "No bounded checkpoint changes to commit."
  exit 0
fi

local_commit="$(git rev-parse HEAD)"

for attempt in 1 2 3 4 5; do
  if git push origin HEAD:main; then
    exit 0
  fi

  echo "Checkpoint push raced with origin/main; replaying bounded local delta (attempt=$attempt)."
  git fetch origin main
  mapfile -t changed_files < <(git diff-tree --no-commit-id --name-only -r "$local_commit" -- "${paths[@]}")
  git reset --hard origin/main

  replayed=0
  for file in "${changed_files[@]}"; do
    [[ -n "$file" ]] || continue
    if is_remote_wins_immutable "$file" && git cat-file -e "origin/main:$file" 2>/dev/null; then
      echo "Remote already has immutable checkpoint artifact $file; keeping origin/main copy."
      continue
    fi
    git checkout "$local_commit" -- "$file"
    replayed=1
  done

  if [[ "$replayed" -eq 0 ]]; then
    echo "Remote main already contains all immutable bounded artifacts."
    exit 0
  fi

  if ! stage_and_commit; then
    echo "No bounded delta remains after replay."
    exit 0
  fi
  local_commit="$(git rev-parse HEAD)"
  sleep $((attempt * 5))
done

echo "Failed to push bounded checkpoint after replay attempts." >&2
exit 1
