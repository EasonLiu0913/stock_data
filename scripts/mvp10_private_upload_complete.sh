#!/usr/bin/env bash
# Research-only final receipt transition AFTER independent YouTube verification.
set -euo pipefail
date="${1:?YYYYMMDD}" video_id="${2:?confirmed private video ID}"
[[ "${GITHUB_REPOSITORY:-}" == EasonLiu0913/stock_data ]] || exit 1
[[ "${YOUTUBE_UPLOAD_AUTHORIZED:-}" == private-pilot ]] || exit 2
[[ "${MVP_YOUTUBE_PRIVATE_AND_CAPTIONS_VERIFIED_FOR_DATE:-}" == "$date" ]] || { echo "independent privacy/caption verification required" >&2; exit 2; }
[[ "$date" =~ ^20[0-9]{6}$ && "$video_id" =~ ^[A-Za-z0-9_-]{8,}$ ]] || exit 1
branch=research/daily-video-mvp10-a-20261029
path="video_upload_receipts/mvp-private/$date.json"
body="$(gh api "repos/$GITHUB_REPOSITORY/contents/$path?ref=$branch")" || exit 1
sha="$(jq -er '.sha' <<<"$body")"
receipt="$(jq -r '.content' <<<"$body" | base64 -d)"
updated="$(jq -c --arg date "$date" --arg id "$video_id" '
  if .target_date==$date and .youtube_video_id==$id and .privacy=="private" and .upload_status=="video_created" and (.fixture_only!=true)
  then .upload_status="complete" else error("untrusted or mismatching receipt") end' <<<"$receipt")" || exit 1
encoded="$(printf '%s' "$updated" | base64 -w0)"
gh api -X PUT "repos/$GITHUB_REPOSITORY/contents/$path" -f branch="$branch" -f sha="$sha" -f message="mvp: finalize independently verified private caption $date" -f content="$encoded" >/dev/null
echo "Finalized verified receipt: $date"
