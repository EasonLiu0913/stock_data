#!/usr/bin/env bash
set -euo pipefail

RANGE_START="${RANGE_START:-2026-04-01}"
RANGE_END="${RANGE_END:-2026-08-21}"
MAX_TDCC_STOCKS="${MAX_TDCC_STOCKS:-6}"
MAX_BROKER_STOCKS="${MAX_BROKER_STOCKS:-2}"
BROKER_BATCH_SIZE="${BROKER_BATCH_SIZE:-5}"
BROKER_MAX_BATCHES="${BROKER_MAX_BATCHES:-16}"
PLAN="data_research/institutional-flow/validation/coverage-expansion-v1.json"
COVERAGE="data_research/institutional-flow/validation/validation-coverage-v1.json"

checkpoint() {
  local message="$1"; shift
  git add "$@"
  if git diff --cached --quiet; then return 0; fi
  git commit -m "$message"
  for attempt in 1 2 3 4 5; do
    if git pull --rebase origin main && git push origin HEAD:main; then return 0; fi
    git rebase --abort 2>/dev/null || true
    git reset --hard HEAD
    git fetch origin main
    git rebase origin/main || true
    sleep $((attempt * 5))
  done
  echo "checkpoint push failed: $message" >&2
  return 1
}

node --check scripts/plan_institutional_withdrawal_validation_expansion_v1.js
node --check scripts/plan_institutional_withdrawal_validation_broker_batches_v1.js
node --check scripts/backfill_histock_broker_exact_source_date.js
node --check scripts/backfill_tdcc_shareholding_history.js
node --check scripts/plan_institutional_withdrawal_validation_coverage.js

if grep -En "v6-1-event-diagnosis|v61_outcome|return_20d|max_drawdown|future_return|validation-outcomes|validation-metrics" \
  scripts/plan_institutional_withdrawal_validation_expansion_v1.js \
  scripts/plan_institutional_withdrawal_validation_broker_batches_v1.js \
  scripts/backfill_histock_broker_exact_source_date.js; then
  echo "Forbidden outcome dependency detected" >&2
  exit 1
fi

# Pre-network freeze. Deterministic hash order controls request load only.
node scripts/plan_institutional_withdrawal_validation_expansion_v1.js \
  --start "$RANGE_START" --end "$RANGE_END" \
  --max-tdcc-stocks "$MAX_TDCC_STOCKS" \
  --max-broker-stocks "$MAX_BROKER_STOCKS" \
  --output "$PLAN"
checkpoint "research: checkpoint untouched validation expansion order" "$PLAN"

node - <<'NODE'
const p=require('./data_research/institutional-flow/validation/coverage-expansion-v1.json');
console.log(JSON.stringify({stage:'pre-network',calendar:p.calendar,counts:p.counts,scheduled:p.scheduled},null,2));
NODE

mapfile -t STOCKS < <(node -e "const p=require('./$PLAN'); for(const s of p.scheduled.tdcc_stocks||[]) console.log(s)")
BATCH=0
for STOCK in "${STOCKS[@]}"; do
  echo "=== TDCC batch $BATCH / $STOCK ==="
  set +e
  node scripts/backfill_tdcc_shareholding_history.js \
    --stock "$STOCK" --start "$RANGE_START" --end "$RANGE_END" \
    --delay-ms 2200 --jitter-ms 1800
  RC=$?
  set -e
  ROOT="data_tdcc_shareholding/history/$STOCK"
  if [[ -s "$ROOT/manifest.json" ]]; then
    node - "$ROOT" "$STOCK" <<'NODE'
const fs=require('fs'),path=require('path');
const [root,stock]=process.argv.slice(2);let valid=0;
for(const name of fs.readdirSync(root).filter(x=>/^\d{8}\.json$/.test(x))){
  const p=JSON.parse(fs.readFileSync(path.join(root,name),'utf8'));
  if(p.stock!==stock||p.source!=='tdcc_official_historical_query'||p.historical_backfill!==true||p.production_no_lookahead_safe!==false) throw new Error(`Invalid TDCC provenance ${name}`);
  if(Number.isFinite(p.derived?.large_holder_pct)&&Number.isFinite(p.derived?.small_holder_pct)) valid++;
}
if(valid<1) throw new Error(`No valid TDCC observations for ${stock}`);
console.log(JSON.stringify({stock,valid_tdcc_observations:valid},null,2));
NODE
    checkpoint "research: untouched TDCC batch $BATCH $STOCK" "$ROOT"
  else
    echo "TDCC $STOCK produced no checkpointable manifest (exit=$RC)"
  fi
  BATCH=$((BATCH+1))
  sleep $((30 + RANDOM % 31))
done

# Refresh after TDCC, then only normalize enough Broker dates to hit the frozen 40-day gate.
git pull --rebase origin main
node scripts/plan_institutional_withdrawal_validation_expansion_v1.js \
  --start "$RANGE_START" --end "$RANGE_END" \
  --max-tdcc-stocks "$MAX_TDCC_STOCKS" \
  --max-broker-stocks "$MAX_BROKER_STOCKS" \
  --output "$PLAN"
BROKER_PLAN="${RUNNER_TEMP:-/tmp}/institutional-withdrawal-validation-broker-plan.json"
node scripts/plan_institutional_withdrawal_validation_broker_batches_v1.js \
  --expansion "$PLAN" --target-days 40 \
  --batch-size-requests "$BROKER_BATCH_SIZE" \
  --max-batches-per-run "$BROKER_MAX_BATCHES" \
  --output "$BROKER_PLAN"
checkpoint "research: freeze post-TDCC Broker normalization plan" "$PLAN"

BATCH_COUNT=$(node -e "const p=require(process.argv[1]);console.log(p.batches.length)" "$BROKER_PLAN")
for ((BATCH=0; BATCH<BATCH_COUNT; BATCH++)); do
  TASKS=$(node -e "const p=require(process.argv[1]);console.log(p.batches[Number(process.argv[2])].tasks)" "$BROKER_PLAN" "$BATCH")
  echo "=== Broker batch $BATCH: $TASKS ==="
  IFS=',' read -ra ITEMS <<< "$TASKS"
  [[ "${#ITEMS[@]}" -le "$BROKER_BATCH_SIZE" ]]
  for ITEM in "${ITEMS[@]}"; do
    STOCK="${ITEM%@*}"; DATE="${ITEM#*@}"
    set +e
    node scripts/backfill_histock_broker_exact_source_date.js \
      --stock "$STOCK" --date "$DATE" \
      --delay-ms 1800 --jitter-ms 1200 --max-retries 2
    RC=$?
    set -e
    STATUS_ROOT="data_research/institutional-flow/histock/$STOCK/batch-status"
    mkdir -p "$STATUS_ROOT"
    STATUS_FILE="$STATUS_ROOT/validation-run-${GITHUB_RUN_ID:-local}-batch-${BATCH}-${DATE//-/}.json"
    node - "$STATUS_FILE" "$STOCK" "$DATE" "$RC" <<'NODE'
const fs=require('fs');const [file,stock,date,rc]=process.argv.slice(2);
fs.writeFileSync(file,JSON.stringify({schema_version:1,research:'institutional-withdrawal-validation-coverage-v1',stock,date,fetch_exit_code:Number(rc),run_id:process.env.GITHUB_RUN_ID||null,generated_at:new Date().toISOString()},null,2)+'\n');
NODE
    sleep $((2 + RANDOM % 3))
  done
  checkpoint "research: untouched Broker batch $BATCH checkpoint" data_research/institutional-flow/histock
  sleep $((45 + RANDOM % 46))
done

# Coverage-only final state. Outcome artifacts are forbidden at this phase.
git pull --rebase origin main
node scripts/plan_institutional_withdrawal_validation_expansion_v1.js \
  --start "$RANGE_START" --end "$RANGE_END" \
  --max-tdcc-stocks "$MAX_TDCC_STOCKS" \
  --max-broker-stocks "$MAX_BROKER_STOCKS" \
  --output "$PLAN"
node scripts/plan_institutional_withdrawal_validation_coverage.js \
  --start "$RANGE_START" --end "$RANGE_END" --output "$COVERAGE"
[[ ! -e data_research/institutional-flow/validation/validation-outcomes-v1.json ]]
[[ ! -e data_research/institutional-flow/validation/validation-metrics-v1.json ]]
checkpoint "research: refresh untouched validation coverage state" "$PLAN" "$COVERAGE"

node - <<'NODE'
const x=require('./data_research/institutional-flow/validation/coverage-expansion-v1.json');
const v=require('./data_research/institutional-flow/validation/validation-coverage-v1.json');
console.log(JSON.stringify({stage:'final',expansion_counts:x.counts,expansion_ready:x.ready_stocks,stock_holdout_ready:v.stock_holdout_ready,needs_broker:v.stock_holdout_needs_broker_normalization},null,2));
NODE
