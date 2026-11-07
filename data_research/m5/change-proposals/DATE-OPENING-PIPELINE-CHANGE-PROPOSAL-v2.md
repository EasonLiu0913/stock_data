# Date-scoped Official Market Opening Pipeline — CHANGE_PROPOSAL v2

**Status:** Owner-approved for versioned registration on 2026-11-08, based on the owner's request to redirect Prompt A toward producing an automatable video pipeline and away from nonessential historical ordinary-stock research. This registration does not start Prompt A.
**Repository:** `EasonLiu0913/stock_data`
**Project / goal:** `daily-gainers-market-opening-end-to-end` / `goal-v3/MVP-10DAY-v1`
**Review baseline:** remote `main` `98b14884bc5656fb18ec6ec272f0f5c11b029378`
**Supersedes prospectively:** `DATE-OPENING-ELIGIBILITY-CHANGE-PROPOSAL-v1.md` and its blocked R1 execution direction. The v1 proposal, pair, checkpoint, code commit and evidence remain immutable history; no past PASS is rewritten.
**Original acceptance:** `DAILY-VIDEO-MVP-10DAY-PAIR-v1.md` and its MVP10-A/B acceptance remain unchanged.

## Owner decision

The repair phase must remove date-effective ordinary-stock classification from the **market-opening completeness gate**. The opening's breadth is the official TWSE MI_INDEX stock-column measure, labeled exactly `TWSE_MI_INDEX_OFFICIAL_STOCK_COLUMN`. It must not be described as ordinary-stock-only. A historical ordinary-stock archive is not a prerequisite to generating or validating this official market opening.

The 5% source list remains untouched. Any separate instrument eligibility requirement is handled only by the current applicable video policy and its explicit validator, and cannot block the independent official opening builder. Do not start an archive hunt, classification backfill, breadth redesign, or symbol-by-symbol taxonomy review unless a specific current formal gate requires that exact item for the downstream featured-stock script. If such a gate exists, isolate that blocker and keep building/validating the opening.

## Why this version is needed

Repair v1 coupled opening PASS to a date-effective TWSE_COMMON_STOCK archive even though the owner-approved daily editorial policy specifies official TWSE stock-column breadth for the opening. That coupling recreated an earlier prolonged data-verification loop and prevented work on the missing opening builder and date-scoped workflow. The v1 code checkpoint exposed the coupling and fixed the no-comparison arithmetic, but did not yet provide the official opening producer or workflow.

## Frozen v2 scope and decisions

1. Build the smallest reusable, deterministic, date-scoped official opening path from existing same-date verified sources and receipts.
2. Required opening evidence is limited to the current editorial contract: MI_INDEX stock-column breadth; index values; whole-market turnover and the prior-five-trading-day comparison; foreign, investment-trust and dealer net values and their verified total; exact source date, source URL/endpoint, units, source SHA-256, and receipt identity.
3. Use `snapshot.market_opening_breadth.scope = "TWSE_MI_INDEX_OFFICIAL_STOCK_COLUMN"` for opening breadth. Do not relabel or derive it from an unverified ordinary-stock master. A `TWSE_COMMON_STOCK` field may be preserved only as optional separately sourced research; its absence or pending status cannot fail the opening gate.
4. Do not edit the raw 5% list, global editorial policy, original MVP10 pair, YouTube settings or release locks. Do not weaken source-date, SHA, numeric, receipt, script, news, A/B or media safety gates.
5. Keep the repair phase upload-free and render-free. A repair PASS does not pass MVP10-A/B or trigger them.

## Phase order

- Historical phase `MVP10-OPENING-ELIGIBILITY-REPAIR-v1`, R1: blocked/incomplete and retained as historical evidence.
- New prospective phase `MVP10-OPENING-PIPELINE-REPAIR-v2`, R1: owner-approved and active only after proposal, immutable pair, handoff and state are registered together on remote main.
- Original `MVP10-A`: remains pending behind the repair phase with its original frozen criteria.
- Original `MVP10-B`: remains ineligible until its original paired prerequisites are met and a fresh owner command selects it.

## Completion criteria for this proposal

The paired Prompt A/B must specify the exact schema and source fields, tests, reusable opening builder, date-only manual workflow, remote durability checks and stop conditions before A starts. Historical ordinary-stock identity must not appear as a required opening field or as an A/B opening acceptance criterion. Prompt B independently verifies only the frozen v2 criteria. After v2 Prompt B PASS, promote only the unchanged MVP10-A and stop for a fresh owner command.

YouTube upload, scheduling, public release and release-lock changes remain forbidden. No Render dispatch is authorized by this proposal.
