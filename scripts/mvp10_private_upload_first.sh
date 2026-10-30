#!/usr/bin/env bash
# Research-only private pilot entry point. Not wired to any dispatch or production job.
# Explicit owner approval AND independent absence reconciliation are prerequisites.
set -euo pipefail
date="${1:?YYYYMMDD}" dir="${2:?rendered QA artifact directory}" run="${3:?render CI run}"
[[ "${GITHUB_REPOSITORY:-}" == "EasonLiu0913/stock_data" ]] || exit 1
[[ "${YOUTUBE_UPLOAD_AUTHORIZED:-}" == private-pilot ]] || { echo "private pilot authorization required" >&2; exit 2; }
[[ "${MVP_YOUTUBE_ABSENCE_VERIFIED_FOR_DATE:-}" == "$date" ]] || { echo "date-bound independent YouTube reconciliation required" >&2; exit 2; }
[[ "$date" =~ ^20[0-9]{6}$ && "$run" =~ ^[0-9]+$ ]] || exit 1
[[ -s "$dir/daily-gainers-${date}.mp4" && -s "$dir/daily-gainers-${date}.zh-TW.srt" && -s "$dir/metadata.json" && -s "$dir/qa.json" ]] || exit 1
[[ "$(jq -r '.target_date' "$dir/qa.json")" == "$date" ]] || exit 1
# Fail closed if any receipt or unreadable state; prevent accidental reupload.
dest="video_upload_receipts/mvp-private/$date.json"
status="$(gh api -i "repos/$GITHUB_REPOSITORY/contents/$dest?ref=research/daily-video-mvp10-a-20261029" 2>/dev/null | head -n 1 || true)"
[[ "$status" == *" 404 "* ]] || { echo "receipt exists or lookup failed; refuse MP4 upload: $status" >&2; exit 2; }
# This uploader requires explicit privacy=private API confirmation. The local
# checkpoint is only runner-local and MUST be committed before caption actions.
checkpoint_dir="$(mktemp -d)"
checkpoint="$checkpoint_dir/video-created.json"
trap 'rm -rf "$checkpoint_dir"' EXIT
export YOUTUBE_UPLOAD_CHECKPOINT_FILE="$checkpoint"
node scripts/upload_youtube.js "$dir/daily-gainers-${date}.mp4" "$dir/metadata.json"
[[ -s "$checkpoint" ]] || { echo "video state unknown; manual reconciliation required" >&2; exit 2; }
video_id="$(jq -er '.video_id' "$checkpoint")"
# Commit video_created before any caption call. Failure: STOP, never retry MP4.
bash scripts/persist_daily_gainers_mvp_upload_receipt.sh "$date" "$video_id" "$run"
echo "Video-created remote receipt committed; caption recovery can proceed."
bash scripts/mvp10_private_upload_recovery.sh "$date" "$dir" "$run"
# Do not mark complete until YouTube independently confirms caption and privacy.
echo "Caption operation submitted; receipt remains video_created until verification."
