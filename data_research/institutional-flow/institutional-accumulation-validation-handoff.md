# Institutional Accumulation / Catalyst Pre-positioning Research — Handoff

Canonical handoff: `data_research/institutional-flow/institutional-accumulation-validation-handoff.md`

## Current phase

**Phase 0 — outcome-blind research preregistration and source/semantics audit.**

Active/promoted round:

`institutional-accumulation-preregistration-v1`

Status:

- Prompt A: **NOT STARTED / ACTIVE**
- Prompt B: **PREREGISTERED / NOT STARTED**
- next round: **NOT PROMOTED**

This round must stop after durable preregistration/source-audit completion. It must not build an Accumulation classifier, open historical forward outcomes, or start Phase 1.

## Objective

Detect situations where price has not yet fully repriced upward, but capital capable of sustained institutional ownership/absorption has already changed behavior in a bullish direction.

Core research question:

> Can we detect institutional accumulation / supply absorption before price repricing, and later determine whether credible point-in-time catalyst evidence improves that lead signal?

This is research-first work. It is not yet a production strategy.

## Frozen decisions / constraints

Canonical preregistration:

`data_research/institutional-flow/institutional-accumulation-preregistration-v1.md`

Methodology identity:

`institutional-accumulation-preregistration-v1`

Mandatory research layers remain separate until evidence supports combining them:

1. Institutional Accumulation
2. Supply Absorption
3. Price Non-confirmation
4. Catalyst Evidence / Catalyst Proximity
5. Repricing Readiness
6. Crowding / Retail-chasing Risk

Do not freeze arbitrary final weights in Phase 0.

### Outcome blindness

During the active round, do not use candidate-specific future returns, MFE/MAE, future breakout results, future failure/reclaim labels, or future news/catalysts to select features, windows, stocks, thresholds, formulas, or sample identity.

### Protected motivation cases

MediaTek `2454`:

- May 2026 upward repricing wave;
- June 2026 upward repricing wave;
- late-August / 2026-09-01 upward repricing wave.

Status: `motivation_cases_only`.

These episodes motivated the research but are not development/validation evidence and must not be reverse-engineered into the methodology.

### Existing Withdrawal project protection

The Institutional Withdrawal project is methodological precedent only. Do not modify frozen v6.0-v6.5 classifier/lifecycle rules, specs, validation outcomes, metrics, holdout identities, or methodology merely to support Accumulation.

Evidence-before-abstraction remains mandatory.

## Research roadmap

The intended project sequence is:

1. **Phase 0 — preregistration / source audit**
2. **Phase 1 — outcome-blind point-in-time feature/data contract**
3. **Phase 2 — deterministic development sample/event-anchor freeze**
4. **Phase 3 — development outcome opening / discovery**
5. **Phase 4 — frozen untouched stock/time holdout**
6. **Phase 5 — Catalyst Pre-positioning extension and incremental-value test**
7. **Phase 6 — production consideration only if evidence passes**

Each major phase uses the paired Prompt A / Prompt B lifecycle. A sample-freeze round must stop before opening that sample's outcomes.

## Current repository entry points

Repository-level rules:

- `AGENTS.md`
- `promptA.md`
- `promptB.md`
- `docs/agent-prompts/prompt-a-runner.md`
- `docs/agent-prompts/prompt-b-runner.md`
- `docs/project-philosophy.md`
- `docs/roadmap/current-phase.md`

Existing Institutional Withdrawal methodological precedent:

- `data_research/institutional-flow/institutional-withdrawal-validation-handoff.md`
- `data_research/institutional-flow/validation-plan-v1.md`
- `data_research/institutional-flow/institutional-withdrawal-expansion-protocol-v1.md`

Known relevant workflow precedents to inspect in Phase 0 source audit:

- `.github/workflows/backfill-histock-broker-history-research.yml`
- `.github/workflows/backfill-tdcc-shareholding-history-2449.yml`
- `.github/workflows/backfill-twse-core-range-data.yml`
- `.github/workflows/backfill-twse-mi-index-range.yml`
- `.github/workflows/analyze-institutional-distribution-events.yml`
- `.github/workflows/backtest-institutional-distribution-universe.yml`

Frozen Withdrawal lifecycle entry points are already listed exactly in:

`data_research/institutional-flow/institutional-withdrawal-validation-handoff.md`

Phase 0 must audit current `main` and add exact Accumulation-relevant source/script/data paths here rather than knowingly leaving conceptual names once paths are verified.

## Completed

Bootstrap only:

- created `data_research/institutional-flow/institutional-accumulation-preregistration-v1.md`;
- created this canonical handoff;
- preregistered the Phase 0 Prompt A / Prompt B pair before Phase 0 implementation begins.

No classifier, historical feature dataset, sample selection, network backfill, or future-outcome study has been authorized by this bootstrap.

## Next round

Active round only:

`institutional-accumulation-preregistration-v1`

Execute the phase-specific Prompt A below. After Prompt A completion, run the same round's preregistered Prompt B. Do not promote or execute Phase 1 before Prompt B PASS.

---

## Prompt A — Phase 0 outcome-blind preregistration / source audit

```text
Continue the Institutional Accumulation / Catalyst Pre-positioning research project in repository `EasonLiu0913/stock_data`.

This is the active round:

`institutional-accumulation-preregistration-v1`

This round is PHASE 0 — RESEARCH PREREGISTRATION AND SOURCE/SEMANTICS AUDIT ONLY.

Before doing any work:
1. Fetch current remote `main`.
2. Read repository-root `AGENTS.md`.
3. Read `docs/project-philosophy.md` and `docs/roadmap/current-phase.md`.
4. Read the canonical handoff at `data_research/institutional-flow/institutional-accumulation-validation-handoff.md`.
5. Read the preregistration at `data_research/institutional-flow/institutional-accumulation-preregistration-v1.md`.
6. Read the methodological precedent at `data_research/institutional-flow/institutional-withdrawal-validation-handoff.md` and `data_research/institutional-flow/validation-plan-v1.md`.
7. Verify current `main` still matches the active-round identity and that this paired Prompt B was preregistered before Prompt A begins.

Research objective:

Detect cases where price has not yet fully repriced upward while durable institutional capital has already changed behavior in a bullish direction.

Do not reduce the question to `foreign net buy = bullish`, a technical breakout, a volume spike, news sentiment, or analyst recommendations alone.

Preserve these separate research layers:
1. Institutional Accumulation
2. Supply Absorption
3. Price Non-confirmation
4. Catalyst Evidence / Catalyst Proximity
5. Repricing Readiness
6. Crowding / Retail-chasing Risk

Do not choose final weights or build a production score in this round.

### Protected MediaTek motivation cases

The following `2454` episodes are `motivation_cases_only`:
- May 2026 upward repricing wave;
- June 2026 upward repricing wave;
- late-August / 2026-09-01 upward repricing wave.

Do not reverse-engineer thresholds, feature choices, windows, or formulas from their future outcomes. Do not count them as validation evidence.

### Outcome blindness

Do not inspect or generate for candidate optimization:
- D+1/D+3/D+5/D+10/D+20/D+40 future returns;
- future MFE/MAE;
- future breakout/repricing labels;
- future failure/reclaim labels;
- future news/catalysts unavailable at the anchor date.

Existing outcome artifacts from unrelated projects must not influence candidate selection, methodology, windows, thresholds, or formulas.

### Phase 0 source/semantics audit

Audit current `main` and update the canonical handoff/preregistration with exact repository entry points for all currently available evidence families needed by the research.

At minimum audit:
- unified historical stock-price provider;
- TWSE foreign-investor history;
- investment-trust history;
- dealer history;
- TWSE MI_INDEX / price-volume source;
- normalized historical broker research;
- TDCC historical ownership/concentration research;
- margin-financing history;
- stock/industry universe source;
- existing point-in-time fundamental-event/catalyst research that might later support the catalyst extension;
- reusable Withdrawal parsing/normalization code only where semantics are genuinely reusable.

Known workflow precedents that should be inspected where relevant:
- `.github/workflows/backfill-histock-broker-history-research.yml`
- `.github/workflows/backfill-tdcc-shareholding-history-2449.yml`
- `.github/workflows/backfill-twse-core-range-data.yml`
- `.github/workflows/backfill-twse-mi-index-range.yml`
- `.github/workflows/analyze-institutional-distribution-events.yml`
- `.github/workflows/backtest-institutional-distribution-universe.yml`

Do not make the next agent rediscover an exact path that this round has verified. Record exact repo-relative paths and useful stable function/symbol identifiers where they reduce rediscovery.

For every material source record, where determinable:
- exact repository path;
- schema/role;
- date semantics;
- earliest/latest meaningful historical coverage;
- missingness behavior;
- whether zero means true zero or unknown/missing;
- source availability/freshness timing;
- whether historical data is point-in-time safe;
- whether broader coverage requires network collection.

No large network backfill belongs in this round.

### Point-in-time rules

Explicitly document conservative availability semantics for:
- institutional investor data;
- broker data;
- TDCC;
- margin;
- price/volume;
- company disclosures;
- fundamental data;
- catalyst/news evidence.

No future-publication evidence may appear at an earlier anchor date. Missing must not be silently treated as zero unless the source contract proves true-zero semantics.

### Feature observation family

Preserve the preregistered initial observation family unless concrete repository evidence requires a documented prospective revision:
- T-20
- T-15
- T-10
- T-5
- T-3
- T-1
- T0

Define T0 conservatively from source-derived market/trading dates.

### Future outcome contract — define but do not open

Prospectively refine the later evaluation contract for:
- absolute forward performance;
- TAIEX-relative performance;
- same-industry-relative performance where supportable;
- MFE;
- MAE;
- breakout/repricing occurrence;
- D+5/D+10/D+20/D+40 candidate horizons.

Freeze session/benchmark/missing-data semantics before future outcome opening. If numerical success thresholds cannot responsibly be frozen without empirical distribution evidence, define an outcome-independent pre-outcome threshold-freeze gate rather than choosing thresholds after seeing candidate outcomes.

### Validation architecture

Refine a staged design that separates:
- methodology development samples;
- untouched stock holdout;
- untouched time holdout where feasible;
- MediaTek motivation cases;
- final production-gate evidence.

Future sample selection must be deterministic and outcome-independent.

Required boundary:
`outcome-blind selection -> durable sample freeze -> stop -> later round opens outcomes`.

### False-positive taxonomy

Preserve at least:
- transient institutional trading;
- accumulation with no repricing;
- temporary pop then failure;
- catalyst non-materialization;
- already-priced catalyst;
- retail/margin crowding;
- broad market/industry beta masquerading as stock-specific signal.

### Existing Withdrawal protection

Do not modify frozen Institutional Withdrawal v6.0-v6.5 rules/specs, validation outcomes/metrics, or holdout state.

Use Withdrawal only as methodological/infrastructure precedent where semantics truly match. Do not prematurely create a generic shared institutional-flow framework.

### Prompt A completion contract

Prompt A is complete only when current remote `main` durably contains:
1. the canonical handoff;
2. the preregistration;
3. verified exact source/entry-point paths;
4. explicit source-by-source point-in-time and missingness semantics;
5. protected MediaTek motivation-case rules;
6. the feature observation family;
7. prospective outcome definitions without opening outcomes;
8. development/untouched-validation architecture;
9. explicit unresolved questions that evidence has not yet resolved;
10. a concrete ordered Phase 1 proposal;
11. the SAME preregistered Prompt B for this round preserved;
12. preregistered Prompt A + Prompt B for the following round, clearly marked FUTURE / NOT PROMOTED.

Before completion:
- audit changed files;
- commit and push the Phase 0 documentation changes;
- fetch current remote `main`;
- verify canonical files and methodology identity remotely;
- verify no forbidden production-strategy or frozen Withdrawal files changed.

Do not build the Accumulation classifier.
Do not create the historical feature dataset yet.
Do not perform future-return analysis.
Do not execute Phase 1.

When the contract is satisfied, report exactly:

`Prompt A complete — ready for Prompt B`

and stop.
```

---

## Prompt B — Phase 0 closeout / verification

```text
Perform mandatory Prompt B closeout for the Institutional Accumulation / Catalyst Pre-positioning project in repository `EasonLiu0913/stock_data`.

Round to verify:

`institutional-accumulation-preregistration-v1`

This Prompt B was preregistered before Prompt A execution.

Do not begin Phase 1.

Before verification:
1. Fetch current remote `main`.
2. Read repository-root `AGENTS.md`.
3. Read `docs/project-philosophy.md` and `docs/roadmap/current-phase.md`.
4. Read `data_research/institutional-flow/institutional-accumulation-validation-handoff.md`.
5. Read `data_research/institutional-flow/institutional-accumulation-preregistration-v1.md`.
6. Read `data_research/institutional-flow/institutional-withdrawal-validation-handoff.md` as methodological precedent.
7. Recover durable repository history and verify this exact phase-specific Prompt B was preregistered for this round before Prompt A began.

Use remote repository evidence, not the Prompt A summary, as source of truth.

### Gate 1 — durable artifacts

Verify remote `main` contains both canonical Accumulation documents, committed and pushed, with unambiguous project/methodology/round identity. Record commit SHA evidence.

### Gate 2 — correct research direction

Verify the project still targets `durable institutional behavior changes before upward price repricing`, not a simplistic foreign-buy, technical-breakout, volume-spike, news-sentiment, or analyst-call rule.

Verify the six conceptual layers remain separately represented and no arbitrary final weighted score was frozen without evidence.

### Gate 3 — outcome blindness / leakage

Audit changed files and methodology history. Verify Prompt A did not calculate/use candidate future returns, MFE/MAE, future breakout labels, or future catalyst/news evidence to select features, windows, formulas, thresholds, or samples.

Verify MediaTek `2454` May, June, and late-August/2026-09-01 episodes remain `motivation_cases_only` and were not tuned against.

If future outcome information contaminated methodology decisions, FAIL. Do not repair contamination by merely deleting the visible result; redesign the affected methodology/sample boundary.

### Gate 4 — point-in-time semantics

Verify explicit availability/leakage/missingness policy exists for institutional investor, broker, TDCC, margin, price/volume, disclosure/fundamental, and catalyst/news evidence. Future-publication evidence must not be usable at earlier anchors. Missing must not silently equal zero unless proven by source semantics.

### Gate 5 — exact source inventory

Verify exact repo-relative paths were recorded for all source/implementation entry points actually verified by Prompt A, including stable symbols where useful. Conceptual names alone are insufficient when exact paths are known.

For material sources verify the documentation records where determinable: schema/role, date semantics, useful coverage, missingness, point-in-time safety, and network-backfill requirement.

### Gate 6 — Withdrawal protection / evidence-before-abstraction

Compare pre-Prompt-A and current remote state. Verify frozen Withdrawal v6.0-v6.5 code/specs, outcomes/metrics, and holdout state were not changed for Accumulation. Verify no premature generic institutional-flow abstraction was introduced without repeated-use evidence.

### Gate 7 — prospective feature/outcome contract

Verify the T-20/T-15/T-10/T-5/T-3/T-1/T0 observation family is preserved or any change is prospectively justified by repository evidence.

Verify future absolute, TAIEX-relative, same-industry-relative where supportable, MFE, MAE, repricing/breakout outcomes and candidate D+5/D+10/D+20/D+40 horizons are defined prospectively without candidate outcome values being opened.

### Gate 8 — validation architecture

Verify durable separation of development samples, untouched stock holdout, untouched time holdout where feasible, MediaTek motivation cases, and final production-gate evidence.

Verify the future lifecycle requires:
`outcome-blind selection -> durable sample freeze -> stop -> later round opens outcome`.

### Gate 9 — false positives

Verify the documented failure taxonomy includes transient trading, no repricing, temporary pop then failure, catalyst non-materialization, already-priced catalyst, retail/margin crowding, and market/industry beta explanations.

### Gate 10 — changed-file audit

Review every file changed during the round. Expected changes are research documentation and narrowly necessary documentation references. Fail or bounded-repair unexpected production strategy, registry, prediction/replay, frozen Withdrawal, unrelated workflow, source-data, large-backfill, or future-outcome changes.

No large network collection belongs in Phase 0.

### PASS behavior

PASS only if durable artifacts exist, outcome blindness is intact, point-in-time rules are explicit, MediaTek cases are protected, exact entry points are recorded, Withdrawal remains untouched, and the next round remains pre-outcome.

Bounded documentation/contract defects may be repaired, committed/pushed, refetched, and reverified. Outcome contamination is not a trivial bounded repair.

On PASS:
1. update the canonical handoff with Prompt A commits, Prompt B evidence, changed-file audit, PASS state, and unresolved questions;
2. promote exactly one following round — normally Phase 1 outcome-blind point-in-time feature/data contract unless evidence requires a different pre-outcome step;
3. preserve the already-preregistered future Prompt A/B pair or repair it before promotion if Phase 0 evidence required a prospective change;
4. commit/push the handoff;
5. refetch current remote `main` and verify durable promotion state;
6. do not execute the newly promoted Prompt A.

End with:

`Prompt B closeout: PASS`

plus the newly promoted round identity and exact canonical handoff path, then stop.
```

## Safety / stop conditions

- No production strategy promotion in Phase 0.
- No Accumulation classifier implementation in Phase 0.
- No large network backfill in Phase 0.
- No candidate future outcome opening in Phase 0.
- No MediaTek outcome-driven tuning.
- No modification of frozen Withdrawal methodology/validation state.
- Prompt A completion does not authorize Prompt B automatically.
- Prompt B PASS does not authorize execution of the next Prompt A without owner instruction.
