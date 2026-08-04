#!/usr/bin/env bash
set -uo pipefail

: "${BATCH_DATES:?BATCH_DATES is required}"
MIN_DATE_PAUSE_SECONDS="${MIN_DATE_PAUSE_SECONDS:-30}"
MAX_DATE_PAUSE_SECONDS="${MAX_DATE_PAUSE_SECONDS:-90}"

mkdir -p "$RUNNER_TEMP/external-saved"
git config user.name 'github-actions[bot]'
git config user.email '41898282+github-actions[bot]@users.noreply.github.com'

validate_external() {
  local file="$1" date="$2"
  node - "$file" "$date" <<'NODE'
const { validateExternalSnapshot } = require('./scripts/plan_external_market_range');
const errors = validateExternalSnapshot(process.argv[2], process.argv[3]);
if (errors.length) { console.error(errors.join('; ')); process.exit(1); }
NODE
}

validate_risk() {
  local file="$1" date="$2"
  node - "$file" "$date" <<'NODE'
const fs = require('node:fs');
const payload = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
if (payload?.date !== process.argv[3] || !Number.isFinite(Number(payload?.market_risk_score))) process.exit(1);
NODE
}

persist_day() {
  local date="$1" saved_external="$2" saved_risk="$3"
  local external="data_external_market/$date/external_market_indicators.json"
  local risk="data_market_risk/$date/market_risk_snapshot.json"
  for attempt in 1 2 3 4 5; do
    git fetch origin main
    git reset --hard origin/main
    git clean -fd data_external_market data_market_risk
    mkdir -p "$(dirname "$external")" "$(dirname "$risk")"
    cp "$saved_external" "$external.tmp" && mv "$external.tmp" "$external"
    cp "$saved_risk" "$risk.tmp" && mv "$risk.tmp" "$risk"
    node scripts/refresh_dataset_indexes.js --datasets external_market,market_risk
    validate_external "$external" "$date"
    validate_risk "$risk" "$date"
    git add -- "$external" "$risk" data_external_market/files.json data_external_market/manifest.json data_market_risk/files.json data_market_risk/manifest.json
    if git diff --staged --quiet; then
      echo "ℹ️ external market $date already present"
      return 0
    fi
    git commit -m "data: backfill external market and risk ${date}"
    if git push origin HEAD:main; then return 0; fi
    echo "External market push failed for $date; retry $attempt/5"
    sleep 5
  done
  return 1
}

IFS=',' read -r -a dates <<< "$BATCH_DATES"
failed=()
completed=()
for index in "${!dates[@]}"; do
  date="${dates[$index]}"
  external="data_external_market/$date/external_market_indicators.json"
  risk="data_market_risk/$date/market_risk_snapshot.json"
  rm -rf "data_external_market/$date" "data_market_risk/$date"
  set +e
  node scripts/crawl_external_market_indicators.js --date "$date"
  crawl_status=$?
  set -e
  if [ "$crawl_status" -ne 0 ] || ! validate_external "$external" "$date"; then
    echo "❌ external market $date failed"
    failed+=("$date:crawl")
  else
    set +e
    node scripts/generate_market_risk_snapshot.js --date "$date"
    risk_status=$?
    set -e
    if [ "$risk_status" -ne 0 ] || ! validate_risk "$risk" "$date"; then
      echo "❌ market risk $date failed"
      failed+=("$date:risk")
    else
      saved_external="$RUNNER_TEMP/external-saved/${date}_external.json"
      saved_risk="$RUNNER_TEMP/external-saved/${date}_risk.json"
      cp "$external" "$saved_external"; cp "$risk" "$saved_risk"
      if persist_day "$date" "$saved_external" "$saved_risk"; then completed+=("$date"); else failed+=("$date:push"); fi
    fi
  fi
  if [ "$index" -lt "$((${#dates[@]} - 1))" ]; then
    min="$MIN_DATE_PAUSE_SECONDS"; max="$MAX_DATE_PAUSE_SECONDS"; [ "$max" -lt "$min" ] && max="$min"
    pause=$((min + RANDOM % (max - min + 1)))
    echo "⏳ wait ${pause}s before next external-market date"
    sleep "$pause"
  fi
done

echo "completed: ${completed[*]:-none}"
echo "failed: ${failed[*]:-none}"
[ "${#failed[@]}" -eq 0 ]
