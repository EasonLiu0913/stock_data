#!/usr/bin/env bash
set -uo pipefail
: "${BATCH_DATES:?BATCH_DATES is required}"
INPUT_FORCE="${INPUT_FORCE:-false}"
MIN_DATE_PAUSE_SECONDS="${MIN_DATE_PAUSE_SECONDS:-5}"
MAX_DATE_PAUSE_SECONDS="${MAX_DATE_PAUSE_SECONDS:-20}"
TEMP_OUTPUT="$RUNNER_TEMP/vix-output"
rm -rf "$TEMP_OUTPUT"; mkdir -p "$TEMP_OUTPUT"
args=(--dates "$BATCH_DATES" --output-dir "$TEMP_OUTPUT")
if [ "$INPUT_FORCE" = 'true' ]; then args+=(--force); fi
node scripts/crawl_vix_index.js "${args[@]}"

git config user.name 'github-actions[bot]'
git config user.email '41898282+github-actions[bot]@users.noreply.github.com'
IFS=',' read -r -a dates <<< "$BATCH_DATES"
failed=()
for index in "${!dates[@]}"; do
  date="${dates[$index]}"
  saved="$TEMP_OUTPUT/$date/vix.json"
  destination="data_vix/$date/vix.json"
  if [ ! -s "$saved" ]; then failed+=("$date:missing"); continue; fi
  pushed=false
  for attempt in 1 2 3 4 5; do
    git fetch origin main
    git reset --hard origin/main
    git clean -fd data_vix
    mkdir -p "$(dirname "$destination")"
    cp "$saved" "$destination.tmp" && mv "$destination.tmp" "$destination"
    node scripts/crawl_vix_index.js --refresh-indexes
    node - "$destination" "$date" <<'NODE'
const { validateStored } = require('./scripts/crawl_vix_index');
const errors = validateStored(process.argv[2], process.argv[3]);
if (errors.length) { console.error(errors.join('; ')); process.exit(1); }
NODE
    git add -- "$destination" data_vix/files.json data_vix/manifest.json
    if git diff --staged --quiet; then pushed=true; break; fi
    git commit -m "data: backfill VIX index ${date}"
    if git push origin HEAD:main; then pushed=true; break; fi
    sleep 5
  done
  [ "$pushed" = true ] || failed+=("$date:push")
  if [ "$index" -lt "$((${#dates[@]} - 1))" ]; then
    min="$MIN_DATE_PAUSE_SECONDS"; max="$MAX_DATE_PAUSE_SECONDS"; [ "$max" -lt "$min" ] && max="$min"
    sleep $((min + RANDOM % (max - min + 1)))
  fi
done

echo "failed: ${failed[*]:-none}"
[ "${#failed[@]}" -eq 0 ]
