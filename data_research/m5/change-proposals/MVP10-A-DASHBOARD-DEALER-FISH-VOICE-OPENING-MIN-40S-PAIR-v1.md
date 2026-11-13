# MVP10-A Dashboard Dealer + Fish Voice Opening Minimum 40s — Frozen Prompt A/B Pair v1

Status: Owner-approved versioned successor; preregistered before its Prompt A.
Project / goal: `daily-gainers-market-opening-end-to-end` / `goal-v3/MVP-10DAY-v1`
Phase / round: `MVP10-A-DASHBOARD-DEALER-FISH-VOICE-OPENING-MIN-40S-R2`
Predecessor: `MVP10-A-DASHBOARD-DEALER-FISH-VOICE-0715599C-R1`
Change proposal: `data_research/m5/change-proposals/MVP10-A-DASHBOARD-DEALER-FISH-VOICE-OPENING-MIN-40S-CHANGE-v1.md`
Canonical handoff: `docs/handoffs/daily-gainers-market-opening-end-to-end.md`
Target date: `20261104`
New voice: `fish:0715599c7277458591efda3ff230a51e`
Registration base main: `7263cedca041644343deac38d06f93a2d718816e`

## Version boundary

R1's frozen acceptance and history are immutable. R1's 60–90-second opening requirement and its 50.808-second unmet result remain recorded as-is; R1 is superseded by this owner-approved successor, **not passed**. The sole R2 acceptance delta is the actual spoken market-opening scene duration: **finite measured duration >=40.000 seconds, with no maximum**. This successor applies that rule prospectively. The existing run/artifact may be reused only after R2 independently verifies all identities and unchanged gates; it cannot rewrite R1's result.

## Frozen constraints

1. Use the frozen target date 20261104 and the exact registered date/script/plan inputs unless their identities are proven unchanged. No re-freezing or editing old hashes.
2. Keep the Dashboard's seven fields: 標的／代號, 漲幅, 外資(張), 投信(張), 融資(張), 自營商(張), 分點買／賣. Dealer lots come only from `flow.dealer.net_lots`; broker buy/sell remains separate. Missing dealer data is neutral unavailable, never zero.
3. Use exact Fish voice `fish:0715599c7277458591efda3ff230a51e`, existing provider/model/rate/parser/pipeline identity, and its isolated checkpoint namespace. Never use the old voice checkpoint to satisfy this successor.
4. Verify all 17 ordered scene identities and MP3/WordBoundary SHA-256 hashes, script/date/text/provider fingerprints, and durable checkpoint provenance.
5. The actual rendered market-opening audio duration is finite and at least 40.000 seconds; no upper bound. 39.999 seconds fails; 40.000 seconds passes; an otherwise valid duration above 90 seconds also passes. Character-count or estimated duration is not evidence.
6. The whole MP4 remains at least 300 seconds with no maximum. All source, script, SRT alignment, burned-caption, media QA, thumbnail, provenance and exact-artifact human visual review requirements remain unchanged.
7. Render-only must consume the matching checkpoint without TTS calls. Fail closed on any identity/hash/date/coverage mismatch.
8. No YouTube upload, scheduling, public release, upload/orchestrator, Pages, release-lock changes, checkpoint deletion or automatic continuation.

## Prompt A — implementation and R2 evidence

Execute only after this pair and the R2 promotion are present on current remote main and the owner issues a separate `promptA`.

1. Read AGENTS.md, Goal-Anchored Handoff v3, the canonical handoff, this proposal/pair and current Task State. Verify the unique active route and R2 phase identity on fresh main.
2. Preserve R1's immutable pair/result. Re-read run #43347687018, job #131630895392, artifact #14002714186 and its recorded media/provenance hashes. Revalidate the new-voice Fish checkpoint run #43340699051, branch `tts-audio-pending-20261104-fish-0715599c7277458591efda3ff230a51e`, commit `ca6a5ea656b3cb4718886391ab3b846ed00fbd2b`, manifest blob `06b9ba677553fb3e04f6594d5614d4a8fc138801`, and 17/17 scene hashes.
3. Implement a fail-closed actual opening-duration predicate in `scripts/render_daily_gainers_video.js` and enforce/report it from `.github/workflows/daily-gainers-date-render-only.yml`. The emitted QA must identify the measured opening scene duration and pass only finite values >=40.000 seconds; do not impose an upper bound. Keep the whole-video >=300/no-maximum rule separate.
4. Add regression cases in `tests/daily_gainers_video_duration_gate.test.js`: 39.999 fails, 40.000 passes, the observed 50.808 passes, a valid value above 90 passes, and NaN/missing duration fails closed. Keep the existing total-video duration cases.
5. Run focused tests and relevant CI on the changed input. Resolve only relevant failures without reducing unrelated gates. If code is merged and the registered Render-only run is authorized, run date-scoped Render-only for 20261104. Reuse the matching completed Fish checkpoint; do not call Fish TTS or regenerate matching scenes. Inspect real run/job/log/artifact and provenance.
6. Obtain/verify human visual review for the exact seven-column new-format artifact; do not substitute an old-format review. Keep A incomplete if this owner evidence or any other unchanged gate is missing.

Prompt A completion contract: implementation and regression are merged; actual Render-only QA enforces and records opening >=40 seconds/no maximum; all 17 new-voice checkpoint identities and hashes pass; same-date media and every unchanged gate, including exact-artifact visual review, are verified. Otherwise A remains blocked/incomplete. Never auto-run B.

## Prompt B — independent closeout, frozen before A

After A claims complete, independently verify on fresh current main:

1. Confirm R2 proposal/pair and Task State identities; confirm R1's frozen 60–90 criterion and its historical result remain unmodified and are not marked PASS.
2. Inspect the code and tests at `scripts/render_daily_gainers_video.js`, `.github/workflows/daily-gainers-date-render-only.yml`, and `tests/daily_gainers_video_duration_gate.test.js`. Verify 39.999 fails, 40.000 passes, 50.808 passes, >90 passes, invalid/missing fails, and whole-video duration independently remains >=300 with no maximum.
3. Verify the exact target date, frozen input/script/plan, new voice and all 17 ordered MP3/WordBoundary hash identities against the remote checkpoint manifest/blobs.
4. Verify the actual authorized Render-only run used that checkpoint and made no Fish request; independently inspect its real MP4/SRT, measured opening duration, total duration, caption burn/alignment, QA, thumbnail, provenance and artifact SHA.
5. Verify the exact seven-column Dashboard and human visual-review evidence for this artifact.
6. Confirm no YouTube/upload/scheduling/public release, Pages, lock change, checkpoint deletion, old-voice reuse, false PASS or history rewrite occurred.
7. If any criterion fails, preserve the failure and run IDs; repair only within this frozen R2 acceptance and perform one bounded verification on changed inputs. Do not weaken the >=40-second floor or any inherited gate.

Closeout: on full PASS, record durable evidence and close only R2; do not mark the ultimate video project complete or automatically promote/start another phase.

## Stop conditions

No Prompt A until registration is on main and a separate owner command starts it. No Prompt B until R2 A is durably complete. No automatic continuation. No YouTube or Pages actions.
