# MVP10-A — Minimal YouTube Read-Only Inspection Change Proposal
Status: PROPOSED ONLY. Research branch; no YouTube connection, secrets, workflow dispatch or main modification.

## Existing code assessment
- No stand-alone GET-only YouTube API inventory tool was found in the research branch scripts/ or workflows.
- Reuse `scripts/decide_daily_gainers_video_upload.sh` for **GitHub-only** artifact and receipt listing (but do not reuse its receipt-absence assumption as permission to upload).
- Reuse secret normalization patterns from `scripts/upload_youtube.js` only after owner-authorized least-privilege access; NEVER import or execute the upload script for inspection.
- `scripts/upload_youtube_caption.js`, `scripts/upload_youtube_thumbnail.js`, `recover-daily-gainers-youtube-assets.yml` and `backfill-daily-gainers-youtube-caption.yml` all make writes; do not invoke them for read-only verification.
- Keep `.github/workflows/retry-upload-daily-gainers-video.yml` job disabled (`if: ${{ false }}`).

## Smallest proposed implementation (not implemented or approved)
1. Add one standalone `scripts/inspect_youtube_private_candidate.js` implementing only HTTP GET:
   - `channels.list(mine=true,part=id,contentDetails,snippet)`;
   - `playlistItems.list(part=snippet,contentDetails,playlistId=uploads,maxResults=50)` paginated to completion;
   - `videos.list(part=id,snippet,status,id=...)` to verify candidate privacy and ownership.
   - Treat token/scope missing, API errors, pagination incomplete or ambiguous duplicates as NO_GO.
   - No POST/PUT/PATCH/DELETE, no upload functions, no ability to emit upload authorization.
2. OAuth read scope ONLY `https://www.googleapis.com/auth/youtube.readonly`; provide through independently authorized, short-lived credential input, never reuse existing write-scoped YouTube Actions secrets. Treat scope grants as user-authorized actions; do not request or fetch credentials under current instructions.
3. Add `tests/inspect_youtube_private_candidate.test.js` with mocked GET responses: one channel, paginated uploads, private duplicate found, unknown privacy, token unavailable, partial pagination, HTTP 403/429/500, and response-schema invalid. Assert NO_GO unless evidence fully reconciled.
4. Emit a redacted local evidence JSON conforming to `docs/handoffs/mvp10-20261008-youtube-readonly-evidence.md` with real `observed_at_utc`, channel, run, artifact hash, inventory coverage, candidate IDs, privacy, status and reasons; **never** write tokens, authorization headers, unredacted private URLs, OAuth fingerprints.
5. Do not implement caption inspection in readonly pass: `captions.list` requires `youtube.force-ssl` or `youtubepartner`, not `youtube.readonly`. Require separate risk acceptance and isolated GET-only enforcement before any such verification.

## Acceptance
- Unit tests pass with no network or credentials; verify GET-only on fake transport.
- GitHub-only 20261008 artifact metadata and date remain pinned: run `41002179152`, artifact `12953454424`.
- Single reviewer verifies evidence cannot authorize uploads and cannot be mistaken for completed YouTube inspection.
- `main`, scheduled workflows, retry dispatch, research lock and release locks remain unchanged.
- Actual read-only access, caption-scope expansion and private upload each require separate owner consent.

## Pre-existing risk independent of this proposal
`scripts/decide_daily_gainers_video_upload.sh` treats a failed GitHub receipt existence lookup as lack of receipt; it does not independently check YouTube. The production retry/orchestrator therefore must not be used for a pilot without separately reviewed fail-closed guard. Do not change main under this proposal.
