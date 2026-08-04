#!/usr/bin/env bash
set -uo pipefail
: "${START_DATE:?START_DATE is required}"
: "${END_DATE:?END_DATE is required}"
: "${START_INDEX:?START_INDEX is required}"
: "${LIMIT:?LIMIT is required}"

start_slash="${START_DATE:0:4}/${START_DATE:4:2}/${START_DATE:6:2}"
set +e
node scripts/crawl_history_sma.js "$START_INDEX" "$LIMIT" --start "$start_slash"
crawl_status=$?
set -e
if [ "$crawl_status" -ne 0 ]; then exit "$crawl_status"; fi

mapfile -t changed < <({ git diff --name-only -- data_history_sma; git ls-files --others --exclude-standard -- data_history_sma; } | sort -u)
if [ "${#changed[@]}" -eq 0 ]; then
  echo "No SMA history changes for stock batch $START_INDEX+$LIMIT"
  exit 0
fi

save_root="$RUNNER_TEMP/sma-history-save"
rm -rf "$save_root"; mkdir -p "$save_root"
for file in "${changed[@]}"; do
  [ -f "$file" ] || continue
  mkdir -p "$save_root/$(dirname "$file")"
  cp "$file" "$save_root/$file"
done

git config user.name 'github-actions[bot]'
git config user.email '41898282+github-actions[bot]@users.noreply.github.com'
for attempt in 1 2 3 4 5; do
  git fetch origin main
  git reset --hard origin/main
  git clean -fd data_history_sma
  restored=()
  for file in "${changed[@]}"; do
    [ -f "$save_root/$file" ] || continue
    mkdir -p "$(dirname "$file")"
    cp "$save_root/$file" "$file"
    restored+=("$file")
  done
  if [ "${#restored[@]}" -eq 0 ]; then exit 0; fi
  git add -- "${restored[@]}"
  if git diff --staged --quiet; then exit 0; fi
  git commit -m "data: backfill SMA history stocks ${START_INDEX}-$((START_INDEX + LIMIT - 1))"
  if git push origin HEAD:main; then exit 0; fi
  sleep 5
done
exit 1
