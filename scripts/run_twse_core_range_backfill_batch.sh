#!/usr/bin/env bash
set -uo pipefail

git config user.name 'github-actions[bot]'
git config user.email '41898282+github-actions[bot]@users.noreply.github.com'
mkdir -p "$RUNNER_TEMP/twse-core-logs" "$RUNNER_TEMP/twse-core-saved"
changed=false
failures=()

pause_between_dates() {
  local minimum="${MIN_PAUSE:-60}"
  local maximum="${MAX_PAUSE:-180}"
  [ "$maximum" -lt "$minimum" ] && maximum="$minimum"
  local seconds=$((minimum + RANDOM % (maximum - minimum + 1)))
  echo "⏳ 下一日期前休息 ${seconds}s"
  sleep "$seconds"
}

pause_between_batches() {
  local minimum="${BATCH_PAUSE_MIN:-120}"
  local maximum="${BATCH_PAUSE_MAX:-300}"
  [ "$maximum" -lt "$minimum" ] && maximum="$minimum"
  local seconds=$((minimum + RANDOM % (maximum - minimum + 1)))
  echo "🛑 全域 batch ${GLOBAL_BATCH_INDEX}/${GLOBAL_BATCH_COUNT} 完成；長休息 ${seconds}s 後自動接續下一批。"
  sleep "$seconds"
}

push_file() {
  local source="$1"
  local date="$2"
  local source_file="$3"
  local message="$4"
  local saved="$RUNNER_TEMP/twse-core-saved/${source}-${date}"
  rm -rf "$saved"
  mkdir -p "$saved"
  [ -f "$source_file" ] || return 1
  cp --parents "$source_file" "$saved"

  local directory
  case "$source" in
    mi_index) directory=data_twse_mi_index ;;
    margin) directory=data_twse_margin_balance ;;
    *) return 1 ;;
  esac

  for attempt in 1 2 3 4 5; do
    git fetch origin main
    git reset --hard origin/main
    git clean -fd
    cp -a "$saved/." .
    node scripts/generate_file_lists.js --only "$directory"
    git add "$directory"

    if git diff --cached --quiet; then
      echo "ℹ️ ${source} ${date} 已存在於最新 main。"
      return 0
    fi

    git commit -m "$message"
    if git pull --rebase origin main && git push origin HEAD:main; then
      changed=true
      return 0
    fi
    git rebase --abort 2>/dev/null || true
    echo "Push failed; retry ${attempt}/5..."
    sleep $((attempt * 5))
  done
  return 1
}

verify_file() {
  local source="$1"
  local date="$2"
  node - "$source" "$date" <<'NODE'
const { sourceDateComplete } = require('./scripts/plan_twse_core_range_backfill');
const source = process.argv[2];
const date = process.argv[3];
if (!sourceDateComplete(process.cwd(), source, date)) {
  throw new Error(`Incomplete generated file: ${source} ${date}`);
}
NODE
}

backfill_mi_index() {
  IFS=',' read -r -a dates <<< "$BATCH_DATES"
  for index in "${!dates[@]}"; do
    date="${dates[$index]}"
    set +e
    node scripts/crawl_twse_mi_index.js \
      --date "$date" --type ALL \
      --max-retries 4 \
      --min-delay "${MIN_DELAY:-5000}" \
      --max-delay "${MAX_DELAY:-15000}" \
      --rate-limit-cooldown 120000 \
      --mismatch-cooldown 120000 \
      2>&1 | tee "$RUNNER_TEMP/twse-core-logs/mi-index-${date}.log"
    status=${PIPESTATUS[0]}
    set -e

    file="data_twse_mi_index/${date}_twse_mi_index.json"
    if [ "$status" -eq 0 ] && verify_file mi_index "$date" \
      && push_file mi_index "$date" "$file" "📈 Backfill TWSE MI_INDEX ${date}"; then
      echo "✅ mi_index ${date}"
    else
      failures+=("mi_index:$date")
    fi

    if [ "$index" -lt "$((${#dates[@]} - 1))" ]; then
      pause_between_dates
    fi
  done
}

backfill_margin() {
  IFS=',' read -r -a dates <<< "$BATCH_DATES"
  for index in "${!dates[@]}"; do
    date="${dates[$index]}"
    args=(
      --date "$date"
      --max-retries 4
      --retry-cooldown-ms 120000
      --min-delay-ms "${MIN_DELAY:-5000}"
      --max-delay-ms "${MAX_DELAY:-15000}"
    )
    [ "${FORCE:-false}" = true ] && args+=(--force)

    set +e
    node scripts/crawl_twse_margin_balance.js "${args[@]}" \
      2>&1 | tee "$RUNNER_TEMP/twse-core-logs/margin-${date}.log"
    status=${PIPESTATUS[0]}
    set -e

    file="data_twse_margin_balance/${date}_twse_margin_balance.csv"
    if [ "$status" -eq 0 ] && verify_file margin "$date" \
      && push_file margin "$date" "$file" "💳 Backfill TWSE margin balance ${date}"; then
      echo "✅ margin ${date}"
    else
      failures+=("margin:$date")
    fi

    if [ "$index" -lt "$((${#dates[@]} - 1))" ]; then
      pause_between_dates
    fi
  done
}

case "$BATCH_SOURCE" in
  mi_index) backfill_mi_index ;;
  margin) backfill_margin ;;
  *) echo "Unknown batch source: $BATCH_SOURCE"; exit 1 ;;
esac

echo "changed=$changed" >> "$GITHUB_OUTPUT"
if [ "${#failures[@]}" -gt 0 ]; then
  printf 'Failed dates: %s\n' "${failures[*]}"
  {
    echo '### Batch failures'
    printf -- '- %s\n' "${failures[@]}"
  } >> "$GITHUB_STEP_SUMMARY"
  exit 1
fi

if [ "${HAS_NEXT_BATCH:-false}" = true ]; then
  pause_between_batches
fi
