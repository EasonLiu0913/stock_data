#!/usr/bin/env bash
set -euo pipefail

remote="origin"
branch="main"
max_attempts=5
prepare_script=""
validate_script=""
commit_message=""
output_key="changed"
add_paths=()

usage() {
  cat >&2 <<'USAGE'
Usage: race_safe_main_publish.sh \
  --prepare-script <path> \
  --validate-script <path> \
  --commit-message <message> \
  --add-path <repo-relative-file> [--add-path ...] \
  [--remote origin] [--branch main] [--max-attempts 5] [--output-key changed]
USAGE
}

while (($#)); do
  case "$1" in
    --prepare-script) prepare_script="${2:-}"; shift 2 ;;
    --validate-script) validate_script="${2:-}"; shift 2 ;;
    --commit-message) commit_message="${2:-}"; shift 2 ;;
    --add-path) add_paths+=("${2:-}"); shift 2 ;;
    --remote) remote="${2:-}"; shift 2 ;;
    --branch) branch="${2:-}"; shift 2 ;;
    --max-attempts) max_attempts="${2:-}"; shift 2 ;;
    --output-key) output_key="${2:-}"; shift 2 ;;
    -h|--help) usage; exit 0 ;;
    *) echo "Unknown argument: $1" >&2; usage; exit 2 ;;
  esac
done

[[ -n "$prepare_script" && -x "$prepare_script" ]] || { echo "Prepare script must exist and be executable: $prepare_script" >&2; exit 2; }
[[ -n "$validate_script" && -x "$validate_script" ]] || { echo "Validate script must exist and be executable: $validate_script" >&2; exit 2; }
[[ -n "$commit_message" ]] || { echo "Commit message is required" >&2; exit 2; }
[[ ${#add_paths[@]} -gt 0 ]] || { echo "At least one --add-path is required" >&2; exit 2; }
[[ "$max_attempts" =~ ^[1-9][0-9]*$ ]] || { echo "Invalid --max-attempts: $max_attempts" >&2; exit 2; }
[[ "$output_key" =~ ^[A-Za-z_][A-Za-z0-9_]*$ ]] || { echo "Invalid --output-key: $output_key" >&2; exit 2; }

repo_root="$(git rev-parse --show-toplevel)"
cd "$repo_root"

for path in "${add_paths[@]}"; do
  [[ -n "$path" && "$path" != /* && "$path" != ".." && "$path" != ../* && "$path" != */../* ]] || { echo "--add-path must be a safe repo-relative path: $path" >&2; exit 2; }
done

write_output() {
  local value="$1"
  if [[ -n "${GITHUB_OUTPUT:-}" ]]; then
    printf '%s=%s\n' "$output_key" "$value" >> "$GITHUB_OUTPUT"
  fi
}

assert_no_unowned_changes() {
  local unstaged untracked
  unstaged="$(git diff --name-only)"
  untracked="$(git ls-files --others --exclude-standard)"
  if [[ -n "$unstaged" || -n "$untracked" ]]; then
    echo "Prepare/validate produced changes outside the explicitly staged publish paths:" >&2
    [[ -z "$unstaged" ]] || { echo "Unstaged tracked files:" >&2; printf '%s\n' "$unstaged" >&2; }
    [[ -z "$untracked" ]] || { echo "Untracked files:" >&2; printf '%s\n' "$untracked" >&2; }
    exit 1
  fi
}

for ((attempt=1; attempt<=max_attempts; attempt++)); do
  echo "Race-safe publish attempt ${attempt}/${max_attempts}: rebuild from current ${remote}/${branch}"
  git fetch --no-tags "$remote" "$branch"
  git reset --hard "$remote/$branch"

  # Remove only expected untracked outputs left by an earlier failed attempt.
  git clean -fd -- "${add_paths[@]}" >/dev/null

  "$prepare_script"
  "$validate_script"

  for path in "${add_paths[@]}"; do
    if [[ -e "$path" ]] || git ls-files --error-unmatch "$path" >/dev/null 2>&1; then
      git add -A -- "$path"
    fi
  done

  assert_no_unowned_changes

  if git diff --cached --quiet; then
    echo "Current ${remote}/${branch} already contains equivalent publish output."
    write_output false
    exit 0
  fi

  git commit -m "$commit_message"

  # Test-only hook used by the regression harness to deterministically inject a competing writer.
  if [[ -n "${RACE_SAFE_BEFORE_PUSH_HOOK:-}" ]]; then
    "$RACE_SAFE_BEFORE_PUSH_HOOK" "$attempt"
  fi

  if git push "$remote" "HEAD:$branch"; then
    write_output true
    exit 0
  fi

  if (( attempt == max_attempts )); then
    break
  fi

  echo "Remote advanced or push failed; discard generated commit and regenerate from latest ${remote}/${branch}."
  sleep_seconds=$((2 + RANDOM % 5))
  sleep "$sleep_seconds"
done

echo "Race-safe publish failed after ${max_attempts} attempts." >&2
exit 1
