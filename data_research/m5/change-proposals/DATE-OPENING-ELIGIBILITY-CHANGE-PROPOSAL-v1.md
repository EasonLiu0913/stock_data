# Date-scoped Market Opening and Eligible Universe Repair — CHANGE_PROPOSAL v1

**Status:** Owner-approved for documentation registration only (2026-11-08). Registered on remote `main` only when this document, the frozen pair, canonical handoff update, and task state file are present in one verified commit. This approval does not authorize Prompt A until registration is verified; it does not authorize YouTube or Render actions.

**Repository:** `EasonLiu0913/stock_data`  
**Review baseline:** remote `main` `489d839526237f8d8d9590edd672da7904c51d71`  
**Project / goal:** `daily-gainers-market-opening-end-to-end` / `goal-v3/MVP-10DAY-v1`  
**Frozen predecessor:** `MVP10-A` and `MVP10-B` in `data_research/m5/change-proposals/DAILY-VIDEO-MVP-10DAY-PAIR-v1.md` (unchanged).

## Owner-approved decision and phase order

The owner approved a separate versioned repair phase and its own immutable A/B pair, without changing the original MVP10 A/B criteria, global editorial policy, raw 5% list, or release locks. Breadth is split into two explicit fields. The existing MVP10-A phase is deferred behind this necessary predecessor because the checked 20261102 path does not prove the date/classification and complete media criteria in frozen A.

The single active project and goal remain unchanged. The phase order is:

1. `MVP10-OPENING-ELIGIBILITY-REPAIR-v1` — active/promoted, Prompt A not started; Prompt B frozen/not eligible.
2. `MVP10-A` — pending predecessor completion; original acceptance text unchanged.
3. `MVP10-B` — frozen/not eligible until original A is durably complete and a separate owner command selects B.

The repair phase stops before Render. Completing its A/B does not pass MVP10-A, make MVP10-B eligible, or trigger automatic continuation.

## 20261102 feasibility evidence and sequencing

The existing `.github/workflows/daily-gainers-20261102-render-only.yml` (remote blob `4e1e3aaa748c160e4ee1ea8e2f7f47cddf9e2e77`) is a genuine workflow_dispatch-capable, upload-free render path. Run [41799842426](https://github.com/EasonLiu0913/stock_data/actions/runs/41799842426) succeeded at head `25327abefd2212c86b82386ee86e5cb5b4b2c97a`; job `126475875979`; artifact `13308740997`, digest `sha256:ec12a4370289e7c36e154789113e17adf03d82526c10a67b3542f2e37b350a2b`, 18,007,593 bytes. Two earlier successful runs for the same workflow were also found (`41798517320`, `41786313379`). These are reusable render evidence, not proof of full MVP10-A acceptance.

The latest 20261102 artifact/run does **not** satisfy the complete original A/B gates:

- Its workflow validates 29 dashboard stocks and a 12-scene rendered plan, but does not call `scripts/validate_daily_gainers_market_opening.js`.
- The remote 20261102 opening blob `c275b0657ad5e8f267a58ebff5cde9dfaa4494cd` is schema v1 and has `breadth.scope: TWSE_MI_INDEX_OFFICIAL_STOCK_COLUMN`; it has no common-stock identities. The current opening validator requires date-verified `TWSE_COMMON_STOCK` identities. Do not promote this old snapshot or infer stock classifications from its row count.
- The workflow explicitly accepts `render-only-visual-check.json` status `PASS_STATIC_AND_PIXEL_DELTA_VISUAL_REVIEW_PENDING` and `burned-caption-proof.json` status `BURN_EXECUTED_VISUAL_QA_PENDING`. The workflow artifact path list has no thumbnail artifact. Original MVP10-A requires visual/occlusion review and a thumbnail.
- The 20261102 run is useful durable render evidence, but date-effective featured-stock classification, full opening validation, thumbnail, and completed visual QA remain unproven. Therefore it cannot be the accepted MVP10-A date by itself.

Because no checked existing date satisfies the frozen date/classification + opening + complete media criteria, this approved repair phase is the necessary predecessor for using 20261104 as the acceptance date. MVP10-A must still complete its own render/thumbnail/visual QA work afterward. Do not rerun old runs solely to change this conclusion.

## Confirmed remote contract and approved field design

At the review baseline:

- `scripts/validate_daily_gainers_market_opening.js`, blob `a81b072d2f8eb7e3dfa39b80b6a5189ec6e9dfa6`, requires `snapshot.breadth.scope === "TWSE_COMMON_STOCK"`, date-verified `COMMON_STOCK` identities, and a denominator of advancers + decliners + unchanged + no-trade.
- `scripts/materialize_daily_gainers_dual_track.js`, blob `b75f3333b65073987bd1f188bfd48dc3ac395731`, currently reads `snapshot.breadth` as `TWSE_MI_INDEX_OFFICIAL_STOCK_COLUMN`.
- `scripts/build_twse_common_stock_breadth.js` returns `no_comparison_count` and includes it in the five-bucket identity denominator. The opening validator currently omits that bucket. This is a demonstrated builder/validator mismatch.

The owner approved this v2 snapshot contract for the repair phase:

```json
{
  "schema_version": 2,
  "breadth": {
    "scope": "TWSE_COMMON_STOCK",
    "advancers": 0,
    "decliners": 0,
    "unchanged": 0,
    "eligible_count": 0,
    "gainers_5pct_count": 0,
    "no_trade_count": 0,
    "no_comparison_count": 0,
    "excluded_non_common_count": 0,
    "identities": [],
    "source_manifest": []
  },
  "market_opening_breadth": {
    "scope": "TWSE_MI_INDEX_OFFICIAL_STOCK_COLUMN",
    "source_date": "YYYYMMDD",
    "advancers": 0,
    "decliners": 0,
    "unchanged": 0,
    "limit_up": 0,
    "limit_down": 0,
    "no_trade": 0,
    "no_comparison": 0,
    "source_manifest": []
  }
}
```

The numeric zeroes above are schema examples only, never daily values. `snapshot.breadth` remains the ordinary-common-stock classification result. The deterministic opening and materializer read only `snapshot.market_opening_breadth` for official MI_INDEX breadth. Each field retains its own scope, date, source records and hashes. The v2 opening validator must require both fields and verify their separate sources, dates, counts and identities. It must count `no_comparison_count` in the common-stock denominator. The materializer must fail closed unless the dedicated MI_INDEX field and its provenance match the target date. No relabeling or reuse of one count as the other.

## Scope, outputs, and constraints

First validation date: `20261104`. Reuse existing source records and 44-stock research only when their identity/blob/SHA is unchanged. Do not edit the raw 5% list or manually remove/qualify `910322` or any other instrument. Produce a date-effective classification record for every source-list entry; unresolved classifications stay unresolved. The MVP10 featured sample must contain only symbols proven to meet the frozen MVP10 ordinary-stock criterion; daily inclusive reporting rules remain governed by the existing editorial policy.

Required durable outputs (exact paths frozen for this pair):

- `data_daily_gain_over_5/market-opening-video/20261104.json` — schema v2 complete snapshot, both breadth fields, full opening facts and provenance.
- `data_daily_gain_over_5/verification/video-eligible-universe/20261104.json` — derived record covering every raw-list code, classification evidence/as-of date, eligibility decision/reason, source URL and archive SHA256; no source-list mutation.
- Updates to `scripts/validate_daily_gainers_market_opening.js`, `scripts/materialize_daily_gainers_dual_track.js`, and their existing tests only as required by this contract.
- `.github/workflows/build-daily-gainers-market-opening-video.yml` — required new manual `workflow_dispatch` workflow with `target_date`; no complete date-scoped opening builder/persistence workflow exists at baseline. It may commit only validated date-scoped opening and eligibility outputs, with least-privilege `contents: write`, date concurrency, no cron/push trigger, no Render, YouTube, or public-release action. The filename is proposed and absent at baseline.

Candidate gates use these exact commands after implementation:

- Snapshot validator CLI: `node scripts/validate_daily_gainers_market_opening.js 20261104` (the phase must add this deterministic CLI entry to the current exported validator).
- Regression suite: `node --test tests/daily_gainers_market_opening.test.js tests/daily_gainers_dual_track.test.js tests/build_twse_common_stock_breadth.test.js tests/merge_daily_gainers_market_opening_breadth.test.js`.
- Downstream integration: `node scripts/materialize_daily_gainers_dual_track.js 20261104`, `node scripts/validate_daily_gainers_video_script.js 20261104`, and `node scripts/validate_daily_gainers_news_narration.js 20261104`, only when each documented input is present.

Formal status comes only from the validators and remote artifacts. No hand-set `verified`, `complete`, or PASS; no partial-to-complete promotion; no prior-day fallback; no weakening source SHA/date/units or frozen A/B criteria.

## A/B phase boundary

The paired contract at `data_research/m5/change-proposals/DATE-OPENING-ELIGIBILITY-REPAIR-PAIR-v1.md` is immutable before A. Prompt A implements only the listed date-specific repair and verifies durable outputs on remote `main`. Prompt B independently checks the same frozen contract, original MVP10 pair immutability, tests, hashes, source evidence and scope. This repair pair does not include Render, upload, scheduling or publication. Failure remains blocked/incomplete; no automatic promotion.

## Owner authorization and registration

The owner decisions recorded in this file authorize registration of this phase and its paired prompts. They do not authorize implementation until all registration artifacts are verified on current remote `main`. Registration must be one documentation-only commit containing this proposal, the immutable paired prompt, the canonical handoff phase-order update, and `docs/handoffs/state/daily-gainers-market-opening-end-to-end.json`. Keep `docs/agent-prompts/task-routing.json` unchanged because the active project and goal do not change. Do not alter the frozen MVP10 pair or global editorial policy.

After registration verification, stop. The next owner command may be `promptA` for `MVP10-OPENING-ELIGIBILITY-REPAIR-v1`; it is not run in the registration turn.

## Safety

YouTube upload, private/unlisted pilot, scheduling, public publication and release-lock changes remain prohibited. No Render-only dispatch in this repair phase. MVP10-A/B acceptance remains byte-for-byte unchanged. Owner approval of this proposal is not a claim that any opening, script, render, or end-to-end delivery has passed.
