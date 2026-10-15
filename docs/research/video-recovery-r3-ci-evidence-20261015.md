# R3 read-only recovery CI evidence — 2026-10-15

Status: CI PASS / EDITORIAL DATA BLOCKED / RESEARCH ONLY. This evidence does not authorize dispatch, production, cron, Pages, YouTube, main writes or Prompt B.

## Verified runs
- Initial push workflow commit `3f06910728335d2dd54344713cae29b29324ecaa`, Run [38716908303](https://github.com/EasonLiu0913/stock_data/actions/runs/38716908303), Job 116361721953: CANCELLED while checkout fetch ran; test steps skipped. Do not count as a test failure or PASS.
- Sparse checkout + blob:none + 20-minute timeout commit `bebf07b0417b3e0a297033d9c59f1240725ae411`, Run [38718959317](https://github.com/EasonLiu0913/stock_data/actions/runs/38718959317), Job 116368471131: SUCCESS. Node 24.21.0, detector and planner tests PASS, expected 20261008 BLOCKED gate verified. No artifact uploaded in that run.
- Artifact preservation commit `8868b24cfcc87a262c49504e35efce27aac08500`, Run [38719491533](https://github.com/EasonLiu0913/stock_data/actions/runs/38719491533), Job 116370252602: SUCCESS. Log includes `PASS gap detector partial date and new schema field`, `PASS read-only planner blocks unmapped recovery and does not dispatch`, `Expected BLOCKED proof verified; no publication or dispatch.`

## Durable proof
- Artifact [11964003109](https://github.com/EasonLiu0913/stock_data/actions/runs/38719491533/artifacts/11964003109), `video-recovery-readonly-proof`, uploaded 2026-10-15 10:20:04 UTC; expires 2026-10-29 10:20:03 UTC.
- Artifact metadata digest (ZIP): `sha256:d4146f6daeeee330a706261ce6192e9b9d0d22d5223ce3fb9a9e231ba37600a6`; size 1456 bytes; log confirms 3 files: `gaps.json`, `editorial.json`, `SHA256SUMS`.
- ZIP digest and successful upload were verified against GitHub's Run artifact listing and job log; individual contents have **not** been independently downloaded and rehashed in this checkpoint. Do not claim byte-level revalidation beyond the available evidence.
- Token permissions in job log: contents:read, metadata:read. Workflow has branch/path-scoped push; no dispatch/publishing steps.

## Editorial boundary and next source work
- The 20261008 opening JSON remains partial, with `breadth=null`; official dated TWSE ordinary-stock rising/falling/flat/limit-up and denominator require source/classification evidence. Do not substitute featured 5% bucket counts.
- Existing R0 inventory found broad `.github/workflows/build-twse-market-chart.yml` has main push and reusable Pages deployment; **NOT SAFE** for automatic historical breadth backfill. Dedicated date-scoped MI_INDEX and BFI82U crawler-to-output mapping remains unverified; repository default-branch code search for literal MI_INDEX/BFI82U returned no results in this round, which is inconclusive rather than proof of absence.
- Next: inspect actual main workflow/script directory and official source parser/output mapping with explicit paths, input dates, output and indirect side effects; update allowlist only for independently verified data-only workflows. Preserve A/B frozen gates and Fail-Closed behavior.

Research progress: PROGRESS. Phase A: IN_PROGRESS. Blocker: source-to-workflow mapping and 20261008 ordinary-stock breadth. Pivot: if no safe existing date-scoped crawler exists, document missing implementation and design a read-only source parser/fixture; do not dispatch a broad publication workflow.
