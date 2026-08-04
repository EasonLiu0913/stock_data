#!/usr/bin/env bash
set -uo pipefail

git config user.name 'github-actions[bot]'
git config user.email '41898282+github-actions[bot]@users.noreply.github.com'
mkdir -p "$RUNNER_TEMP/institutional-logs" "$RUNNER_TEMP/institutional-saved"
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
  echo "🛑 batch ${BATCH_INDEX}/${BATCH_COUNT} 完成；長休息 ${seconds}s 後自動接續下一批。"
  sleep "$seconds"
}

verify_file() {
  local date="$1"
  node - "$date" <<'NODE'
const { sourceDateComplete } = require('./scripts/plan_twse_institutional_investors_backfill');
const date = process.argv[2];
if (!sourceDateComplete(process.cwd(), date)) {
  throw new Error(`Incomplete generated institutional file: ${date}`);
}
NODE
}

push_file() {
  local date="$1"
  local source_file="$2"
  local saved="$RUNNER_TEMP/institutional-saved/${date}"
  rm -rf "$saved"
  mkdir -p "$saved"
  [ -f "$source_file" ] || return 1
  cp --parents "$source_file" "$saved"

  for attempt in 1 2 3 4 5; do
    git fetch origin main
    git reset --hard origin/main
    git clean -fd
    cp -a "$saved/." .
    node scripts/generate_file_lists.js --only data_twse_institutional_investors
    git add data_twse_institutional_investors

    if git diff --cached --quiet; then
      echo "ℹ️ institutional ${date} 已存在於最新 main。"
      return 0
    fi

    git commit -m "🏛️ Backfill TWSE institutional investors ${date}"
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

IFS=',' read -r -a dates <<< "$BATCH_DATES"
for index in "${!dates[@]}"; do
  date="${dates[$index]}"
  file="data_twse_institutional_investors/${date}_twse_institutional_investors.json"

  set +e
  node scripts/crawl_history_twse_institutional_investors.js \
    --date "$date" \
    --force \
    --max-retries 4 \
    --min-delay "${MIN_DELAY:-5000}" \
    --max-delay "${MAX_DELAY:-15000}" \
    --rate-limit-cooldown 120000 \
    --mismatch-cooldown 120000 \
    2>&1 | tee "$RUNNER_TEMP/institutional-logs/${date}.log"
  status=${PIPESTATUS[0]}
  set -e

  if [ "$status" -eq 0 ] && verify_file "$date" && push_file "$date" "$file"; then
    echo "✅ institutional ${date}"
  else
    failures+=("institutional:$date")
  fi

  if [ "$index" -lt "$((${#dates[@]} - 1))" ]; then
    pause_between_dates
  fi
done

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
