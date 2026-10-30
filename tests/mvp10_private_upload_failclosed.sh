#!/usr/bin/env bash
set -euo pipefail
root="$(mktemp -d)"
trap 'rm -rf "$root"' EXIT
mkdir -p "$root/bin" "$root/artifact"
cat > "$root/bin/gh" <<'SH'
#!/usr/bin/env bash
printf 'HTTP/2 %s\n' "${MOCK_HTTP_STATUS:-500}"
SH
chmod +x "$root/bin/gh"
printf 'mp4' > "$root/artifact/daily-gainers-20261008.mp4"
printf 'caption' > "$root/artifact/daily-gainers-20261008.zh-TW.srt"
printf '{}' > "$root/artifact/metadata.json"
printf '{"target_date":"20261008"}' > "$root/artifact/qa.json"
for http in 200 403 500; do
  if PATH="$root/bin:$PATH" GITHUB_REPOSITORY=EasonLiu0913/stock_data YOUTUBE_UPLOAD_AUTHORIZED=private-pilot MVP_YOUTUBE_ABSENCE_VERIFIED_FOR_DATE=20261008 MOCK_HTTP_STATUS="$http" bash scripts/mvp10_private_upload_first.sh 20261008 "$root/artifact" 41002179152 > "$root/result" 2>&1; then
    echo "FAIL: status $http unexpectedly permitted upload" >&2; exit 1
  fi
  grep -q 'receipt exists or lookup failed' "$root/result"
done
# Unauthorized, even with a 404 receipt, cannot initiate an upload.
if PATH="$root/bin:$PATH" GITHUB_REPOSITORY=EasonLiu0913/stock_data MOCK_HTTP_STATUS=404 bash scripts/mvp10_private_upload_first.sh 20261008 "$root/artifact" 41002179152 > "$root/result" 2>&1; then exit 1; fi
grep -q 'private pilot authorization required' "$root/result"
# With authorization but no independently attested absence, 404 still denies upload.
if PATH="$root/bin:$PATH" GITHUB_REPOSITORY=EasonLiu0913/stock_data YOUTUBE_UPLOAD_AUTHORIZED=private-pilot MOCK_HTTP_STATUS=404 bash scripts/mvp10_private_upload_first.sh 20261008 "$root/artifact" 41002179152 > "$root/result" 2>&1; then exit 1; fi
grep -q 'date-bound independent YouTube reconciliation required' "$root/result"
# A false completion claim cannot update any remote receipt.
if PATH="$root/bin:$PATH" GITHUB_REPOSITORY=EasonLiu0913/stock_data YOUTUBE_UPLOAD_AUTHORIZED=private-pilot MOCK_HTTP_STATUS=200 bash scripts/mvp10_private_upload_complete.sh 20261008 SyntheticVideo123 > "$root/result" 2>&1; then exit 1; fi
grep -q 'independent privacy/caption verification required' "$root/result"
echo "PASS: unauthorized, missing attestation, receipt exists, 403 and 500 all fail closed; no external calls"

# Mock a confirmed video creation followed by remote checkpoint PUT failure.
# Confirm no caption step is executed and no second MP4 upload follows on retry.
cat > "$root/bin/gh" <<'SH'
#!/usr/bin/env bash
case "$*" in
  *"-i"*) printf 'HTTP/2 404\n' ;;
  *"-X PUT"*) echo "simulated GitHub 503 during receipt write" >&2; exit 1 ;;
  *) echo "unexpected gh call" >&2; exit 1 ;;
esac
SH
chmod +x "$root/bin/gh"
if PATH="$root/bin:$PATH" GITHUB_REPOSITORY=EasonLiu0913/stock_data YOUTUBE_UPLOAD_AUTHORIZED=private-pilot bash scripts/persist_daily_gainers_mvp_upload_receipt.sh 20261008 SyntheticVideo123 41002179152 > "$root/result" 2>&1; then
  echo "FAIL: remote receipt write unexpectedly succeeded" >&2; exit 1
fi
grep -q 'simulated GitHub 503' "$root/result"
# A retry without a durable receipt stays blocked until separately verified YouTube reconciliation.
if PATH="$root/bin:$PATH" GITHUB_REPOSITORY=EasonLiu0913/stock_data YOUTUBE_UPLOAD_AUTHORIZED=private-pilot bash scripts/mvp10_private_upload_recovery.sh 20261008 "$root/artifact" 41002179152 > "$root/result" 2>&1; then
  echo "FAIL: resumed captions with absent receipt" >&2; exit 1
fi
grep -q 'No receipt: YouTube state unknown' "$root/result"
echo "PASS: failed remote receipt PUT prevents caption recovery, retry fails closed"
