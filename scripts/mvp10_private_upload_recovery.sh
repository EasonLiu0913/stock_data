#!/usr/bin/env bash
# Research branch private-pilot handoff. Never invoked by production.
# The caller must separately authorize a private pilot and supply a verified,
# date-bound YouTube absence attestation before any first-upload route.
set -euo pipefail
date="${1:?YYYYMMDD}" artifact_dir="${2:?QA artifact directory}" source_run="${3:?source render run ID}"
[[ "${GITHUB_REPOSITORY:-}" == "EasonLiu0913/stock_data" ]] || exit 1
[[ "${YOUTUBE_UPLOAD_AUTHORIZED:-}" == "private-pilot" ]] || { echo "owner authorization required" >&2; exit 1; }
[[ "$date" =~ ^20[0-9]{6}$ && "$source_run" =~ ^[0-9]+$ ]] || exit 1
[[ -s "$artifact_dir/daily-gainers-${date}.mp4" && -s "$artifact_dir/daily-gainers-${date}.zh-TW.srt" && -s "$artifact_dir/qa.json" && -s "$artifact_dir/metadata.json" ]] || { echo "missing QA package" >&2; exit 1; }
[[ "$(jq -r '.target_date' "$artifact_dir/qa.json")" == "$date" ]] || { echo "QA date mismatch" >&2; exit 1; }
receipt="video_upload_receipts/mvp-private/${date}.json"
status="$(gh api -i "repos/$GITHUB_REPOSITORY/contents/$receipt?ref=research/daily-video-mvp10-a-20261029" 2>/dev/null | head -n 1 || true)"
route_file="$(mktemp)"
trap 'rm -f "$route_file" "$receipt_data"' EXIT
receipt_data="$(mktemp)"
if [[ "$status" == *" 200 "* ]]; then
  gh api "repos/$GITHUB_REPOSITORY/contents/$receipt?ref=research/daily-video-mvp10-a-20261029" --jq '.content' | base64 -d > "$receipt_data"
  export MVP_UPLOAD_RECEIPT_FILE="$receipt_data"
elif [[ "$status" == *" 404 "* ]]; then
  echo "No receipt: YouTube state unknown. Manual reconciliation required; upload blocked" >&2
  exit 2
else
  echo "Receipt lookup failure: $status" >&2; exit 1
fi
export MVP_TARGET_DATE="$date"
node scripts/daily_gainers_mvp_upload_route.js > "$route_file" || { cat "$route_file"; exit 2; }
action="$(jq -r '.action' "$route_file")"
video_id="$(jq -r '.videoId // empty' "$route_file")"
case "$action" in
  already_uploaded) echo "Private upload complete; no duplicate work"; exit 0 ;;
  captions_only)
    [[ "$video_id" =~ ^[A-Za-z0-9_-]{8,}$ ]] || exit 1
    # The durable receipt was already committed after MP4 creation.
    # Never upload another MP4 on any retry.
    node scripts/upload_youtube_caption.js "$video_id" "$artifact_dir/daily-gainers-${date}.zh-TW.srt"
    echo "Caption operation completed for $date; receipt still video_created pending independently verified caption + privacy confirmation"
    ;;
  *) echo "Unsafe or unsupported upload route: $action" >&2; exit 2 ;;
esac
