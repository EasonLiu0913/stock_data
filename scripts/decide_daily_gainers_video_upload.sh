#!/usr/bin/env bash
set -euo pipefail
date="${1:?date required}"
[[ "$date" =~ ^20[0-9]{6}$ ]] || { echo "Invalid date: $date" >&2; exit 1; }
repo="${GITHUB_REPOSITORY:-EasonLiu0913/stock_data}"
receipt="video_upload_receipts/daily-gainers/${date}.json"
if gh api "repos/$repo/contents/$receipt?ref=main" >/dev/null 2>&1; then
  echo "Already uploaded: $receipt"
  echo "decision=already_uploaded" >> "$GITHUB_OUTPUT"
  exit 0
fi
# Avoid a second dispatch while either downstream workflow is already queued or running.
active="$(gh api "repos/$repo/actions/runs?per_page=100" --jq '[.workflow_runs[] | select((.status=="queued" or .status=="in_progress") and (.name=="[08 影片] Generate & Upload Daily 5% Video" or .name=="[08 影片] Retry Daily 5% YouTube Upload"))] | length')"
if [ "$active" -gt 0 ]; then
  echo "Downstream video job is still active; avoid duplicate dispatch"
  echo "decision=busy" >> "$GITHUB_OUTPUT"
  exit 0
fi
candidate=""
artifact_name="daily-gainers-video-${date}"
# Query available artifacts for this date, newest first.
mapfile -t runs < <(gh api "repos/$repo/actions/artifacts?name=$artifact_name&per_page=100" --jq '.artifacts[] | select(.expired==false) | .workflow_run.id' | awk '!seen[$0]++')
for run_id in "${runs[@]}"; do
  mkdir -p "output/daily-gainers-video/$date"
  rm -rf "output/daily-gainers-video/$date"
  if ! gh run download "$run_id" -R "$repo" -n "$artifact_name" -D "output/daily-gainers-video/$date"; then
    continue
  fi
  dir="output/daily-gainers-video/$date"
  if [ ! -s "$dir/daily-gainers-$date.mp4" ] || [ ! -s "$dir/daily-gainers-$date.zh-TW.srt" ] || [ ! -s "$dir/metadata.json" ] || [ ! -s "$dir/thumbnail.jpg" ] || [ ! -s "$dir/qa.json" ] || [ ! -s "$dir/plan.json" ]; then
    echo "Artifact $run_id incomplete; trying another"
    continue
  fi
  if ! jq -e --arg date "$date" '.target_date == $date and (.scene_count | type=="number")' "$dir/plan.json" >/dev/null; then
    echo "Artifact $run_id plan date invalid"; continue
  fi
  if ! jq -e '.duration_seconds >= 300 and .duration_seconds <= 600' "$dir/qa.json" >/dev/null; then
    echo "Artifact $run_id failed QA"; continue
  fi
  candidate="$run_id"
  break
done
if [ -n "$candidate" ]; then
  echo "Reuse complete QA artifact from run $candidate"
  echo "decision=retry" >> "$GITHUB_OUTPUT"
  echo "source_run_id=$candidate" >> "$GITHUB_OUTPUT"
else
  echo "No complete reusable artifact; full render needed"
  echo "decision=render" >> "$GITHUB_OUTPUT"
fi
