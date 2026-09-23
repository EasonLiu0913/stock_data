# Institutional Accumulation — Prospective Catalyst Event Intelligence

Canonical handoff: `data_research/institutional-flow/institutional-accumulation-catalyst-event-intelligence-handoff.md`

## Current phase

Five-window Event Intelligence / Blind Feature Freeze.

Round:
`institutional-accumulation-catalyst-five-window-event-intelligence-v1`

Status:
- Prompt A: **NOT STARTED / ACTIVE**
- Prompt B: **PREREGISTERED / PENDING**

## Objective

Use only the already-captured five prospective PIT windows for 1102/1104/1216 to derive deterministic, outcome-blind event intelligence:
- canonical event identity;
- first-seen / last-seen timestamps;
- source-reported event timestamp when available;
- listing presence across windows;
- listing title version/revision history;
- captured detail version history;
- deterministic event taxonomy and blind textual/numeric features.

This round must not read stock-price outcomes, future returns, post-event institutional outcomes, protected 2454 outcomes, holdouts, or catalyst/outcome associations.

## Why now

The five-window collection has durable PIT-safe evidence:
- canonical observation audit blob `e713de686951dbb7eba1bb9cd4e8a96ba62cfe68`;
- exactly 30 valid / 0 invalid / 0 conflict observations;
- 3 stocks × 5 listing + 5 detail snapshots;
- latest accepted observation `2026-09-23T12:09:31.642Z`.

The next useful step is no longer only source-timeline validation. The existing five windows can support event-lifecycle methodology development without opening outcomes.

## Frozen decisions / constraints

- Input is only checked-in prospective PIT snapshots under:
  `data_research/institutional-flow/official-disclosure-raw/prospective-catalyst-pit/`.
- Exactly the first five canonical windows are in scope for this round.
- Canonical event identity for listing rows:
  `companyId|marketKind|enterDate|serialNumber`.
- Listing event identity comes only from the row's official `t05st01_detail` parameters.
- Never infer an earlier PIT availability time from source-reported event date/time.
- `first_seen_at` means first checked-in prospective collection timestamp in which that event identity is observed.
- `last_seen_at` means last checked-in prospective collection timestamp in which that event identity is observed.
- A listing title change for the same canonical identity is a title revision signal only; it is not business significance.
- Detail changes are immutable raw-version changes only; they are not catalyst significance.
- Taxonomy/features are deterministic rules from title/detail text available in the five-window PIT snapshots.
- No learned model, score, ranking, threshold optimization, strategy, production behavior, scheduler, or broad-universe rollout.
- No stock prices, D1/D3/D5 returns, institutional post-event changes, broker outcomes, margin outcomes, or future labels.
- Historical 33-identity PIT state remains frozen 33 / 0 PIT-ready / 33 not-PIT-ready.
- Protected Phase 2 state, development outcomes, protected 2454 outcomes, stock/time holdouts, Withdrawal v6.x, and catalyst/outcome association remain unopened.
- Frozen evidence blobs must remain byte-identical:
  - two-window delta `cc5683ce3e33cb9b9c6ae74c42eb5c3a26f0ed00`;
  - three-window cross-day `9dbee14b300980fb46ea7251b5707429071a80bf`;
  - fourth-window longitudinal `31c13856af41fee4f277103807b081873dd780e1`;
  - fifth-window longitudinal `d3ae72fea05ace0815b9c7d22931a19a7fb32fdd`;
  - historical PIT provenance `7ccafbe36206770d93f454feefdca81a082d4cd0`.

## Expected methodology

For each listing snapshot:
1. decode `raw_response_base64`;
2. require successful official MOPS response;
3. parse `result.data`;
4. require official detail-link parameters;
5. construct canonical event identity;
6. record snapshot `collected_at`, title, company abbreviation, source-reported date/time;
7. aggregate across the five windows.

For each captured detail snapshot:
1. decode immutable raw response;
2. validate response success;
3. derive event identity from `source_request_key`;
4. record subject, clause, fact date, explanation text and immutable response SHA;
5. attach to matching listing identity without moving PIT availability earlier.

Deterministic blind taxonomy may use explicit keyword families such as:
- investor_conference;
- financial_report;
- dividend_distribution;
- capital_financing;
- asset_transaction;
- management_governance;
- operations_safety;
- legal_regulatory;
- investment_mna;
- revenue_business_outlook;
- other.

Blind features may include only contemporaneously available text structure:
- has_numeric_content;
- has_percentage;
- has_currency;
- has_yoy_or_qoq_language;
- mentions_revenue;
- mentions_profit_or_eps;
- mentions_capacity_or_production;
- mentions_order_or_customer;
- mentions_price_or_asp;
- mentions_guidance_or_outlook;
- mentions_suspension_or_shutdown;
- mentions_acquisition_or_disposal;
- title/detail text length;
- listing_window_count;
- listing_title_version_count;
- detail_version_count.

No feature may encode later market response.

## Entry points

- `AGENTS.md`
- `docs/project-philosophy.md`
- `docs/roadmap/current-phase.md`
- `docs/agent-prompts/task-routing.json`
- `data_research/institutional-flow/institutional-accumulation-catalyst-prospective-pit-capture-contract-v1.json`
- `data_research/institutional-flow/institutional-accumulation-catalyst-prospective-observation-audit-v1.json`
- `data_research/institutional-flow/official-disclosure-raw/prospective-catalyst-pit/`

## Prompt A — five-window event intelligence implementation

```text
Continue repository EasonLiu0913/stock_data only if docs/agent-prompts/task-routing.json routes the sole active task to data_research/institutional-flow/institutional-accumulation-catalyst-event-intelligence-handoff.md and round institutional-accumulation-catalyst-five-window-event-intelligence-v1 remains Prompt A NOT STARTED / ACTIVE.

Before work read AGENTS.md, docs/project-philosophy.md, docs/roadmap/current-phase.md, this handoff, the prospective PIT capture contract, canonical 30-observation audit, and the prior data-trust handoff. Fetch current main and classify concurrent changes.

Implement a bounded zero-network deterministic Event Intelligence / Blind Feature Freeze using only the first five checked-in prospective windows for 1102/1104/1216.

Required outputs:
1. Add a deterministic Node.js builder under scripts/ that:
   - validates the canonical input shape is 30 valid / 0 invalid / 0 conflict;
   - decodes and parses listing/detail raw bytes from checked-in snapshots;
   - constructs event identity companyId|marketKind|enterDate|serialNumber from official listing detail parameters;
   - derives first_seen_at, last_seen_at, listing_window_count, listing title-version history, source-reported timestamp where parseable;
   - joins captured detail versions only by exact event identity;
   - derives deterministic outcome-blind taxonomy/features exactly within this handoff's allowed feature class;
   - fails closed on malformed response, identity ambiguity, non-success source response, invalid ROC date/time, or detail/listing mismatch.
2. Add regression tests covering identity determinism, first-seen semantics, title revision detection, detail join, taxonomy, no-outcome schema, and malformed/ambiguous fail-closed behavior.
3. Generate a canonical artifact under data_research/institutional-flow/ that records methodology identity/hash, source observation audit blob identity, event count, per-stock counts, feature schema, events, and protected-state assertions.
4. Add a Node24 zero-network workflow that regenerates the artifact and proves byte-identical output. Workflow must be read-only, contents:read, and must not call external sources.
5. Preserve byte-identically all frozen prior evidence blobs and historical PIT provenance.
6. Do not inspect or read price/outcome files, protected outcomes, holdouts, Withdrawal artifacts, broker/margin/institutional post-event labels, or any future-return data.
7. Record exact commit/run/job/blob/count evidence in this handoff.

Prompt A completes only when the canonical artifact is durable on remote main and a checked-in-state Node24 read-only deterministic gate passes with byte-identical regeneration. Stop with: Prompt A complete — ready for Prompt B.
```

## Prompt B — five-window event intelligence closeout

```text
Perform mandatory closeout for institutional-accumulation-catalyst-five-window-event-intelligence-v1 only after its Prompt A completes. Fetch current remote main and recover this exact Prompt B from durable pre-Prompt-A history.

Independently verify:
- sole active routing still points to this handoff;
- input remains exactly the canonical five-window 30-valid/0-invalid/0-conflict prospective PIT set;
- builder uses only checked-in prospective PIT snapshots and zero network;
- canonical event identity is derived only from official listing detail parameters;
- first_seen_at/last_seen_at are collection-time semantics and never backdated from source-reported event time;
- detail joins require exact event identity;
- taxonomy/features are deterministic and outcome-blind;
- artifact schema contains no price, return, D1/D3/D5 outcome, post-event institutional/broker/margin labels, score, rank, model output, or strategy recommendation;
- protected historical 33 state and all frozen delta/cross-day/fourth/fifth blobs remain byte-identical;
- no protected Phase 2/outcome/2454/holdout/Withdrawal paths were opened in the bounded diff;
- Node24 read-only workflow passes on the durable checked-in artifact with byte-identical regeneration;
- artifact methodology identity/hash, source observation blob identity, event counts, per-stock counts, and feature schema are recorded and reproducible.

Fix only bounded defects and rerun deterministic verification if needed. On PASS record durable closeout evidence and preregister the next pair. The next research phase may propose outcome association, but it must remain a separately authorized phase and must not be opened in this Prompt B unless explicitly authorized by the repository owner. End: Prompt B closeout: PASS.
```
