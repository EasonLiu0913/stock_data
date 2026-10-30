# MVP10-A YouTube inspection capability and evidence contract — 20261008

Research-only. **No credential access, no YouTube requests, no uploads, no main changes, no release unlock.**

## Existing repository capability (confirmed by source inspection)
- `scripts/upload_youtube.js`: refreshes OAuth token and calls YouTube resumable upload endpoints; WRITE-ONLY workflow behavior, not a read-only verifier.
- `scripts/upload_youtube_caption.js`: refreshes OAuth token and uses `captions.insert`; no independent captions.list read-back.
- `.github/workflows/retry-upload-daily-gainers-video.yml`: research job is deliberately disabled with `if: ${{ false }}`; main untouched.
- `docs/handoffs/mvp10-20261008-private-pilot-preflight.md`: authoritative candidate date 20261008; render CI 41002179152; artifact 12953454424; 342.330667 s, 97 cues, max 30 chars.

## Permission reality: do not falsely label caption inspection read-only
1. Initial inventory: OAuth scope `https://www.googleapis.com/auth/youtube.readonly`; use only GET `channels.list?mine=true&part=id,snippet,contentDetails`, GET `playlistItems.list?playlistId=<uploads>&part=snippet,contentDetails&maxResults=50&pageToken=...` to exhaustion, GET `videos.list?part=id,snippet,status&id=...` in batches.
2. `captions.list?part=id,snippet&videoId=...` requires scope `https://www.googleapis.com/auth/youtube.force-ssl` or `youtubepartner` according to official API documentation; `youtube.readonly` is NOT sufficient. `youtube.force-ssl` can also WRITE. Any use demands separate approval, isolated GET-only runner/proxy restrictions, and scope-risk acceptance; until then caption verification remains BLOCKED, not PASS.
3. A public search API cannot prove absence of private/unlisted owned videos. Require authenticated channel match, paginated uploads inventory, receipt reconciliation, and manual review of ambiguous candidates. Zero matches alone is not proof of absence.
4. Never store tokens, authorization headers, video URLs or OAuth fingerprints in logs. Do not use existing upload secrets for inventory. No API action is authorized by this document.

## Evidence record schema (illustrative — all values absent until an authorized read)
```json
{
  "schema_version": "mvp10.youtube.inspection.v1",
  "target_date": "20261008",
  "artifact_id": "12953454424",
  "render_run_id": "41002179152",
  "artifact_sha256": null,
  "observed_at_utc": null,
  "oauth_scope_class": "youtube.readonly",
  "channel_id": null,
  "channel_match_confirmed": false,
  "uploads_playlist_id": null,
  "inventory_paginated_to_end": false,
  "inventory_count": null,
  "candidate_video_ids": [],
  "candidate_match_explanations": [],
  "video_readbacks": [],
  "receipt_lookup_status": "not_checked",
  "receipt_video_id": null,
  "captions_check": {
    "status": "not_authorized",
    "required_scope": "youtube.force-ssl",
    "track_id": null,
    "language": null,
    "track_status": null
  },
  "duplicate_video_decision": "blocked",
  "go_no_go": "NO_GO",
  "blockers": [
    "no_owner_approved_read_access",
    "no_authenticated_channel_inventory",
    "caption_read_requires_separate_elevated_scope_approval"
  ]
}
```

## Decision rules
- NO_GO if channel unverified, any pagination error, ambiguous candidate, partial receipt state, contradictory video ID, API failure, or incomplete privacy evidence.
- If an existing corresponding video is found: NEVER upload MP4 again; reconcile receipt and caption track.
- Do not use a date-scoped environment variable as independent proof of absence or caption processing.
- Only separately approved owner-authorized YouTube read inspection may populate real evidence fields. Pilot upload requires a SECOND, specific approval for exactly one video, private-only visibility, nominated channel and artifact.
- Keep research retry workflow job lock disabled, never dispatch production workflow.

Documentation checked 2026-10-30:
- https://developers.google.com/youtube/data/reference/rest/v3/channels/list
- https://developers.google.com/youtube/data/guides/implementation/channels
- https://developers.google.com/youtube/data/reference/rest/v3/captions/list
- https://developers.google.com/youtube/v3/guides/auth/client-side-web-apps
