#!/usr/bin/env bash
# MVP research-only, deliberately NOT invoked by production workflows.
set -euo pipefail
: "${GITHUB_REPOSITORY:?}"
[[ "$GITHUB_REPOSITORY" == "EasonLiu0913/stock_data" ]] || { echo "wrong repository" >&2; exit 1; }
[[ "${YOUTUBE_UPLOAD_AUTHORIZED:-}" == "private-pilot" ]] || { echo "private pilot not authorized" >&2; exit 1; }
date="${1:?YYYYMMDD}" video_id="${2:?YouTube video ID}" source_run="${3:?render run ID}"
[[ "$date" =~ ^20[0-9]{6}$ && "$video_id" =~ ^[A-Za-z0-9_-]{8,}$ && "$source_run" =~ ^[0-9]+$ ]] || { echo "invalid identity" >&2; exit 1; }
# Never write to main; a durable separate receipt branch must be explicitly provisioned.
receipt_branch="research/daily-video-mvp10-a-20261029"
dest="video_upload_receipts/mvp-private/${date}.json"
if gh api "repos/$GITHUB_REPOSITORY/contents/$dest?ref=$receipt_branch" >/dev/null 2>&1; then
  echo "Receipt exists: stop; reconcile video and captions before retry" >&2
  exit 2
fi
payload="$(node scripts/daily_gainers_mvp_upload_receipt.js "$date" "$video_id" "$source_run" private "/tmp/mvp-private-receipt-${date}-$$.json" | tail -1)"
receipt_file="${payload##*: }"
[[ -s "$receipt_file" ]] || exit 1
encoded="$(base64 -w0 < "$receipt_file")"
# GitHub Contents API create only: no SHA supplied => existing file is a conflict.
gh api -X PUT "repos/$GITHUB_REPOSITORY/contents/$dest" \
  -f branch="$receipt_branch" \
  -f message="mvp: persist private video-created checkpoint $date" \
  -f content="$encoded" >/dev/null
echo "Created durable private-video receipt: $receipt_branch:$dest"
