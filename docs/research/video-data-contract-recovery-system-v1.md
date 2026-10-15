# Video Data Contract & Recovery System — research proposal v1 (2026-10-15)

Status: RESEARCH DESIGN ONLY; NOT DEPLOYED. Owner direction: future recovery coverage and the latest daily 5% video data structure evolve together. This document does not amend frozen MARKET-OPENING-MASTER-PAIR-v1, grant Prompt B, enable production, cron, Pages, YouTube, release locks or main writes. Current branch: research/market-opening-master-a-20261015.

## Goal and invariant
The **latest approved video schema** is the source of truth for required evidence. Recovery requirements are mechanically derived from that schema, never a stale hard-coded list. A date-scoped canonical master is the only verified semantic input to script, Traditional Chinese SRT, four-cell market card and narration; presenter/layout are separate. Every published numeric claim has original source/version, scope, units, as-of date, raw checksum, formula and validation status. No missing mandatory data can become a guessed number, stale fallback, synthetic fixture, green visual-only editorial PASS, or premature upload.

## Components
1. Versioned Video Data Contract Registry: schema ID/version, date, TWSE-only ordinary-stock universe, mandatory/optional fields, field-level source contract, validator, freshness/publication window, unit, precision, classification, and consumer dependency. Pin each generated video to one contract version and source snapshot.
2. Evidence Inventory/Gap Detector: resolve trading calendar and source-specific expected date; compare raw evidence, source manifests and output hashes to the selected schema; report MISSING, SOURCE_NOT_PUBLISHED, STALE_DATA_FAILED, INVALID, CONFLICT, RUNNING, BLOCKED or COMPLETE. Verify actual bytes and content, not HTTP 200 or green CI alone.
3. Allowlisted Recovery Planner: map each missing field to a verified existing workflow, exact workflow path/inputs/output, dependency DAG, source publication cadence, concurrency key date+dataset+source_version. Inspect queued/running runs and deduplicate. No generic arbitrary dispatch or broad permissions.
4. Bounded Executor (future, separately approved): GitHub-native dispatcher invokes ONLY allowlisted data crawlers with branch and permission restrictions, bounded retries/backoff and idempotent commits. No publication, Pages, YouTube, video or release-lock side effects. If connector cannot dispatch, return DISPATCH_CAPABILITY_UNAVAILABLE, not a simulated success. A research-only dry run is possible before owner-approved production.
5. Evidence Validator & Reconciliation: validate raw source date/scope/schema/units, SHA-256, source version (preliminary vs final), classification and arithmetic; preserve contradictory raw versions and select only a documented canonical version. Do not overwrite valid latest with stale data.
6. Canonical Master Builder: only validated data enters date-scoped Market Opening Master and per-stock evidence. Derive deterministic breadth/turnover/MA5/foreign/trust/dealer/regime; preserve featured gainers separately from whole-market ordinary-stock breadth.
7. Semantic Consumer/Invalidation Graph: master fingerprint -> claims manifest -> script -> TTS -> SRT -> cards -> MP4 -> private upload. When an upstream value changes, invalidate only dependent downstream artifacts, reuse unchanged verified hashes; if only upload fails, retry existing video rather than regenerate. No old V1 content allowed to override the selected schema.
8. Observability & Handoff v3: exact target date, schema ID, field gaps, source/output SHA, workflow path, dispatch capability, real Run ID/URL/jobs/logs/artifacts, retry count, blocker, next action and independent acceptance. Distinguish A implementation from B verification.

## Latest known v2 minimum contract (extend via versioned migration, never silently change)
Required opening: target_date and TWSE trading calendar; fixed three brand lines and final CC line; actual opening 30–90 seconds; TAIEX close/change/percent; whole-market TWSE listed ordinary-stock rising/falling/unchanged/limit-up and explicit denominator plus excluded/no-trade handling; verified whole-market turnover TWD and previous five TWSE trading-day average excluding target; official same-version BFI82U foreign/trust/dealers buy/sell/net TWD, scope and source date; deterministic strength/weakness interpretation from verified breadth, turnover and flows; source and claims manifests. Featured 5% stock buckets 5–7%, 7–9.5%, >=9.5%, count are a SEPARATE universe and cannot replace market breadth. Required featured-stock evidence/analysis and narration, Traditional Chinese SRT, VTuber, M8VIS cards, bottom progress bar and private preview are separately validated per current video policy; visual PASS cannot override editorial BLOCKED. Optional claims such as sector flows may be omitted only where the current approved contract explicitly marks them optional, with no invented narration.

## Version compatibility
Contract change -> new immutable schema version and explicit migration/field mapping -> update recovery allowlist/dependencies and validators -> test raw fixtures and negative cases -> safe research CI -> independent B acceptance -> separately authorized promotion. Unknown required field or unsupported source => BLOCKED. Historical 10/08 proof stays pinned to its original schema/source versions; a later schema may rebuild a new preview, not retroactively rewrite PASS. Do not conflate existing main policy's older 60–90 with the approved preregistered successor 30–90; migration records which contract governs.

## Recovery matrix (discovery required; paths are NOT guessed)
- Whole-market ordinary-stock breadth/limit-up/denominator: official dated TWSE MI_INDEX stock-specific table plus official security identity/classification; inspect existing crawler, workflow and output before binding.
- TAIEX: official MI_5MINS_HIST / existing market-chart data.
- Whole-market turnover and five prior trading-day observations: official FMTQIK / existing market-chart data, validate dates/units.
- Three institutional groups: official final BFI82U, not preliminary 15:05 version; retain exact buy/sell/net TWD and dealer proprietary+hedging split.
- Featured 5% universe: data_daily_gain_over_5 plus verified listed ordinary-stock identity, per-stock facts/news/AI/final dependencies and their actual workflows.
- Script, SRT, media: regeneration only after content gate READY; failures routed to separate media recovery, not source crawler dispatcher.

## Required acceptance experiments
A. Inventory actual workflow->source->output->inputs->trigger->side-effect mapping from remote main; detect indirect push/workflow_run/repository_dispatch chains.
B. Date-scoped 20261008 dry-run reports current partial breadth as BLOCKED, validates final BFI82U arithmetic and preserves original source versions.
C. Missing, stale, wrong date, wrong scope, wrong security class, conflicting versions, partial data, no-trade and source-not-published cases all fail closed. Duplicate in-progress Run prevents re-dispatch. Dispatch unavailable returns explicit blocker.
D. A later schema adds a required field: gap detector and recovery planner automatically identify unsupported coverage and BLOCK before video. Removing a field requires explicit approved migration; no silent weakening.
E. Same master fingerprint is asserted for script, SRT, cards and claims manifest; mismatched legacy V1 and synthetic numbers fail. Changing one source invalidates only affected media artifacts; upload retry reuses hashes.
F. CI uses isolated read-only branch/path scope; actual SHA, Run ID, job log and artifacts are inspected. No production/cron/Pages/YouTube or Prompt B execution from research.

## Implementation phases
R0 audit current real workflows and source/output contracts; R1 schema/registry + gap detector (read-only); R2 source validators and dry-run planner; R3 isolated CI and synthetic negative tests; R4 single Master/consumer dependency wiring and private preview; R5 independent B only after explicit owner approval; R6 production dispatcher and scheduled adoption only after separate owner authorization. Goal-Anchored Handoff v3: A remains IN PROGRESS, no retrospective PASS.

## Update protocol
Every future approved video schema revision must include a matching recovery coverage diff, field-to-source mapping, validation migration, fixture set and rollback plan in the same review. A change is not ready if the data recovery system cannot supply and verify every mandatory field. This is a standing architecture rule for future changes, not a claim of background autonomous work or an enabled schedule.
