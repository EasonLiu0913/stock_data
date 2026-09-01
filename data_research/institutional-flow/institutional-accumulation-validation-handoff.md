# Institutional Accumulation / Catalyst Pre-positioning Research — Handoff

Canonical handoff: `data_research/institutional-flow/institutional-accumulation-validation-handoff.md`

## Current phase

**Phase 1 — outcome-blind point-in-time feature/data contract.**

Round identity:

`institutional-accumulation-point-in-time-contract-v1`

Status:

- completed round `institutional-accumulation-preregistration-v1`: Prompt A **COMPLETE**, Prompt B **PASS**;
- current round `institutional-accumulation-point-in-time-contract-v1`: Prompt A **COMPLETE / AWAITING PROMPT B CLOSEOUT**;
- current round Prompt B: **PREREGISTERED / NOT STARTED**;
- future round `institutional-accumulation-development-sample-freeze-v1`: **PREREGISTERED / FUTURE / NOT PROMOTED**.

Do not execute Prompt B automatically. Do not execute the future Phase 2 pair until Phase 1 Prompt B explicitly PASSes and promotes it.

## Objective and frozen boundaries

Detect cases where price has not yet fully repriced upward while durable institutional capital has already changed behavior in a bullish direction, then later test whether credible PIT-safe catalyst evidence adds incremental value.

This remains research, not a production strategy.

Canonical preregistration:

`data_research/institutional-flow/institutional-accumulation-preregistration-v1.md`

Methodology identity:

`institutional-accumulation-preregistration-v1`

Keep these conceptual layers separate until evidence supports combining them:

1. Institutional Accumulation
2. Supply Absorption
3. Price Non-confirmation
4. Catalyst Evidence / Catalyst Proximity
5. Repricing Readiness
6. Crowding / Retail-chasing Risk

No arbitrary final weighted score is frozen.

Outcome blindness remains mandatory until an explicitly later outcome-opening round. Do not use candidate-specific future returns, MFE/MAE, future breakout/failure labels, or future catalyst/news evidence to choose features, windows, thresholds, formulas, samples, or anchors.

Protected MediaTek `2454` motivation cases remain `motivation_cases_only`:

- May 2026 upward repricing wave;
- June 2026 upward repricing wave;
- late-August / 2026-09-01 upward repricing wave.

Withdrawal v6.0-v6.5 classifier/lifecycle rules, specs, validation outcomes/metrics, holdouts, and methodology remain frozen and are not Accumulation inputs.

Observation family remains:

`T-20 / T-15 / T-10 / T-5 / T-3 / T-1 / T0`

Required lifecycle remains:

`outcome-blind selection -> durable sample freeze -> stop -> later round opens outcomes`

## Phase 0 closeout

Phase 0 Prompt A audit commit:

`8a34187f87998fcc20c32024eeab47ac927f0957` — `docs: complete accumulation phase 0 preregistration audit`

Phase 0 handoff checkpoint:

`34868751908edd18aea19dac35885c2c373be902` — `docs: checkpoint accumulation phase 0 handoff`

Phase 0 Prompt B closeout: **PASS**.

The exact preregistered Phase 0 Prompt B was recovered from bootstrap commit:

`9d244fab0fe786393d8be72ab2f6327d306e7328` — `docs: bootstrap institutional accumulation handoff`

Phase 0 froze source semantics, outcome-blindness, the unified-price requirement, TDCC no-lookahead restriction, conservative EOD availability, missing-vs-zero semantics, and the future sample-freeze boundary before Phase 1 began.

## Phase 1 Prompt A completed artifacts

Phase 1 was executed from current remote `main` while `institutional-accumulation` was the unique globally active routed task and while this exact Phase 1 Prompt B already existed in the canonical handoff.

Durable implementation commits:

- `b394073c31ef97742d3228ac67ec0afc9bdfb12d` — `feat: add accumulation PIT observation contract`
- `5fe29975020eec587d80dc3497e42a2b28d85e8c` — `test: cover accumulation PIT observation semantics`
- `e44c583bbca30aa1df259c0464e7cfbd21726326` — `feat: add accumulation PIT coverage audit`
- `9557b07b4203d75d32a1b03a3f75c6cd6bb5e6a4` — `analysis: checkpoint accumulation PIT coverage audit`
- `fc9d539894e1375510f02042358c5f02460b4706` — `docs: define accumulation PIT observation contract`

Durable Phase 1 artifacts:

- `scripts/lib/institutional_accumulation_pit.js`
- `tests/institutional_accumulation_pit.test.js`
- `scripts/audit_institutional_accumulation_pit_coverage.js`
- `data_research/institutional-flow/institutional-accumulation-pit-coverage-v1.json`
- `data_research/institutional-flow/institutional-accumulation-pit-contract-v1.md`

### Executable PIT contract

`scripts/lib/institutional_accumulation_pit.js` provides a domain-specific Accumulation contract rather than a speculative generic institutional-flow framework.

It preserves value separately from state/provenance and supports:

- `available`
- `missing`
- `quality_rejected`
- `availability_unsafe`
- `not_applicable`

A non-`available` observation cannot expose a PIT-safe value. Missing/rejected/unsafe/not-applicable states are never silently zero-filled. Explicit numeric zero remains valid only when supplied by a valid source row.

The record preserves source, source file, session date, known-time slot where available, availability rule, and source-specific details.

Implemented source loaders/helpers:

- stock price/volume via the existing `scripts/lib/stock_price_provider.js` only;
- foreign/investment-trust/dealer official daily archives;
- TWSE margin financing;
- normalized HiStock broker history using `scripts/lib/histock_broker_quality.js`;
- TDCC historical exclusion helper;
- historical-industry exclusion helper;
- trading-session T-offset mapping;
- deterministic fail-closed anchor eligibility.

### T0 / session semantics

`T-20/T-15/T-10/T-5/T-3/T-1/T0` are trading-session offsets, never calendar-day offsets.

EOD TWSE institutional, margin, broker, and price/volume observations are withheld as `availability_unsafe` before source-session completion unless stronger publication-time evidence is independently proven.

Historical TDCC remains excluded/`availability_unsafe` while its provenance says `production_no_lookahead_safe=false`.

Current/static `data_twse/twse_industry.csv` is not projected backward as historical industry membership.

Catalyst/disclosure remains a separate optional layer and may enter only when source identity plus conservative publication/known time proves availability by the anchor.

### Deterministic prospective anchor/data-completeness semantics

`evaluateAnchorEligibility` fails closed for every later-declared required observation. An absent, missing, quality-rejected, availability-unsafe, or not-applicable required input makes that prospective anchor ineligible and records the reason.

Phase 1 does **not** decide the final required feature set, select development stocks/dates, freeze a development sample, open outcomes, or execute Phase 2.

## Phase 1 mechanical coverage audit

Durable artifact:

`data_research/institutional-flow/institutional-accumulation-pit-coverage-v1.json`

The bounded probe was selected without outcome information:

- stocks: first three ascending four-digit TWSE codes from `data_twse/twse_industry.csv`, excluding protected motivation stock `2454`; industry labels ignored;
- sessions: latest three dates `<= 20260831` shared by foreign/investment-trust/dealer/margin manifests;
- resulting stocks: `1101`, `1102`, `1103`;
- resulting sessions: `20260825`, `20260826`, `20260827`;
- 9 stock-session observations per source;
- purpose: source-state coverage measurement only, not development-sample selection.

Observed source-state counts:

| Source | available | missing | quality_rejected |
| --- | ---: | ---: | ---: |
| Unified price | 9 | 0 | 0 |
| Foreign | 6 | 3 | 0 |
| Investment trust | 5 | 4 | 0 |
| Dealer | 0 | 0 | 9 |
| Margin | 9 | 0 | 0 |
| HiStock broker | 0 | 9 | 0 |

Key mechanical findings:

1. Dealer manifests list `20260825`, `20260826`, and `20260827`, but all three corresponding dealer JSON blobs are empty. The contract correctly records them as `quality_rejected`, not zero flow.
2. MI_INDEX blobs for the same three sessions are empty. The canonical unified price provider falls through to valid legacy `data_fubon/fubon_YYYYMMDD_sma.json` values for all 9 probe observations and preserves fallback provenance.
3. No normalized HiStock daily artifact exists for the three probe stocks/sessions, so broker coverage is `missing`, not zero.
4. Margin rows are present for all 9 observations.
5. Foreign and investment-trust row omission is preserved as missing rather than inferred zero.

No network backfill or data repair was launched in Phase 1.

## Validation / changed-file boundary

Phase 1 added only Accumulation research code/tests/docs/audit artifacts and this canonical handoff checkpoint. It did not modify:

- frozen Withdrawal v6.0-v6.5 methodology or outcome artifacts;
- production prediction/strategy behavior;
- routing state;
- protected MediaTek motivation-case outcomes;
- any development-sample/holdout identity.

The authored regression tests cover trading-session offsets, explicit-zero-vs-missing semantics, EOD availability gating, unified price provenance, margin CSV parsing/zero semantics, TDCC exclusion, historical-industry exclusion, and fail-closed anchor eligibility.

No automatic GitHub Actions run was attached to the intermediate test commit; therefore Phase 1 Prompt B must independently execute/recover executable validation rather than infer test PASS from commit existence.

## Exact source entry points retained

### Unified stock price

- `scripts/lib/stock_price_provider.js`
- `data_twse_mi_index/YYYYMMDD_twse_mi_index.json`
- `data_history_sma/<stock>.json`
- `data_fubon/fubon_YYYYMMDD_sma.json`

### Official institutional / margin

- `data_twse_foreign_investors/files.json`
- `data_twse_investment_trust/files.json`
- `data_twse_dealers/files.json`
- `data_twse_margin_balance/files.json`
- corresponding dated daily archives.

### HiStock broker

- `scripts/lib/histock_broker_quality.js`
- `data_research/institutional-flow/histock/<stock>/daily/YYYYMMDD.json`
- `data_research/institutional-flow/histock/<stock>/batch-status/*.json`

### TDCC

- `scripts/backfill_tdcc_shareholding_history.js`
- `data_tdcc_shareholding/history/2449/YYYYMMDD.json`
- `data_tdcc_shareholding/history/2449/manifest.json`

### Universe / disclosure

- `data_twse/twse_industry.csv`
- `scripts/fundamental_event_timeline.js`
- `scripts/build_fundamental_event_timeline.js`
- `data_fundamental_events/<stock>/<year>.json`

## Unresolved evidence after Phase 1

These are not silently repaired or guessed:

1. dealer daily archives can be manifest-listed but empty;
2. recent MI_INDEX files can be empty even when fallback price data exists;
3. broker normalized coverage is sparse for the bounded probe;
4. durable historical intraday publication timestamps for TWSE EOD archives remain unverified;
5. TDCC historical publication timing remains unverified;
6. effective-dated historical industry membership remains unverified;
7. complete timestamped historical catalyst/news/analyst-revision evidence remains unverified;
8. PIT-safe free-float/share-base support remains unaudited;
9. numerical repricing/success thresholds remain deliberately unfrozen.

---

## Prompt A — Phase 1 point-in-time feature/data contract

Round identity:

`institutional-accumulation-point-in-time-contract-v1`

This Prompt A is now **COMPLETE**. Its original preregistered completion contract remains evidenced by repository history before the implementation commits. Do not rerun it while Prompt B is pending.

---

## Prompt B — Phase 1 closeout / verification

The following exact Prompt B remains the mandatory current closeout prompt and was preregistered before Phase 1 Prompt A implementation:

```text
Perform mandatory closeout for round `institutional-accumulation-point-in-time-contract-v1` only after it has been explicitly promoted and its Prompt A has completed.

Fetch current remote main; read `AGENTS.md`, the canonical Accumulation handoff, and preregistration; recover this exact preregistered Prompt B from durable history.

Verify at minimum:
1. all Phase 1 artifacts are outcome-blind and contain no candidate future returns/MFE/MAE/breakout/failure labels;
2. T-20/T-15/T-10/T-5/T-3/T-1/T0 and T0 trading-date semantics are explicit;
3. value is separate from source-state/provenance and missing/rejected/unsafe are never zero-filled;
4. unified stock-price provider is used rather than a new direct legacy price dependency;
5. EOD source availability is conservative;
6. TDCC historical data remains excluded/`availability_unsafe` unless an independently proven publication rule was preregistered before candidate outcomes;
7. historical industry membership is not guessed from current mapping;
8. catalyst/disclosure evidence remains separate and publication-time safe;
9. coverage/source-state audit is mechanical and outcome-independent;
10. no development sample was selected/frozen and Phase 2 was not executed;
11. Withdrawal v6.0-v6.5 and production prediction/strategy state remain untouched;
12. changed files, tests, commits, and remote durable artifacts satisfy the Phase 1 contract.

On PASS, update/commit the handoff and promote exactly one Phase 2 deterministic development sample/event-anchor freeze round using its already-preregistered pair. Do not execute Phase 2.

End with:
`Prompt B closeout: PASS`
and the promoted round identity/canonical handoff path, then stop.
```

---

# FUTURE / NOT PROMOTED — Phase 2 paired prompts

Future round identity:

`institutional-accumulation-development-sample-freeze-v1`

Status: **PREREGISTERED / FUTURE / NOT PROMOTED**.

This pair exists only so Phase 1 Prompt B can verify it was frozen before Phase 2. Do not execute either prompt before explicit promotion by a PASSing Phase 1 Prompt B.

## Prompt A — Phase 2 deterministic development sample/event-anchor freeze

```text
Continue the Institutional Accumulation / Catalyst Pre-positioning research project in repository `EasonLiu0913/stock_data` only if Phase 1 Prompt B has durably PASSed and explicitly promoted round `institutional-accumulation-development-sample-freeze-v1`.

Before work, fetch current remote main; read AGENTS.md, project philosophy/roadmap, the canonical Accumulation handoff, preregistration, Phase 1 PIT contract, and Phase 1 coverage artifact. Recover this exact Phase 2 pair from durable history and verify it predates Phase 2 execution.

Phase 2 is OUTCOME-BLIND DETERMINISTIC DEVELOPMENT SAMPLE / EVENT-ANCHOR FREEZE ONLY.

Do not inspect or generate candidate-specific future returns, MFE/MAE, breakout/repricing success, failure/reclaim labels, or future catalyst/news. Do not execute an outcome study. Do not promote a production strategy or final weighted score.

Using only information available at or before each prospective anchor and the frozen Phase 1 source-state/PIT contract:
- define deterministic stock-universe and date/session eligibility without using protected MediaTek motivation episodes to tune inclusion;
- define which source observations are mandatory vs optional for sample eligibility, with explicit fail-closed data-completeness rules;
- define deterministic event-anchor construction from PIT-safe contemporaneous accumulation/supply-absorption/price-non-confirmation inputs without outcome-derived thresholds;
- if numerical scale cutoffs cannot be justified outcome-independently, freeze threshold-free/rank-based candidate construction or preregister a separate pre-outcome threshold-freeze gate instead of peeking at outcomes;
- preserve catalyst/disclosure as a separate optional PIT-safe layer;
- keep historical TDCC unavailable unless its publication timing has independently become safe under a preregistered rule;
- do not use current industry mapping as historical membership;
- deterministically separate methodology-development sample, untouched stock holdout, and untouched time holdout where feasible;
- keep MediaTek 2454 motivation cases outside validation/sample-tuning evidence;
- write a durable sample/anchor manifest containing only PIT inputs, eligibility reasons, source states/provenance, partition identity, methodology version, and hashes needed for later immutability verification;
- explicitly exclude all future-outcome fields.

Stop after the sample/event-anchor manifest and partition identities are durably frozen. Update the canonical handoff, preserve the preregistered Phase 2 Prompt B, and preregister a FUTURE / NOT PROMOTED later outcome-opening paired round. Commit/push, refetch remote main, verify changed-file scope and durable hashes.

When complete, report:
`Prompt A complete — ready for Prompt B`
and stop.
```

## Prompt B — Phase 2 closeout / verification

```text
Perform mandatory closeout for round `institutional-accumulation-development-sample-freeze-v1` only after it has been explicitly promoted and its Prompt A has completed.

Fetch current remote main; read AGENTS.md, the canonical Accumulation handoff, preregistration, Phase 1 PIT contract/coverage evidence, and recover this exact preregistered Phase 2 Prompt B from durable history.

Verify at minimum:
1. sample/anchor selection is deterministic, reproducible, and entirely outcome-blind;
2. no candidate future return, MFE/MAE, breakout/repricing success, failure/reclaim label, or future catalyst/news was opened or encoded;
3. all required inputs use the frozen Phase 1 PIT observation/source-state semantics and fail closed on missing/rejected/unsafe values;
4. source mandatory/optional rules were frozen before outcomes and are not chosen to fit protected MediaTek episodes;
5. protected MediaTek 2454 motivation cases remain outside development/validation tuning evidence;
6. development, untouched-stock holdout, and untouched-time holdout where feasible are explicitly separated and durably identified;
7. historical TDCC and industry restrictions remain intact unless stronger PIT evidence was independently preregistered before this round;
8. catalyst/disclosure remains a separate PIT-safe optional layer;
9. the durable sample/anchor manifest has stable methodology/version identity, source-state/provenance, partition identity, and an immutable content hash or equivalent verification;
10. no production classifier/final weighted score was promoted and no outcome-opening round was executed;
11. Withdrawal v6.0-v6.5 and production strategy/prediction state remain untouched;
12. changed files/tests/commits and remote artifacts satisfy the preregistered Phase 2 contract.

On PASS, update/commit the canonical handoff and promote exactly one already-preregistered later outcome-opening round. Promotion does not execute that future round.

End with:
`Prompt B closeout: PASS`
and the promoted round identity/canonical handoff path, then stop.
```

## Safety / stop conditions

- No production strategy promotion.
- No future-outcome opening in Phase 0, Phase 1, or future Phase 2 sample-freeze work.
- No MediaTek outcome-driven tuning.
- No large network backfill in Phase 1.
- No modification of frozen Withdrawal methodology/validation state.
- Current Phase 1 Prompt A completion does not authorize Prompt B automatically.
- Only a PASSing Phase 1 Prompt B may promote Phase 2; promotion does not execute Phase 2.
