# Institutional Accumulation / Catalyst Pre-positioning — Preregistration v1

Methodology identity: `institutional-accumulation-preregistration-v1`

## Objective

Detect situations where price has not yet fully repriced upward, but capital capable of sustained institutional ownership/absorption has already changed behavior in a bullish direction.

This is research, not a production strategy.

## Core hypothesis

`institutional accumulation / supply absorption + price non-confirmation + optional later catalyst evidence -> elevated probability of subsequent upward repricing`

The project must test whether money moves before price, without assuming that all institutional buying is durable or predictive.

## Mandatory conceptual layers

Keep these separate until evidence supports combining them:

1. Institutional Accumulation
2. Supply Absorption
3. Price Non-confirmation
4. Catalyst Evidence / Catalyst Proximity
5. Repricing Readiness
6. Crowding / Retail-chasing Risk

No final arbitrary weighted score is frozen in this preregistration.

## Institutional actor semantics

Audit and distinguish at minimum:

- foreign investors;
- investment trust;
- dealers;
- broker branch activity;
- TDCC large-holder ownership/concentration;
- margin financing and other available retail-leverage proxies.

Candidate concepts include single-day flow, multi-day accumulation, persistence, concentration, participation relative to volume/free float where supportable, and synchronized accumulation across independent sources.

Do not assume equal persistence across actor classes.

## Price non-confirmation research family

Candidate formulations may later include:

- institutional-flow percentile vs contemporaneous return percentile;
- accumulation z-score minus price-return z-score;
- cumulative institutional absorption with muted price movement;
- strong institutional participation while price remains inside a base/range;
- market-relative or industry-relative price response.

No winning formula is selected yet.

## Supply absorption research family

Candidate concepts include:

- turnover/volume vs institutional net purchases;
- price impact per unit of institutional buying;
- repeated high-volume sessions with limited downside;
- narrowing downside response while accumulation persists.

The repository source audit must determine which are mechanically supportable before implementation.

## Catalyst boundary

Catalyst Pre-positioning is a later extension. A catalyst may be used at date/time T only if the evidence was publicly available by T under a conservative point-in-time policy.

Potential evidence families include company disclosures, revenue/earnings information, analyst-revision evidence preserved in repository research, customer/supply-chain evidence, structured theme/catalyst research, corporate actions, and capital-raising/investment announcements.

Future news explaining a later rally is forbidden as a T feature.

## Protected motivation cases

MediaTek `2454` episodes that motivated the project:

- May 2026 upward repricing wave;
- June 2026 upward repricing wave;
- late-August / 2026-09-01 upward repricing wave.

Status: `motivation_cases_only`.

They may not be used to reverse-engineer thresholds, choose features because they fit those rallies, or count as validation evidence during preregistration/development. They may only be revisited as illustrative retrospective sanity checks after a methodology version has been frozen independently.

## Outcome-blindness rule

Before an explicit later outcome-opening round, do not inspect, generate for optimization, rank by, or summarize candidate-specific:

- D+1/D+3/D+5/D+10/D+20/D+40 future returns;
- future MFE/MAE;
- future breakout/repricing success;
- future failure/reclaim labels;
- future catalyst/news evidence unavailable at the anchor date.

Existing outcome artifacts from unrelated projects must not influence stock selection, thresholds, factor definitions, windows, or sample identity.

## Initial feature observation family

Unless evidence later requires a preregistered revision, use:

- T-20
- T-15
- T-10
- T-5
- T-3
- T-1
- T0

T0 must be defined conservatively from source-derived market/trading dates rather than runner-clock convenience.

## Prospective future outcome families

Future validation may evaluate, after proper sample freeze:

Absolute:

- forward return;
- maximum favorable excursion;
- maximum adverse excursion;
- breakout/repricing occurrence.

Relative:

- return minus TAIEX;
- return minus same-industry baseline where mechanically supportable.

Candidate horizons:

- D+5
- D+10
- D+20
- D+40

Exact session semantics, benchmark semantics, missing-data policy, and success/failure thresholds must be frozen before candidate outcomes are opened. If numerical thresholds require outcome-independent distribution evidence, that must occur at a dedicated pre-outcome gate.

## False-positive taxonomy

At minimum preserve these failure classes:

- transient institutional trading rather than durable accumulation;
- accumulation with no repricing;
- short-lived pop followed by failure;
- catalyst fails to materialize;
- catalyst materializes but was already priced in;
- retail/margin crowding overwhelms the signal;
- market/industry beta explains the move rather than stock-specific accumulation.

## Development / holdout architecture

The project must separate:

- methodology development samples;
- untouched stock holdout;
- untouched time holdout where feasible;
- MediaTek motivation cases;
- final production-gate evidence.

Future sample selection must be deterministic and outcome-independent.

Required lifecycle:

`outcome-blind selection -> durable sample freeze -> stop -> later round opens outcomes`

Never use `see outcome -> alter rule -> call same sample validation`.

## Point-in-time source contract requirements

For every evidence source, later implementation must record:

- exact repository path;
- schema/role;
- date semantics;
- useful historical coverage;
- missingness behavior;
- whether zero is true zero or unknown/missing;
- source freshness/availability timing;
- whether historical backfill is point-in-time safe;
- whether broader coverage requires network collection.

No large network backfill belongs in the preregistration round.
