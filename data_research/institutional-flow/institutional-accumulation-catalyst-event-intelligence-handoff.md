# Institutional Accumulation — Prospective Catalyst Event Intelligence

Canonical handoff: `data_research/institutional-flow/institutional-accumulation-catalyst-event-intelligence-handoff.md`

## Current phase

Five-window Event Intelligence / Blind Feature Freeze.

Round:
`institutional-accumulation-catalyst-five-window-event-intelligence-v1`

Status:
- Prompt A: **COMPLETE**
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


## Prompt A implementation and evidence — five-window Event Intelligence / Blind Feature Freeze

Round:
`institutional-accumulation-catalyst-five-window-event-intelligence-v1`

Status:
- Prompt A: **COMPLETE**
- Prompt B: **PREREGISTERED / PENDING**

Routing / baseline:
- preregistered handoff commit: `f08f9544e01c8ec16da02105e9518ab10aa1ea4a`;
- routing activation commit: `d6feb9c7da14fbe79d50804ae8325daeadd006d9`;
- prior sixth-window Data Trust round was demoted to pending, not deleted;
- unrelated `d3b49e12ecdb774cdaf28eec7ae1b80943d7e5fd` TWSE margin-maintenance refresh occurred before implementation and is outside this round's research diff.

Implementation:
- `0681bf36497354c04a9cde2559dcd33244d28195` — deterministic five-window event-intelligence builder:
  `scripts/build_institutional_accumulation_catalyst_five_window_event_intelligence.js`;
- `ead74e71b81b392406d333a1ca5db4e8c1bd8916` — regression suite:
  `tests/institutional_accumulation_catalyst_five_window_event_intelligence.test.js`;
- `b642828c92b13c5aa9453c73de15fff8a749797a` — bounded zero-network writer workflow:
  `.github/workflows/checkpoint-institutional-accumulation-catalyst-event-intelligence.yml`;
- initial artifact checkpoint `1718acca8ffa7b18ad7e911e6517af48f3e5ae8e`;
- blind-methodology refinements before freeze:
  - `2e7d6d7f8d65ae8d0b532413c5ac1bbd5751d8ec` — add 投資人說明會 and financial-asset transaction taxonomy coverage, tighten acquisition/disposal context;
  - `5a09871650e62ecd75532dc7b8c48b4ad14931f1` — regression edge cases proving 投資人說明會 classification and preventing 停工處分 from being treated as asset disposal;
  - `bb437637c28f0c98c28ea641912409702815e9ea` — methodology hash now includes actual taxonomy/feature regex source+flags so rule changes cannot retain the same methodology identity;
- final canonical artifact checkpoint: `5f394fa40f64338097aa020ff1c9c0412cb3b4e1`;
- writer run `35871836013`, checkpoint job `107217610167`, SUCCESS;
- workflow hygiene:
  - `a97b828e8e550bee98f2529765a1896a5f0a79dc` adds repository-managed schedule summary to writer;
  - redundant early read-only workflow removed at `b75459cb84dc9f3c9d1c32a4ade5562574e96d02`;
  - canonical final read-only workflow:
    `.github/workflows/test-institutional-accumulation-catalyst-event-intelligence-final.yml`.

Canonical artifact:
- path:
  `data_research/institutional-flow/institutional-accumulation-catalyst-five-window-event-intelligence-v1.json`;
- git blob: `ee34b995148886ed4f4b27940c6a854fff26f3bb`;
- methodology identity:
  `institutional-accumulation-catalyst-five-window-event-intelligence-methodology-v1`;
- methodology SHA256:
  `27e31156c9ba2f5a5d321784b5512074ed9a74217dbe7119249e2f31ac342a96`;
- source observation audit blob:
  `e713de686951dbb7eba1bb9cd4e8a96ba62cfe68`;
- source shape remains exactly 30 valid / 0 invalid / 0 conflict / 30 immutable snapshots.

Event results:
- total canonical listing events: **180**;
- 1102: 60 total = 58 left-censored + 2 prospectively first-seen;
- 1104: 27 total = 27 left-censored + 0 prospectively first-seen;
- 1216: 93 total = 84 left-censored + 9 prospectively first-seen;
- total prospectively first-seen inside the five-window observation interval: **11**;
- total left-censored because already visible in window 1: **169**;
- captured detail coverage remains only **3 events** total, one exact detail identity per stock, each with one semantic detail version across the five captures;
- listing title revision count observed in this sample: 0;
- detail semantic revision count observed in this sample: 0.

Important interpretation:
- `source_reported_at` is descriptive source metadata only and never moves PIT availability earlier than `first_seen_at`;
- the 169 window-1 events are explicitly left-censored and must not be treated as prospectively observed publication T0 events;
- the 11 non-left-censored events are the cleanest candidates for a later outcome-association phase;
- current detail coverage is too sparse to treat full-detail features as generally available across all 180 events; future outcome research must distinguish listing-level event features from the 3-event captured-detail subset;
- no title/detail revision was observed in this small sample, which is evidence about this sample only, not a claim that MOPS events are globally immutable.

Outcome-blind taxonomy after refinement:
- investor conference includes both 法人說明會 and 投資人說明會 wording;
- asset transaction includes contextual 取得/處分/購置/出售 with 不動產/土地/建築物/資產/有價證券/理財產品;
- acquisition/disposal feature no longer fires on unrelated legal/operational text such as 停工處分;
- rules are frozen by methodology SHA256 above before any outcome access.

Protected-state boundary:
- network collection used: false;
- outcomes read: false;
- stock price / future-return data read: false;
- broker, margin, or post-event institutional labels read: false;
- protected 2454 outcomes read: false;
- development outcomes read: false;
- holdout outcomes read: false;
- catalyst/outcome association opened: false;
- Withdrawal used as input: false;
- model / score / rank / strategy / production behavior opened: false;
- historical PIT upgrade performed: false.

Frozen prior evidence remained asserted byte-identically by the builder:
- two-window delta: `cc5683ce3e33cb9b9c6ae74c42eb5c3a26f0ed00`;
- three-window cross-day: `9dbee14b300980fb46ea7251b5707429071a80bf`;
- fourth-window longitudinal: `31c13856af41fee4f277103807b081873dd780e1`;
- fifth-window longitudinal: `d3ae72fea05ace0815b9c7d22931a19a7fb32fdd`;
- historical PIT provenance: `7ccafbe36206770d93f454feefdca81a082d4cd0`.

Final checked-in-state deterministic gate:
- final workflow commit / tested SHA: `7b8d376682017cc471c5ae6f148012bedda3bfae`;
- run: `35872392427`;
- regression job: `107219551950`;
- Node24 regression: **8 pass / 0 fail**;
- canonical artifact regeneration: byte-identical PASS;
- methodology hash assertion: PASS;
- source observation blob assertion: PASS;
- event count assertion (180): PASS;
- protected-state assertions: PASS;
- final log: `final event intelligence byte-match + protected-state assertions: PASS`.

Known unrelated repository guard:
- a contemporaneous `ensure-workflow-schedule-summary` failure was independently traced to pre-existing `.github/workflows/crawl-tpex-daily-market-data.yml` having a `schedule-timing-summary` block without the managed marker; it is not caused by this event-intelligence implementation.

Prompt A completion boundary reached.

**Prompt A complete — ready for Prompt B.**


## Prompt B closeout — five-window Event Intelligence / Blind Feature Freeze

Round:
`institutional-accumulation-catalyst-five-window-event-intelligence-v1`

Independent closeout verification:
- sole active routing remains `institutional-accumulation-event-intelligence` and points to this handoff — PASS;
- canonical source remains blob `e713de686951dbb7eba1bb9cd4e8a96ba62cfe68` with exactly 30 valid / 0 invalid / 0 conflict / 30 immutable snapshots — PASS;
- builder reads only the canonical observation audit, the observation-referenced prospective PIT snapshots, and the five explicitly frozen evidence/provenance artifacts — PASS;
- builder contains no network client, fetch, HTTP, price provider, broker, margin, institutional-outcome, Withdrawal, holdout, or future-return input — PASS;
- listing event identity is derived only from official `t05st01_detail` parameters as `companyId|marketKind|enterDate|serialNumber` — PASS;
- detail identity is derived only from exact `source_request_key` and must match an observed listing identity — PASS;
- `first_seen_at` / `last_seen_at` remain checked-in collection timestamps; `source_reported_at` is retained separately and cannot backdate PIT availability — PASS;
- deterministic taxonomy and feature regex source+flags are embedded in methodology identity — PASS;
- methodology SHA256 remains `27e31156c9ba2f5a5d321784b5512074ed9a74217dbe7119249e2f31ac342a96` — PASS;
- canonical artifact blob remains `ee34b995148886ed4f4b27940c6a854fff26f3bb` — PASS;
- artifact remains exactly 180 events:
  - 1102 = 60, including 2 prospective-first-seen and 58 left-censored;
  - 1104 = 27, including 0 prospective-first-seen and 27 left-censored;
  - 1216 = 93, including 9 prospective-first-seen and 84 left-censored;
  - total prospective-first-seen = 11;
  - total left-censored = 169;
- captured detail coverage remains exactly 3 event identities, one per stock, and is explicitly not treated as generally available across all events — PASS;
- artifact contains no D1/D3/D5 returns, price change, benchmark-relative return, post-event institutional/broker/margin labels, score, rank, model output, strategy recommendation, or production decision — PASS;
- artifact protected-state flags all remain false — PASS;
- current frozen blobs independently re-fetched from remote main remain byte-identical:
  - delta `cc5683ce3e33cb9b9c6ae74c42eb5c3a26f0ed00`;
  - cross-day `9dbee14b300980fb46ea7251b5707429071a80bf`;
  - fourth longitudinal `31c13856af41fee4f277103807b081873dd780e1`;
  - fifth longitudinal `d3ae72fea05ace0815b9c7d22931a19a7fb32fdd`;
  - historical PIT provenance `7ccafbe36206770d93f454feefdca81a082d4cd0`;
- bounded diff from preregistration baseline contains only routing/handoff, event-intelligence builder/test/workflows/artifact plus unrelated concurrent TWSE margin-maintenance files; no protected Phase 2/outcome/2454/holdout/Withdrawal path was opened — PASS;
- final checked-in-state Node24 run `35872392427`, regression job `107219551950`, tested SHA `7b8d376682017cc471c5ae6f148012bedda3bfae` completed SUCCESS — PASS;
- independent final log confirms **8 pass / 0 fail** and `final event intelligence byte-match + protected-state assertions: PASS` — PASS.

Closeout interpretation:
- the methodology is now frozen before any outcome access;
- only the 11 non-left-censored events have clean prospective publication-interval first-seen evidence suitable for the primary future outcome cohort;
- the 169 left-censored events may be retained only as descriptive/secondary context unless a separate historical PIT-safe design is authorized;
- full-detail features are not generally available because only 3 event identities have captured detail snapshots;
- no observed listing/detail revisions in this sample should be interpreted only as a sample result, not global MOPS immutability.

**Prompt B closeout: PASS**

## Current active round

`institutional-accumulation-catalyst-outcome-association-protocol-v1`

Status:
- Prompt A: **NOT STARTED / ACTIVE**
- Prompt B: **PREREGISTERED / PENDING**

This promotion does not authorize or read outcomes. It is a protocol-preregistration round only.

## Next round objective

Freeze the future outcome-association protocol before any outcome file is opened.

The primary cohort must be the 11 prospectively first-seen event identities from the frozen Event Intelligence artifact. The 169 left-censored events must not enter the primary cohort. The 3-event captured-detail subset must be analyzed separately from listing-level features.

The protocol must define, without reading results:
- event T0 semantics;
- trading-day alignment for after-hours vs intraday announcements;
- D1/D3/D5 price return definitions;
- benchmark-relative return definition and benchmark source;
- pre-event and post-event institutional-flow windows;
- broker-flow alignment;
- margin-financing alignment;
- large-holder/retail ownership alignment if an existing PIT-safe source is available;
- missing-data and non-trading-day policy;
- same-event multiple announcement handling;
- primary vs secondary analyses;
- no-threshold / no-ranking exploratory reporting rules;
- explicit minimum-sample warning because the clean primary cohort is only 11 events.

No outcome values may be read in this round.

## Prompt A — outcome-association protocol preregistration

```text
Continue repository EasonLiu0913/stock_data only if docs/agent-prompts/task-routing.json still routes the sole active task to data_research/institutional-flow/institutional-accumulation-catalyst-event-intelligence-handoff.md and round institutional-accumulation-catalyst-outcome-association-protocol-v1 remains Prompt A NOT STARTED / ACTIVE.

Before work read AGENTS.md, docs/project-philosophy.md, docs/roadmap/current-phase.md, this handoff, the frozen five-window Event Intelligence artifact, the prospective PIT capture contract, and relevant existing documentation for unified prices, institutional investors, broker data, margin data, and any PIT-safe large-holder ownership source. Fetch current main and classify concurrent changes.

This is a zero-outcome protocol-preregistration round. Do not read any actual price rows, future returns, post-event institutional values, broker values, margin values, TDCC/ownership values, protected outcomes, 2454 outcomes, holdouts, or Withdrawal outcomes.

Required work:
1. Derive and freeze the exact 11-event primary cohort identity list from the frozen Event Intelligence artifact. Record identity, stock, first_seen_at, source_reported_at, first-listing taxonomy/features only. Do not attach outcomes.
2. Define T0 trading-session semantics before reading market data:
   - event first_seen during regular session;
   - event first_seen after regular close;
   - weekend/holiday handling;
   - next eligible trading session mapping;
   - never backdate from source_reported_at.
3. Preregister D1/D3/D5 return formulas, benchmark-relative return formula, and exact intended unified-price-provider entry point. Do not calculate any return.
4. Preregister institutional-flow, broker-flow, margin-financing, and optional PIT-safe large-holder/retail windows relative to T0. Name exact existing repository paths/functions/providers after verifying them.
5. Define missing-data policy, non-trading-day policy, duplicate/same-day multi-event policy, event clustering policy, and rules separating listing-level primary analysis from the 3-event detail-feature secondary analysis.
6. Define exploratory outputs only: per-event joined record, descriptive counts/distributions, no optimized threshold, no score/rank, no predictive model, no production strategy, no statistical significance claim from n=11.
7. Create a canonical protocol JSON under data_research/institutional-flow/ containing methodology identity/hash, frozen Event Intelligence blob/hash, exact primary cohort identities, all formulas/alignment policies, intended provider paths, protected-state assertions, and authorization gate:
   outcome_values_read=false,
   outcome_association_execution_authorized=false.
8. Add deterministic Node24 tests and a read-only byte-regeneration workflow proving the protocol artifact is reproducible without opening outcome files.
9. Preserve byte-identically Event Intelligence blob ee34b995148886ed4f4b27940c6a854fff26f3bb and all prior frozen evidence.
10. Record exact commits/runs/jobs/blob/methodology hash in this handoff.

Prompt A completes only when the protocol artifact is durable and the read-only deterministic gate passes while outcome_values_read=false and outcome_association_execution_authorized=false. Stop with: Prompt A complete — ready for Prompt B.
```

## Prompt B — outcome-association protocol closeout

```text
Perform mandatory closeout for institutional-accumulation-catalyst-outcome-association-protocol-v1 only after its Prompt A completes. Fetch current remote main and recover this exact Prompt B from durable pre-Prompt-A history.

Independently verify:
- routing still points to this handoff and round;
- frozen Event Intelligence artifact remains blob ee34b995148886ed4f4b27940c6a854fff26f3bb with methodology SHA256 27e31156c9ba2f5a5d321784b5512074ed9a74217dbe7119249e2f31ac342a96;
- primary cohort is exactly the 11 non-left-censored event identities and excludes all 169 left-censored events;
- no actual outcome/price/institutional/broker/margin/ownership values were read or embedded;
- T0, trading-session, D1/D3/D5, benchmark, institutional, broker, margin and optional ownership alignment rules were fixed before outcome access;
- exact provider/repository entry points were documented;
- listing-level primary analysis is separated from the 3-event detail-feature secondary subset;
- no score/rank/threshold/model/strategy/production behavior was introduced;
- protocol artifact has outcome_values_read=false and outcome_association_execution_authorized=false;
- Node24 read-only deterministic gate passes with byte-identical protocol regeneration;
- all prior frozen blobs and protected state remain unchanged.

Fix bounded defects if required. On PASS, record closeout and prepare the next outcome-association execution pair, but do not activate execution unless the repository owner explicitly authorizes opening outcome values after seeing this protocol closeout. End: Prompt B closeout: PASS.
```


## Outcome-association protocol Prompt A — implementation checkpoint

Round: `institutional-accumulation-catalyst-outcome-association-protocol-v1`

Status:
- Prompt A: **COMPLETE**
- Prompt B: **PREREGISTERED / PENDING**

Implementation boundary:
- frozen parent Event Intelligence blob: `ee34b995148886ed4f4b27940c6a854fff26f3bb`;
- primary cohort: exactly **11** prospectively first-seen events;
- excluded left-censored events: **169**;
- captured-detail context: **3**, separate from primary analysis;
- methodology id: `institutional-accumulation-catalyst-outcome-association-protocol-methodology-v1`;
- methodology SHA256: `5e57653500ae88d263915f1d74e3020e986736098c70e56cac114d16a1e315be`;
- canonical protocol artifact: `data_research/institutional-flow/institutional-accumulation-catalyst-outcome-association-protocol-v1.json`;
- deterministic builder: `scripts/build_institutional_accumulation_catalyst_outcome_association_protocol.js`;
- regression suite: `tests/institutional_accumulation_catalyst_outcome_association_protocol.test.js`;
- read-only Node24 gate: `.github/workflows/test-institutional-accumulation-catalyst-outcome-association-protocol.yml`;
- outcome values read: **false**;
- outcome-association execution authorized: **false**.

Completion evidence:
- implementation commit: `7b6cb1a8acbc52c298b6b75ac62a867f80707617`;
- read-only Node24 workflow run: `35873823675`;
- verify job: `107224467351`;
- regression result: **8 pass / 0 fail**;
- deterministic checked-in artifact regeneration: **byte-match PASS**;
- cohort assertion: **11 primary / 169 left-censored excluded / 3 captured-detail context**;
- authorization/protected-state assertion: **PASS**;
- `outcome_values_read=false`;
- `outcome_association_execution_authorized=false`;
- current-main observed before this closeout checkpoint: `7b6cb1a8acbc52c298b6b75ac62a867f80707617`; unrelated concurrent commits did not alter the frozen Event Intelligence blob or active routing.

**Prompt A complete — ready for Prompt B.**

The preregistered Prompt B above was independently executed and closed below.


## Prompt B closeout — outcome-association protocol

Round: `institutional-accumulation-catalyst-outcome-association-protocol-v1`

Independent closeout verification:
- sole active routing remains `institutional-accumulation-event-intelligence` and points to this canonical handoff — PASS;
- frozen Event Intelligence artifact remains git blob `ee34b995148886ed4f4b27940c6a854fff26f3bb` — PASS;
- frozen Event Intelligence methodology SHA256 remains `27e31156c9ba2f5a5d321784b5512074ed9a74217dbe7119249e2f31ac342a96` — PASS;
- primary cohort remains exactly **11** prospectively first-seen identities and excludes all **169** left-censored events — PASS;
- captured-detail context remains exactly **3** events and is kept separate from listing-level primary analysis — PASS;
- protocol methodology id remains `institutional-accumulation-catalyst-outcome-association-protocol-methodology-v1`;
- protocol methodology SHA256 remains `5e57653500ae88d263915f1d74e3020e986736098c70e56cac114d16a1e315be` — PASS;
- canonical protocol artifact remains `data_research/institutional-flow/institutional-accumulation-catalyst-outcome-association-protocol-v1.json`;
- T0/trading-session, D1/D3/D5, benchmark-relative, institutional, broker, margin, optional ownership, missing-data, non-trading-day, duplicate/same-day event and clustering rules were frozen before outcome access — PASS;
- exact repository/provider entry points are frozen in the canonical protocol — PASS;
- no score, rank, optimized threshold, predictive model, strategy promotion, statistical-significance claim, or production behavior was introduced — PASS;
- `outcome_values_read=false` — PASS;
- `outcome_association_execution_authorized=false` — PASS;
- all protected-state flags remain false — PASS;
- Node24 read-only deterministic workflow run `35873823675`, verify job `107224467351`, tested implementation SHA `7b6cb1a8acbc52c298b6b75ac62a867f80707617` completed SUCCESS — PASS;
- zero-outcome regression result remains **8 pass / 0 fail** — PASS;
- deterministic protocol regeneration remains byte-identical — PASS;
- concurrent commits observed after Prompt A completion were unrelated data/docs changes and did not alter the frozen Event Intelligence blob, protocol artifact, protocol workflow, or active routing — PASS.

Closeout boundary:
- this closeout did **not** read any actual outcome, price, institutional, broker, margin, ownership, protected 2454, holdout, or Withdrawal outcome values;
- this closeout does **not** authorize outcome-association execution;
- opening outcome values requires a separate explicit repository-owner authorization after this closeout.

**Prompt B closeout: PASS**

## Next preregistered round — outcome-association execution

Round: `institutional-accumulation-catalyst-outcome-association-execution-v1`

Status:
- Prompt A: **COMPLETE**
- Prompt B: **PREREGISTERED / PENDING**
- outcome values read after durable owner authorization: **true**
- execution authorized: **true**
- protected 2454 / holdout / Withdrawal outcomes authorized: **false**
- score / rank / threshold optimization / model / production promotion authorized: **false**

The repository owner authorization checkpoint below preceded the first outcome-source read. The round remained bounded to the preregistered descriptive association protocol.

### Owner authorization checkpoint

Repository owner explicitly authorized opening outcome values and execution of this preregistered Prompt A in chat on **2026-09-23 (Asia/Taipei)** with the exact instruction:

`我授權開啟 outcome values，執行下一輪 Prompt A`

Authorization scope is limited to `institutional-accumulation-catalyst-outcome-association-execution-v1` exactly as preregistered below.

Durable gate state after this checkpoint:
- owner authorization recorded before first outcome read: **true**;
- round promoted for execution: **true**;
- Prompt A: **ACTIVE / AUTHORIZED**;
- Prompt B: **PREREGISTERED / PENDING**;
- outcome values read at authorization checkpoint: **false**;
- protected 2454 / holdout / Withdrawal outcomes remain unauthorized;
- score / rank / threshold optimization / model / production promotion remain forbidden.


### Prompt A — outcome-association execution

```text
Execute institutional-accumulation-catalyst-outcome-association-execution-v1 only after the repository owner explicitly authorizes opening outcome values after reviewing the completed protocol closeout.

Before any outcome access, fetch current remote main; read AGENTS.md, docs/project-philosophy.md, docs/roadmap/current-phase.md, docs/agent-prompts/task-routing.json, this handoff, the frozen Event Intelligence artifact, and the canonical outcome-association protocol artifact.

Fail closed unless all of the following remain unchanged:
- active project routing still points to this handoff;
- frozen Event Intelligence blob is ee34b995148886ed4f4b27940c6a854fff26f3bb;
- Event Intelligence methodology SHA256 is 27e31156c9ba2f5a5d321784b5512074ed9a74217dbe7119249e2f31ac342a96;
- protocol methodology SHA256 is 5e57653500ae88d263915f1d74e3020e986736098c70e56cac114d16a1e315be;
- primary cohort is exactly the preregistered 11 events;
- all 169 left-censored events remain excluded from primary analysis;
- owner authorization is durably recorded before first outcome read.

After authorization, implement only the preregistered descriptive association analysis:
1. use the exact frozen T0 and trading-session alignment rules;
2. calculate only preregistered D1/D3/D5 stock and benchmark-relative returns;
3. join only preregistered institutional, broker, margin and optional PIT-safe ownership windows;
4. preserve listing-level primary analysis and 3-event detail context as separate outputs;
5. fail closed on missing or ambiguous alignment rather than silently backfilling;
6. produce per-event joined records and descriptive summaries only;
7. do not optimize thresholds, create scores/ranks, train predictive models, claim statistical significance from n=11, or promote any production strategy;
8. add deterministic tests and a bounded read-only verification workflow for the checked-in result artifact;
9. record exact commits, runs, jobs, methodology/result artifact hashes and any missing-data exclusions in this handoff.

Prompt A completes only when the owner-authorized, preregistered analysis is durable and deterministic, with no scope expansion beyond the frozen protocol. Stop with: Prompt A complete — ready for Prompt B.
```

### Prompt B — outcome-association execution closeout

```text
Perform mandatory closeout for institutional-accumulation-catalyst-outcome-association-execution-v1 only after explicit owner authorization was durably recorded and its Prompt A completed.

Independently verify:
- authorization existed before the first outcome read;
- frozen Event Intelligence and protocol identities/hashes remained unchanged;
- cohort is exactly the preregistered 11-event primary set, with 169 left-censored events excluded;
- all T0, D1/D3/D5, benchmark and flow alignments exactly match the frozen protocol;
- missing-data handling and same-day/cluster handling follow the preregistered rules;
- detail-context analysis remains separate from listing-level primary analysis;
- outputs are descriptive only and contain no optimized threshold, score, rank, predictive model, strategy promotion or statistical-significance claim;
- no protected 2454, holdout or Withdrawal outcomes were used outside the explicitly authorized protocol scope;
- deterministic tests and checked-in-state verification pass;
- all result and methodology hashes, runs/jobs and bounded changed files are durably recorded.

Fix only bounded defects. On PASS record durable closeout evidence and preregister the next research pair without automatically executing it. End: Prompt B closeout: PASS.
```


## Prompt A implementation and evidence — outcome-association execution

Round: `institutional-accumulation-catalyst-outcome-association-execution-v1`

Authorization ordering:
- durable owner-authorization commit: `dbfbb5d2c84d955e92c6db363ba98532588636fd`;
- authorization was recorded before the first price / institutional / broker / margin / ownership outcome-source read;
- protected 2454, holdout and Withdrawal outcomes remained unopened;
- no score/rank/threshold optimization/model/production authorization was granted.

Implementation:
- initial deterministic fail-closed builder: `302dad2c1125fa032240b161e880181eef63cd2a`;
- bounded source-inventory refinement: `ff583b7ad8438d294366213f15107290bc984af2`;
- protocol Git-blob identity refinement: `1901a1b3e6517da354233a708b5fca454e2c5bc7`;
- regression suite: `7c46889e0a6a6f4e7089f58afd0cbed3e34fa6b2`;
- builder:
  `scripts/build_institutional_accumulation_catalyst_outcome_association_execution.js`;
- regression suite:
  `tests/institutional_accumulation_catalyst_outcome_association_execution.test.js`;
- canonical result:
  `data_research/institutional-flow/institutional-accumulation-catalyst-outcome-association-execution-v1.json`;
- result checkpoint commit: `2b6f16d03b39249c280c7f6165e6d38539e44da4`;
- canonical result git blob: `3bc69bb34f55af603c1268b567b706e3ea505baf`.

Workflow evidence:
- bounded materializer:
  `.github/workflows/materialize-institutional-accumulation-catalyst-outcome-association-execution.yml`;
- bounded read-only verifier:
  `.github/workflows/verify-institutional-accumulation-catalyst-outcome-association-execution.yml`;
- sparse verifier/concurrency checkpoint: `5643198cc0168bcdf51567825fe5c281433e812c`;
- Node24 verify run: `35879302391`;
- verify job: `107243295906`;
- regression result: **8 pass / 0 fail**;
- deterministic result regeneration: **byte-match PASS**;
- bounded authorization + frozen cohort + fail-closed coverage assertions: **PASS**.

Frozen identities remained unchanged:
- Event Intelligence blob: `ee34b995148886ed4f4b27940c6a854fff26f3bb`;
- Event Intelligence methodology SHA256:
  `27e31156c9ba2f5a5d321784b5512074ed9a74217dbe7119249e2f31ac342a96`;
- protocol blob: `379179cf069503df5a4afba4d749869516547283`;
- protocol methodology SHA256:
  `5e57653500ae88d263915f1d74e3020e986736098c70e56cac114d16a1e315be`;
- primary cohort: exactly **11**;
- excluded left-censored events: exactly **169**;
- captured-detail context remains **3** and was not promoted into the primary cohort.

Observed source coverage after authorization:
- preregistered trading calendar
  `data_history_sma/trading_days.json`
  ends at **2026-08-04**;
- benchmark
  `data_twse_market_chart/market_chart.json`
  ends at **2026-09-22**;
- `data_twse_mi_index/20260923_twse_mi_index.json` exists;
- `data_twse_institutional_investors/20260923_twse_institutional_investors.json` exists;
- `data_twse_margin_balance/20260923_twse_margin_balance.csv` exists;
- `data_tdcc_shareholding/latest.json` exists;
- preregistered HiStock roots for 1102 and 1216 are absent.

Fail-closed research result:
- primary events: **11**;
- protocol-valid event session resolved: **0**;
- unresolved because preregistered trading calendar has no eligible date at/after the events: **11**;
- numeric D1/D3/D5 returns materialized: **0**;
- institutional windows materialized: **0**;
- broker windows materialized: **0**;
- margin windows materialized: **0**;
- TDCC ownership windows materialized: **0**;
- no alternate trading-calendar fallback was introduced after outcome access;
- no missing source was imputed to zero;
- no source-reported timestamp was used to backdate availability.

Interpretation:
The owner-authorized round successfully opened the preregistered evidence class and exposed a prerequisite freshness defect: the canonical trading calendar is stale before every primary event. Under the preregistered rules, replacing that calendar after seeing outcome-source data or inferring sessions from another source would be a post-hoc methodology change. The canonical execution snapshot therefore correctly remains fail-closed rather than manufacturing D1/D3/D5 or flow associations.

**Prompt A complete — ready for Prompt B.**


## Prompt B closeout — outcome-association execution

Round: `institutional-accumulation-catalyst-outcome-association-execution-v1`

Independent closeout:
- owner authorization commit `dbfbb5d2c84d955e92c6db363ba98532588636fd` predates first outcome-source read — PASS;
- Event Intelligence blob `ee34b995148886ed4f4b27940c6a854fff26f3bb` unchanged — PASS;
- Event Intelligence methodology SHA256 unchanged — PASS;
- protocol blob `379179cf069503df5a4afba4d749869516547283` unchanged — PASS;
- protocol methodology SHA256 `5e57653500ae88d263915f1d74e3020e986736098c70e56cac114d16a1e315be` unchanged — PASS;
- primary cohort remains exactly **11** and **169** left-censored events remain excluded — PASS;
- captured-detail context remains separate and does not enter primary analysis — PASS;
- protected 2454 / holdout / Withdrawal outcomes remained unopened — PASS;
- no optimized threshold, score, rank, predictive model, production promotion or statistical-significance claim was introduced — PASS;
- no imputation and no post-hoc trading-calendar fallback was introduced — PASS;
- canonical execution artifact remains fail-closed with **0/11** protocol-valid event sessions because `data_history_sma/trading_days.json` still ends at **2026-08-04** — PASS;
- concurrent benchmark refresh advanced `data_twse_market_chart/market_chart.json` from 2026-09-22 to **2026-09-23**; bounded freshness-only artifact refresh commit `f872016a7f812f0c89015af513fd67b50dea8426` updated that evidence without changing methodology or research conclusion — PASS;
- refreshed canonical result blob: `b7eaf860d26125ea0084167b745fccb098568180`;
- Node24 verification run `35886179132`, job `107266783212` — SUCCESS;
- execution regressions, deterministic byte regeneration and bounded result contract all completed successfully — PASS.

Closeout conclusion:
The execution round is methodologically clean but cannot materialize association outcomes until the preregistered canonical trading calendar is fresh enough to resolve the cohort. The next round must repair that prerequisite without changing the frozen T0/D1/D3/D5 alignment semantics.

**Prompt B closeout: PASS**

## Next preregistered round — trading-calendar freshness remediation and outcome replay

Round: `institutional-accumulation-catalyst-trading-calendar-freshness-remediation-v1`

Status:
- Prompt A: **COMPLETE**
- Prompt B: **PREREGISTERED / PENDING**
- frozen Event Intelligence identity: unchanged;
- frozen outcome-association protocol identity: unchanged;
- methodology changes: none;
- canonical calendar freshness repaired through production data plumbing;
- outcome replay completed under the exact frozen protocol.

### Prompt A — trading-calendar freshness remediation and outcome replay

```text
Execute institutional-accumulation-catalyst-trading-calendar-freshness-remediation-v1.

Fetch current remote main and read AGENTS.md, docs/project-philosophy.md, docs/roadmap/current-phase.md, docs/agent-prompts/task-routing.json, this handoff, the frozen Event Intelligence artifact, the outcome-association protocol artifact, and the current execution artifact.

Keep these identities frozen:
- Event Intelligence blob ee34b995148886ed4f4b27940c6a854fff26f3bb;
- Event Intelligence methodology SHA256 27e31156c9ba2f5a5d321784b5512074ed9a74217dbe7119249e2f31ac342a96;
- protocol blob 379179cf069503df5a4afba4d749869516547283;
- protocol methodology SHA256 5e57653500ae88d263915f1d74e3020e986736098c70e56cac114d16a1e315be;
- primary cohort exactly 11; 169 left-censored events excluded;
- T0/D1/D3/D5 definitions, first_seen availability clock, no-imputation rule and source hierarchy unchanged.

Goal:
1. determine why data_history_sma/trading_days.json stops at 2026-08-04;
2. repair only the canonical trading-calendar freshness plumbing needed to extend eligible sessions through the current required cohort horizon;
3. do not infer trading days from observed price rows inside the research builder and do not add a research-only fallback calendar;
4. add/refresh deterministic calendar freshness regression coverage;
5. once the canonical calendar is durably refreshed, rerun scripts/build_institutional_accumulation_catalyst_outcome_association_execution.js against current main;
6. materialize only protocol-valid D1/D3/D5 and preregistered flow windows whose required dates/data are actually available; immature horizons remain explicit missing;
7. keep protected 2454, holdout and Withdrawal outcomes unopened;
8. do not create thresholds, scores, ranks, predictive models, production strategy changes or significance claims;
9. run bounded Node24 verification and record exact commits, runs/jobs, artifact blob and coverage changes in this handoff.

Prompt A is complete only when the canonical calendar freshness defect is durably repaired or a concrete fail-closed root cause is proven, and the outcome execution artifact has been deterministically replayed against that repaired canonical state. Stop with: Prompt A complete — ready for Prompt B.
```

### Prompt B — trading-calendar freshness remediation closeout

```text
Perform mandatory closeout for institutional-accumulation-catalyst-trading-calendar-freshness-remediation-v1.

Independently verify:
- no Event Intelligence or frozen protocol identity/methodology changed;
- canonical data_history_sma/trading_days.json freshness was repaired through a legitimate repository data path, not a research-only fallback;
- calendar regression tests prove correct eligible-session behavior and do not silently mark holidays/weekends as trading days;
- outcome replay uses the exact frozen T0/D1/D3/D5 semantics and first_seen availability clock;
- the primary cohort remains exactly 11 with 169 left-censored events excluded;
- immature D3/D5 or source windows remain explicit missing rather than imputed;
- protected 2454, holdout and Withdrawal outcomes remain unopened;
- no score/rank/threshold optimization/model/production/significance claim was added;
- deterministic builder regeneration and bounded Node24 verification pass on current main;
- all concurrent relevant data changes are classified and any stale source-coverage evidence is refreshed before PASS;
- exact result blob, tested SHA, runs/jobs and changed files are recorded.

Fix only bounded defects. On PASS record Prompt B closeout: PASS and preregister the next research pair without automatically executing it.
```


## Prompt A implementation and evidence — trading-calendar freshness remediation

Round: `institutional-accumulation-catalyst-trading-calendar-freshness-remediation-v1`

Root cause:
- canonical `data_history_sma/trading_days.json` was only advanced by the historical SMA crawler;
- daily production `.github/workflows/crawl-sma.yml` durably generated validated `data_fubon/fubon_YYYYMMDD_sma.json` checkpoints but did not synchronize those successful trading dates back into the canonical calendar;
- after historical SMA backfill stopped, the canonical calendar therefore froze at **2026-08-04** even though durable daily SMA checkpoints continued through **2026-09-23**.

Canonical plumbing repair:
- calendar sync script commit:
  `f3615396c330613e1d909cddafab926cad1806e4`;
- script:
  `scripts/sync_trading_calendar_from_daily_sma.js`;
- validation policy:
  durable daily SMA checkpoint, matching embedded date, at least 100 valid Price/SMA5 rows, reject weekends, reject canonical non-trading days, no inferred research-only fallback;
- regression commit:
  `99efbc57cf786e1b0b53d3977966ec4b6781dfc4`;
- regression:
  `tests/sync_trading_calendar_from_daily_sma.test.js`;
- production daily SMA integration:
  `9c603d14fd455699dd327d255bdca2325346bc0d`;
- `.github/workflows/crawl-sma.yml` now synchronizes the validated target-date SMA checkpoint into the canonical calendar and commits `data_history_sma/trading_days.json` together with the daily SMA state.

Bounded repair workflow:
- workflow commit:
  `5b4148770094fe8b53602b73b1e87ee49f5fe1e9`;
- workflow:
  `.github/workflows/repair-trading-calendar-freshness.yml`;
- initial run `35935476653`, job `107431424956`, exposed a bounded weekend-date helper defect;
- defect: timezone conversion caused a Saturday calendar date to be evaluated as the previous UTC weekday;
- bounded fix commit:
  `3da5078bc855de2210ad6483403373bf92e1d8df`;
- no research methodology or event alignment rule changed.

Successful canonical calendar repair:
- Node24 repair run:
  `35935517285`;
- repair job:
  `107431553387`;
- calendar regressions: **4 pass / 0 fail**;
- repair step: **PASS**;
- durable calendar commit:
  `193eb4dadd2cc799a30fe53ddeb13e1b50f7eb19`;
- canonical calendar blob:
  `c81a320df61c1bd61797ddbc81a084e8c0e4330c`;
- canonical latest eligible trading date after repair:
  **2026-09-23**.

Frozen identities after repair:
- Event Intelligence blob:
  `ee34b995148886ed4f4b27940c6a854fff26f3bb`;
- Event Intelligence methodology SHA256:
  `27e31156c9ba2f5a5d321784b5512074ed9a74217dbe7119249e2f31ac342a96`;
- outcome protocol blob:
  `379179cf069503df5a4afba4d749869516547283`;
- outcome protocol methodology SHA256:
  `5e57653500ae88d263915f1d74e3020e986736098c70e56cac114d16a1e315be`;
- primary cohort remains exactly **11**;
- left-censored excluded remains exactly **169**;
- no alternate calendar, imputation or source-reported-time backdating introduced.

Outcome replay:
- replay builder commit:
  `22be1d16712a0922556e46efba04f709b6f68628`;
- builder continues to use the frozen first_seen availability clock and frozen T0/D1/D3/D5 semantics;
- stock prices use canonical `scripts/lib/stock_price_provider.js`;
- benchmark uses `data_twse_market_chart/market_chart.json`;
- institutional joins use preregistered TWSE institutional files;
- margin joins use preregistered TWSE margin files;
- absent HiStock roots remain explicit broker missing;
- PIT-safe archived TDCC post-snapshot join remains explicit ownership missing;
- immature horizons remain missing rather than forward-filled.

Replay regression/workflow checkpoints:
- replay regression commit:
  `fa2bb35152e07d50be85ef2e8193b9601f707678`;
- materializer workflow checkpoint:
  `d15d848f85e72a99a85a9e20500eb09ef855b6a6`;
- verifier workflow checkpoint:
  `3b1b3ffbe04483878e710c0e8ef204484bb83c9e`;
- successful materializer run:
  `35935736606`;
- materializer job:
  `107432267717`;
- canonical replay artifact commit:
  `5f944930eab50c3bf91e1a7265350e11aaacde0f`;
- fresh verifier checkpoint:
  `b5c5dc3e7048f62e043d457792772254955098fc`;
- final read-only verifier run:
  `35935816831`;
- final verifier job:
  `107432487280`;
- execution regressions: **PASS**;
- deterministic byte regeneration: **PASS**;
- bounded result contract: **PASS**.

Final canonical execution artifact:
- path:
  `data_research/institutional-flow/institutional-accumulation-catalyst-outcome-association-execution-v1.json`;
- blob:
  `9fcd3fc20b04941dce50035d7e16d0106ee53dc1`;
- primary events: **11**;
- protocol-valid event sessions resolved: **9**;
- unresolved: **2**;
- all 9 resolved events align to **2026-09-23** under the frozen after-close rule;
- D1 stock + benchmark-relative horizons materialized: **9**;
- D3/D5 remain explicit missing because later eligible sessions are not yet durably available in the canonical calendar;
- institutional windows materialized: **18** (pre T-5..T-1 plus event T0 for the 9 resolved events);
- broker windows materialized: **0**, because preregistered HiStock roots for 1102/1216 are absent;
- margin event windows materialized: **9**;
- ownership windows materialized: **0**, because the preregistered PIT-safe archived snapshot join is not available;
- artifact state: `partial_materialization`.

Protected boundaries:
- protected 2454 / holdout / Withdrawal outcomes remain unopened;
- no threshold optimization;
- no score or rank;
- no predictive model;
- no production strategy promotion;
- no statistical-significance claim.

**Prompt A complete — ready for Prompt B.**


## Prompt B closeout — trading-calendar freshness remediation

Round: `institutional-accumulation-catalyst-trading-calendar-freshness-remediation-v1`

Independent verification:
- frozen Event Intelligence blob `ee34b995148886ed4f4b27940c6a854fff26f3bb` unchanged — PASS;
- frozen Event Intelligence methodology SHA256 `27e31156c9ba2f5a5d321784b5512074ed9a74217dbe7119249e2f31ac342a96` unchanged — PASS;
- frozen outcome protocol blob `379179cf069503df5a4afba4d749869516547283` unchanged — PASS;
- frozen protocol methodology SHA256 `5e57653500ae88d263915f1d74e3020e986736098c70e56cac114d16a1e315be` unchanged — PASS;
- primary cohort remains exactly **11**, with **169** left-censored events excluded — PASS;
- canonical `data_history_sma/trading_days.json` was repaired from validated durable daily SMA checkpoints through the legitimate repository production path, not a research-only fallback — PASS;
- canonical calendar blob remains `c81a320df61c1bd61797ddbc81a084e8c0e4330c`, latest eligible session **2026-09-23** — PASS;
- calendar regression suite verifies validated weekday promotion, declared non-trading-day rejection, weekend rejection, and insufficient-row fail-closed behavior — PASS;
- Node24 repair run `35935517285`, job `107431553387` completed successfully — PASS;
- production `.github/workflows/crawl-sma.yml` now synchronizes validated daily SMA checkpoints into the canonical calendar — PASS;
- outcome replay uses the frozen first_seen availability clock and frozen T0/D1/D3/D5 semantics — PASS;
- all **9** resolved events align to **2026-09-23** under the frozen after-close rule — PASS;
- the **2** events first seen after the 2026-09-23 close remain unresolved because the next eligible canonical session is not yet durably available — PASS;
- D1 stock and benchmark-relative returns are materialized for the 9 resolved events; D3/D5 remain explicit `immature_trading_horizon` missing — PASS;
- institutional windows materialized **18**, margin windows **9**, broker **0** because preregistered HiStock roots are absent, ownership **0** because PIT-safe archived TDCC join is unavailable — PASS;
- no immature horizon, broker, or ownership value was imputed — PASS;
- protected 2454 / holdout / Withdrawal outcomes remain unopened — PASS;
- no optimized threshold, score, rank, predictive model, production strategy promotion, or statistical-significance claim was introduced — PASS;
- materializer run `35935736606`, job `107432267717` completed successfully — PASS;
- final read-only verifier run `35935816831`, job `107432487280` completed successfully — PASS;
- regression, deterministic byte regeneration, and bounded result contract all passed — PASS;
- canonical replay artifact blob remains `9fcd3fc20b04941dce50035d7e16d0106ee53dc1` — PASS.

Concurrent-change classification after Prompt A:
- `e958f1f6072b9a2d6f3f9b45073608914a788ae5` temporarily added a duplicate bounded calendar-repair workflow;
- `ec7f092bae01fa54625a5c0d1d4932b578f678f3` immediately removed that duplicate;
- neither commit changed the canonical sync script, calendar artifact, frozen methodology, cohort, or replay result;
- later commits through current main are unrelated market/context/research data updates and do not stale this round's acceptance evidence.

**Prompt B closeout: PASS**

## Next preregistered round — outcome maturity refresh

Round: `institutional-accumulation-catalyst-outcome-maturity-refresh-v1`

Status:
- Prompt A: **PREREGISTERED / DATA-MATURITY-GATED**
- Prompt B: **PREREGISTERED / DATA-MATURITY-GATED**
- owner authorization for the frozen descriptive outcome-association scope remains valid;
- no new evidence class is authorized;
- methodology changes remain forbidden.

Purpose:
Refresh only the already-authorized, frozen outcome-association artifact as canonical trading sessions and preregistered source windows mature. The round must not manufacture maturity or change alignment semantics to force completion.

### Prompt A — outcome maturity refresh

```text
Execute institutional-accumulation-catalyst-outcome-maturity-refresh-v1 against current remote main.

Read AGENTS.md, docs/project-philosophy.md, docs/roadmap/current-phase.md, docs/agent-prompts/task-routing.json, this canonical handoff, the frozen Event Intelligence artifact, the frozen outcome-association protocol, scripts/sync_trading_calendar_from_daily_sma.js, data_history_sma/trading_days.json, and the current outcome execution artifact.

Frozen identities and rules:
- Event Intelligence blob ee34b995148886ed4f4b27940c6a854fff26f3bb;
- Event Intelligence methodology SHA256 27e31156c9ba2f5a5d321784b5512074ed9a74217dbe7119249e2f31ac342a96;
- protocol blob 379179cf069503df5a4afba4d749869516547283;
- protocol methodology SHA256 5e57653500ae88d263915f1d74e3020e986736098c70e56cac114d16a1e315be;
- cohort exactly 11 with 169 left-censored excluded;
- first_seen availability clock and frozen T0/D1/D3/D5 trading-session semantics unchanged;
- no imputation, no alternate calendar, no source-reported-time backdating.

Execution:
1. determine the latest canonical eligible trading date from data_history_sma/trading_days.json;
2. if validated daily SMA checkpoints exist beyond the calendar, synchronize them only through scripts/sync_trading_calendar_from_daily_sma.js / the production SMA path;
3. rerun scripts/build_institutional_accumulation_catalyst_outcome_association_execution.js only after canonical calendar state is current;
4. resolve the two previously unresolved 2026-09-23-after-close events only if the next eligible canonical session is durably present;
5. materialize D1/D3/D5 only where the frozen target trading horizon and both stock/benchmark observations are durably available;
6. refresh preregistered institutional and margin windows only for protocol-valid dates; absent broker/ownership sources remain explicit missing;
7. never treat weekends, declared non-trading days, missing source rows, or immature horizons as available;
8. keep protected 2454 / holdout / Withdrawal outcomes unopened;
9. do not create thresholds, scores, ranks, predictive models, production strategy changes, or significance claims;
10. run deterministic Node24 regression + byte-match verification and record exact coverage delta, artifact blob, tested SHA, workflow run/job IDs, and any still-immature windows in this handoff.

If no new canonical eligible session or outcome horizon has matured, stop fail-closed without fabricating progress and record the maturity gate. Prompt A completes only when a deterministic refreshed snapshot is durably checkpointed or the no-new-maturity gate is durably proven.

Stop with: Prompt A complete — ready for Prompt B.
```

### Prompt B — outcome maturity refresh closeout

```text
Perform mandatory closeout for institutional-accumulation-catalyst-outcome-maturity-refresh-v1.

Independently verify:
- frozen Event Intelligence/protocol identities and cohort did not change;
- canonical calendar advancement, if any, came only from validated durable daily SMA checkpoints through the canonical sync path;
- no weekend or declared non-trading day was promoted;
- the two formerly unresolved events are resolved only if a legitimate next eligible canonical session exists;
- D1/D3/D5 targets follow the frozen trading-session definitions exactly;
- stock and benchmark return values use only durable observations for the same protocol-valid horizon;
- institutional/margin joins follow the preregistered date windows;
- broker and PIT-safe ownership remain missing unless their exact preregistered sources genuinely exist;
- immature horizons remain explicit missing and are never forward-filled or imputed;
- protected 2454 / holdout / Withdrawal outcomes remain unopened;
- no optimized threshold, score, rank, model, production promotion, or significance claim appears;
- deterministic tests, byte regeneration and bounded Node24 verification pass on current main;
- relevant concurrent changes after materialization are classified before PASS;
- exact coverage counts, artifact blob, tested SHA, run/job IDs and changed files are durably recorded.

Fix only bounded defects. On PASS record Prompt B closeout: PASS and preregister the next paired round without automatically executing it.
```
