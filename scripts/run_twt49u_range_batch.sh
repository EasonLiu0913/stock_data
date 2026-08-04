#!/usr/bin/env bash
set -uo pipefail

: "${BATCH_DATES:?BATCH_DATES is required}"
INPUT_FORCE="${INPUT_FORCE:-false}"
MIN_DATE_PAUSE_SECONDS="${MIN_DATE_PAUSE_SECONDS:-30}"
MAX_DATE_PAUSE_SECONDS="${MAX_DATE_PAUSE_SECONDS:-90}"
MAX_RETRIES="${MAX_RETRIES:-4}"
RATE_LIMIT_COOLDOWN_MS="${RATE_LIMIT_COOLDOWN_MS:-120000}"

mkdir -p "$RUNNER_TEMP/twt49u-saved"
git config user.name 'github-actions[bot]'
git config user.email '41898282+github-actions[bot]@users.noreply.github.com'

validate_file() {
  local file="$1" date="$2"
  node - "$file" "$date" <<'NODE'
const { validateTwt49u } = require('./scripts/plan_twse_range_backfill');
const errors = validateTwt49u(process.argv[2], process.argv[3]);
if (errors.length) { console.error(errors.join('; ')); process.exit(1); }
NODE
}

persist_day() {
  local date="$1" saved="$2"
  local destination="data_twse_twt49u/${date}_twt49u.json"
  for attempt in 1 2 3 4 5; do
    git fetch origin main
    git reset --hard origin/main
    git clean -fd data_twse_twt49u
    mkdir -p data_twse_twt49u
    cp "$saved" "$destination.tmp"
    mv "$destination.tmp" "$destination"
    node -e "require('./scripts/crawl_twse_twt49u').refreshFilesJson()"
    validate_file "$destination" "$date"
    git add -- "$destination" data_twse_twt49u/files.json
    if git diff --staged --quiet; then
      echo "ℹ️ TWT49U $date already present with identical content"
      return 0
    fi
    git commit -m "data: backfill TWSE TWT49U ${date}"
    if git push origin HEAD:main; then return 0; fi
    echo "TWT49U push failed for $date; retry $attempt/5"
    sleep 5
  done
  return 1
}

IFS=',' read -r -a dates <<< "$BATCH_DATES"
failed=()
completed=()
for index in "${!dates[@]}"; do
  date="${dates[$index]}"
  destination="data_twse_twt49u/${date}_twt49u.json"
  rm -f "$destination"
  args=(--date "$date" --max-retries "$MAX_RETRIES" --rate-limit-cooldown "$RATE_LIMIT_COOLDOWN_MS")
  if [ "$INPUT_FORCE" = 'true' ]; then args+=(--force); fi
  set +e
  node scripts/crawl_twse_twt49u_safe.js "${args[@]}"
  status=$?
  set -e
  if [ "$status" -ne 0 ] || ! validate_file "$destination" "$date"; then
    echo "❌ TWT49U $date crawl or validation failed"
    failed+=("$date")
  else
    saved="$RUNNER_TEMP/twt49u-saved/${date}_twt49u.json"
    cp "$destination" "$saved"
    if persist_day "$date" "$saved"; then completed+=("$date"); else failed+=("$date:push"); fi
  fi
  if [ "$index" -lt "$((${#dates[@]} - 1))" ]; then
    min="$MIN_DATE_PAUSE_SECONDS"; max="$MAX_DATE_PAUSE_SECONDS"; [ "$max" -lt "$min" ] && max="$min"
    pause=$((min + RANDOM % (max - min + 1)))
    echo "⏳ wait ${pause}s before next TWT49U date"
    sleep "$pause"
  fi
done

echo "completed: ${completed[*]:-none}"
echo "failed: ${failed[*]:-none}"
[ "${#failed[@]}" -eq 0 ]
