#!/usr/bin/env bash
# Fail-closed, create-only durable attempt reservation BEFORE the first YouTube API POST.
# A reservation without a verified final receipt needs independent YouTube reconciliation,
# never an automatic replay. No YouTube credentials or API calls occur here.
set -euo pipefail
date="${1:?YYYYMMDD required}"
source_run="${2:?source run ID required}"
video="${3:?MP4 path required}"
[[ "$date" =~ ^20[0-9]{6}$ ]] || { echo "BAD_DATE" >&2; exit 1; }
[[ "$source_run" =~ ^[0-9]+$ ]] || { echo "BAD_SOURCE_RUN" >&2; exit 1; }
test -s "$video"
: "${GH_TOKEN:?GH_TOKEN required}"
: "${GITHUB_RUN_ID:?GITHUB_RUN_ID required}"
repo="${GITHUB_REPOSITORY:?GITHUB_REPOSITORY required}"
dest="video_upload_attempts/daily-gainers/$date.json"
receipt="video_upload_receipts/daily-gainers/$date.json"
if gh api "repos/$repo/contents/$receipt?ref=main" >/dev/null 2>&1; then
  echo "EXISTING_RECEIPT: $receipt; never upload again" >&2
  exit 1
fi
if gh api "repos/$repo/contents/$dest?ref=main" >/dev/null 2>&1; then
  echo "EXISTING_OR_AMBIGUOUS_ATTEMPT: $dest; reconcile YouTube before retry" >&2
  exit 1
fi
hash="$(sha256sum "$video" | awk '{print $1}')"
json="$(jq -n --arg date "$date" --arg run "$GITHUB_RUN_ID" --arg source "$source_run" --arg hash "$hash" --arg started "$(date -u +%Y-%m-%dT%H:%M:%SZ)" '{target_date:$date,workflow_run_id:$run,source_run_id:$source,mp4_sha256:$hash,privacy:"private",attempt_status:"initiated",started_at:$started,requires_manual_reconciliation_if_incomplete:true}')"
# No SHA: GitHub Contents API rejects attempts to overwrite an existing file.
gh api -X PUT "repos/$repo/contents/$dest" \
  -f message="video: reserve one private upload attempt $date" \
  -f content="$(printf '%s' "$json" | base64 -w0)" -f branch=main >/dev/null
readback="$(gh api "repos/$repo/contents/$dest?ref=main" --jq '.content' | base64 -d)"
jq -e --arg d "$date" --arg id "$GITHUB_RUN_ID" --arg hash "$hash" '.target_date==$d and .workflow_run_id==$id and .mp4_sha256==$hash and .attempt_status=="initiated"' <<< "$readback" >/dev/null
echo "PRIVATE_UPLOAD_ATTEMPT_RESERVED: $date SHA256=$hash"
