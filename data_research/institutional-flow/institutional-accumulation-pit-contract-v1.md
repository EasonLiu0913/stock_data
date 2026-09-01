# Institutional Accumulation Point-in-Time Observation Contract v1

Methodology identity: `institutional-accumulation-point-in-time-contract-v1`

Research status: outcome-blind Phase 1 contract. This document is not a production strategy, classifier, score, development-sample freeze, or outcome study.

## Observation family

The frozen observation labels remain:

`T-20 / T-15 / T-10 / T-5 / T-3 / T-1 / T0`

Offsets count exchange trading sessions, never calendar days. `T0` is a source/trading-session identity supplied from a deterministic trading-session sequence; runner-clock date is not sufficient evidence of T0.

The executable date mapping is `buildObservationDates` in:

`scripts/lib/institutional_accumulation_pit.js`

## Observation record

Every source observation keeps the PIT-safe value separate from state/provenance:

```text
{
  value,
  state,
  provenance: {
    source,
    source_file,
    session_date,
    known_at,
    availability_rule,
    details
  }
}
```

Allowed source states are:

- `available`
- `missing`
- `quality_rejected`
- `availability_unsafe`
- `not_applicable`

A non-`available` observation is forbidden from exposing a PIT-safe `value`. Missing, rejected, unsafe, and not-applicable observations are never converted to numeric zero.

Only an explicit numeric zero found in a valid source row may remain an observed zero.

## Source contracts

### Stock price / volume

Executable loader: `loadPriceObservation`.

Prices must come through `scripts/lib/stock_price_provider.js`; Phase 1 does not add a direct price-source dependency. The provider preserves its existing priority:

1. TWSE MI_INDEX
2. `data_history_sma`
3. legacy `data_fubon`

A missing/invalid close remains missing. EOD OHLCV is unavailable before the relevant session completes unless stronger publication-time evidence is independently proven.

### Foreign / investment trust / dealer

Executable loader: `loadTwseInstitutionalObservation`.

Source session date is the trading identity. Valid explicit `買賣超股數` values, including zero, may be used only after session completion under the current conservative contract. Missing file/row is `missing`; malformed/empty archive payload is `quality_rejected`; neither means zero.

### Margin financing

Executable loader: `loadMarginObservation`.

Phase 1 reads the valid stock row's `融資今日餘額`. Explicit numeric zero is valid. Missing file/row remains `missing`; invalid CSV/schema/value is `quality_rejected`. The EOD value is unavailable before session completion.

### HiStock broker history

Executable loader: `loadHistockBrokerObservation`.

The loader reuses `scripts/lib/histock_broker_quality.js` and its shared hard quality gate. Missing normalized daily artifact is `missing`; a daily payload that fails the shared quality gate is `quality_rejected`. A valid aggregate branch net is an EOD observation and is not treated as same-session intraday evidence.

### TDCC historical ownership

Executable contract helper: `tdccHistoricalObservation`.

While historical provenance says `production_no_lookahead_safe=false`, the observation is `availability_unsafe`, its value is excluded, and it cannot satisfy a PIT-safe anchor requirement. Phase 1 does not infer an unpublished historical lag.

### Historical industry membership

Executable contract helper: `historicalIndustryObservation`.

`data_twse/twse_industry.csv` is current/static operational mapping, not verified effective-dated historical membership. Phase 1 therefore does not project it backward. Historical same-industry-relative features remain unsupported unless an independently verified effective-date contract is added before outcome opening.

### Catalyst / disclosure evidence

Catalyst/disclosure is a separate optional layer, not part of the core accumulation observation contract. A record may enter only when source identity and publication/known time conservatively prove availability by the anchor. Retrospective news explanations and future catalyst evidence are forbidden.

## Same-session EOD availability

`applyEodAvailability` fails closed. If an otherwise valid EOD observation is queried while `sessionComplete=false`, the PIT-safe value is removed and state becomes `availability_unsafe`.

This applies to current Phase 1 handling of TWSE institutional, margin, broker, and price/volume observations absent a stronger source-specific timestamp contract.

## Prospective event-anchor eligibility

Executable helper: `evaluateAnchorEligibility`.

Anchor eligibility is deterministic and fail-closed: every feature label declared required by a later preregistered sample-freeze round must exist and have state `available`; absent, `missing`, `quality_rejected`, `availability_unsafe`, or `not_applicable` required inputs make that anchor ineligible and record the reason.

Phase 1 deliberately does **not** choose the development stocks/dates, does not freeze a sample, and does not decide which optional source families must be mandatory in Phase 2. Those choices belong to the separately preregistered deterministic sample/event-anchor freeze round.

## Outcome-blind coverage probe

Durable artifact:

`data_research/institutional-flow/institutional-accumulation-pit-coverage-v1.json`

Executable audit entry point:

`scripts/audit_institutional_accumulation_pit_coverage.js`

The bounded Phase 1 probe is chosen without outcome information:

- universe: first three ascending four-digit TWSE codes from `data_twse/twse_industry.csv`, excluding protected motivation stock `2454`; industry labels are ignored;
- sessions: latest three dates at or before `20260831` shared by foreign, investment-trust, dealer, and margin manifests;
- resulting stocks: `1101`, `1102`, `1103`;
- resulting sessions: `20260825`, `20260826`, `20260827`;
- 9 stock-session observations per source family;
- purpose: source-state/coverage measurement only, never development-sample selection.

Observed source-state counts:

| Source | available | missing | quality_rejected | availability_unsafe | not_applicable |
| --- | ---: | ---: | ---: | ---: | ---: |
| Unified price | 9 | 0 | 0 | 0 | 0 |
| Foreign | 6 | 3 | 0 | 0 | 0 |
| Investment trust | 5 | 4 | 0 | 0 | 0 |
| Dealer | 0 | 0 | 9 | 0 | 0 |
| Margin | 9 | 0 | 0 | 0 | 0 |
| HiStock broker | 0 | 9 | 0 | 0 | 0 |

Important plumbing evidence found by the audit:

- `data_twse_dealers/20260825_twse_dealers.json`, `20260826...`, and `20260827...` are empty even though the dealer manifest lists those sessions; these are rejected payloads, not observed zero dealer flow.
- `data_twse_mi_index/20260825_twse_mi_index.json`, `20260826...`, and `20260827...` are empty; the unified provider correctly falls through to valid legacy `data_fubon/fubon_YYYYMMDD_sma.json` records for the bounded probe, preserving fallback provenance.
- HiStock normalized daily files for the three probe stocks/sessions are absent, so broker coverage is missing rather than zero.

These findings are coverage/data-quality evidence only. Phase 1 does not repair them with a network backfill.

## Explicitly forbidden Phase 1 artifacts

Phase 1 must not create or use candidate-specific:

- future returns;
- MFE / MAE;
- breakout or repricing success labels;
- failure/reclaim labels;
- future catalyst/news evidence;
- development sample or holdout identities;
- final weighted accumulation score;
- production strategy state.

Protected MediaTek `2454` motivation episodes remain excluded from feature/threshold/sample tuning.

## Repository entry points

- `scripts/lib/institutional_accumulation_pit.js` — executable PIT observation/state contract.
- `tests/institutional_accumulation_pit.test.js` — contract regression tests.
- `scripts/audit_institutional_accumulation_pit_coverage.js` — mechanical existing-repository coverage audit.
- `data_research/institutional-flow/institutional-accumulation-pit-coverage-v1.json` — durable bounded coverage evidence.
- `scripts/lib/stock_price_provider.js` — canonical stock price access.
- `scripts/lib/histock_broker_quality.js` — canonical HiStock daily quality gate.
- `data_research/institutional-flow/institutional-accumulation-preregistration-v1.md` — parent preregistration.
- `data_research/institutional-flow/institutional-accumulation-validation-handoff.md` — canonical lifecycle handoff.
