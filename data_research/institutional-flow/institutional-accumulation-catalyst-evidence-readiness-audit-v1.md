# Institutional Accumulation — Catalyst Evidence Readiness Audit v1

Round: `institutional-accumulation-catalyst-evidence-readiness-audit-v1`

Status: **Prompt A COMPLETE / Prompt B pending**

Decision: `not_ready`

This is a bounded point-in-time/source-semantics audit only. It does not create catalyst features, labels, thresholds, scores, weights, production logic, or strategy state. Stock-holdout, time-holdout, and protected MediaTek `2454` outcomes were not opened or materialized. The immutable Phase 2 freeze, refreshed development outcome, refreshed association artifact, and frozen Withdrawal v6.0-v6.5 methodology/validation state were not modified.

## Preregistration provenance

The active Prompt A + Prompt B pair is durable in canonical handoff commit `60b4a3142f83d63527142e387c39e5d20b8d3e9b`, the association-refresh closeout commit. That commit records association-refresh Prompt B PASS and promotes this readiness-audit round with Prompt A `NOT STARTED / ACTIVE` and Prompt B `PREREGISTERED / NOT STARTED` before this audit began.

## Candidate source inventory and classifications

### 1. Official material information / disclosure timeline

Classification: `conditional_with_cutoff`

Exact paths:

- `.github/workflows/build-fundamental-event-timeline.yml`
- `scripts/fundamental_event_timeline.js`
- `scripts/build_fundamental_event_timeline.js`
- `tests/fundamental_event_timeline.test.js`
- `data_fundamental_events/<stock>/<year>.json`
- `data_fundamental_events/build-summary.json`

Role: normalize official TWSE/TPEx material-information disclosures and related fundamental events into a shadow event timeline.

Timestamp semantics:

- material-information rows read official publication/speaking date and time when present;
- `published_at` is represented in `Asia/Taipei` (`+08:00`);
- timestamp precision is `second` when official date+time are present, otherwise `date`;
- availability confidence distinguishes `official_timestamp`, `official_date`, and lower-confidence states;
- fiscal/measurement period is not treated as the availability timestamp.

Same-day cutoff semantics:

- the executable resolver is conservative: an official minute/second timestamp before 09:00 on a known trading date can become effective that trading date;
- an intraday or after-open timestamp becomes effective only on the strictly next trading date;
- date-only/fallback availability also becomes effective only on the strictly next trading date.

Collection / historical reconstruction:

- the builder records `generated_at` for produced timeline files, but collection time is distinct from source publication time;
- source rows are fetched from current TWSE/TPEx OpenAPI endpoints, so a later rebuild is not itself proof that every source row and exact text/version was preserved exactly as visible at an earlier T0;
- durable `data_fundamental_events/<stock>/<year>.json` files exist only for repository-covered stocks/years and are shadow evidence, not a complete immutable historical snapshot family for every frozen development identity.

Edit/update/backfill risk:

- official timestamps are materially stronger than generic news timestamps, but the current builder does not establish immutable revision/version history for source rows;
- therefore an event is conditionally usable only when the exact durable event row plus its original official timestamp/known-date provenance can be shown to have existed by the frozen T0; a current rebuild alone is insufficient.

Leakage decision: low-to-moderate under the explicit effective-trading-date cutoff, but historical version/reconstruction coverage remains incomplete.

### 2. Official monthly revenue OpenAPI snapshots

Classification: `conditional_with_cutoff`

Exact paths:

- `scripts/build_fundamental_event_timeline.js`
- `.github/workflows/crawl-mops-monthly-revenue.yml`
- `.github/workflows/backfill-mops-monthly-revenue.yml`
- `data_fundamental_events/<stock>/<year>.json`
- existing monthly-revenue source artifacts referenced by the MOPS workflows.

Role: monthly revenue/fundamental catalyst evidence.

Timestamp semantics:

- the event builder explicitly treats OpenAPI `出表日期` as `aggregate_snapshot_date`, not company publication time;
- `published_at` is null for this path and the snapshot date is a conservative `fallback_known_date`;
- timezone-specific intraday availability is therefore unproven for aggregate snapshots.

Same-day cutoff semantics:

- fallback/date-only evidence is assigned to the strictly next trading date, preventing same-session lookahead.

Collection / backfill / edits:

- backfilled or freshly queried aggregate values may reflect later-corrected source state;
- without a durable original snapshot/version chain, they cannot be moved earlier merely because their accounting period predates T0.

Leakage decision: usable only under conservative next-trading-session availability and only where durable source provenance supports historical reconstruction; never use accounting month as availability time.

### 3. Formal financial-report fallback events

Classification: `conditional_with_cutoff`

Exact paths:

- `scripts/build_fundamental_event_timeline.js`
- `data_finmind_quarterly_financial_quality/<stock>/YYYYQn.json`
- `.github/workflows/backfill-finmind-quarterly-financial-quality-batch.yml`
- `.github/workflows/crawl-twse-quarterly-financial-quality.yml`

Role: financial values with conservative known-date fallback when original report publication timestamp is not available in the normalized artifact.

Timestamp semantics:

- `conservative_known_date` is used as `fallback_known_date`;
- `timestamp_precision` is `fallback` and `availability_confidence` is `fallback_deadline`;
- the effective event date is strictly after the fallback known date under the timeline resolver.

Edit/backfill risk:

- values collected later can be revisions or normalized later; the fallback date is an availability bound, not proof of the exact value/version visible intraday on that date.

Leakage decision: conditionally usable for coarse, conservative event availability only; unsuitable for precise same-day catalyst timing without stronger source-version provenance.

### 4. Generic market-news crawler

Classification: `unsafe_or_unproven`

Exact paths:

- `.github/workflows/crawl-market-news.yml`
- `scripts/crawl_market_news.js`
- `config/market_news_sources.json`
- `data_market_news/<collection-date>/...`
- `data_market_news/files.json`

Role: scheduled Google News RSS / Yahoo market-news collection used for market-news and market-risk context.

Timestamp semantics:

- RSS items can carry `pubDate`;
- Yahoo article HTML may expose `article:published_time`, `pubdate`, `<time datetime>`, or `datePublished`;
- when only Yahoo relative time such as `N 小時前`, `昨天`, or `剛剛` is available, `scripts/crawl_market_news.js` computes `published_at` relative to the actual crawl timestamp;
- payload `generated_at`/collection date identifies collection, not immutable publication provenance.

Historical/backfill behavior:

- `--search-date-window-days` / historical window changes the current search query date range; it does not retrieve a versioned snapshot of what the search/index/article looked like at the historical T0;
- article pages and search results can be edited, removed, re-indexed, or expose later-normalized metadata;
- no immutable original-version/edit-history contract was found.

Same-day leakage risk:

- a collection can occur at 04:40, 15:50, or 20:17 Taipei time, but collection schedule alone does not prove each article was visible at an earlier stock T0;
- relative-time reconstruction depends on crawl time;
- post-close articles and retrospective explanations can easily describe a move after it occurred.

Leakage decision: do not use this archive as a predictive catalyst feature for frozen T0s until original publication/version provenance and historical visibility are independently proven.

### 5. Daily-gainers news/theme analysis

Classification: `unsafe_or_unproven`

Exact paths:

- `.github/workflows/publish-daily-gainers-news-summary.yml`
- `data_daily_gain_over_5/analysis-news/YYYYMMDD.json`
- `data_daily_gain_over_5/market-summary/YYYYMMDD.json`
- `scripts/canonicalize_daily_gainers_news_analysis.js`
- `scripts/validate_daily_gainers_news_analysis.js`
- `scripts/build_daily_gainers_market_summary.js`

Role: retrospective news/theme explanation for stocks already selected by same-day >=5% gain workflow artifacts.

Leakage risk:

- the workflow is triggered by `analysis-news` artifacts for the already observed daily-gainer cohort and builds a preliminary/final market summary after that selection;
- therefore cohort membership and synthesized explanation are downstream of the price move and cannot be used as pre-positioning evidence at the earlier T0;
- migration/canonicalization/rebuild behavior can also rewrite normalized summaries from current repository state.

Leakage decision: explicitly forbidden as a predictive catalyst input for this project. It may remain retrospective descriptive research only.

### 6. Analyst revisions / target-price / recommendation-history evidence

Classification: `unsafe_or_unproven`

Exact path: **none verified in current repository search**.

Repository search for analyst-revision / target-price / recommendation / EPS-revision style source entry points returned no dedicated historical source suitable for this contract.

Required missing semantics:

- original analyst publication/effective timestamp;
- timezone;
- revision sequence/version history;
- whether consensus fields are point-in-time or future-aware;
- historical snapshot availability by frozen T0;
- backfill behavior.

Leakage decision: unavailable for catalyst research until a dedicated historical PIT-safe source is separately audited.

## Cross-source leakage checks

- **Revised articles:** generic news has no immutable original-version chain -> unsafe/unproven.
- **Retrospectively normalized metadata:** market-news historical querying and summary canonicalization can reflect later-visible state -> unsafe for frozen T0 reconstruction.
- **Post-close/same-day releases:** official event resolver already defers at/after market open to next trading session; generic news has no equivalent frozen project-level availability gate -> unsafe unless separately normalized.
- **Missing original timestamps:** date-only/fallback official evidence must be deferred to next trading session; generic news with unresolved timestamp must remain unavailable.
- **Future-aware analyst fields:** no verified historical analyst dataset exists, so none may be admitted.
- **Outcome contamination:** daily-gainers news/theme summaries are downstream of observed price-gainer selection and are not candidate pre-positioning evidence.

## Historical reconstruction verdict for the frozen development anchors

The repository has a promising conservative official-disclosure/fundamental event infrastructure, but the current audit does not establish complete immutable historical source coverage/version provenance across all 41 frozen methodology-development identities and T0 anchors. General news is not reconstructable as originally visible at each T0 from the current crawler contract, and no dedicated PIT-safe analyst-revision archive was verified.

Therefore the project is **`not_ready`** for a general catalyst/news/analyst development-association preregistration.

A later, narrower preregistration may become defensible if it is restricted to official disclosures/fundamental events and first proves mechanically that every candidate event used for the intended development anchors has durable original timestamp/known-date provenance and a reconstructable version that was available by T0. General news and analyst revisions must remain excluded unless their own historical PIT contracts are established.

## Unresolved gaps required before readiness can change

1. Mechanical coverage audit of `data_fundamental_events` against all frozen methodology-development stock/T0 identities, without opening outcomes.
2. Durable proof of original-version provenance for official disclosure rows when source records can be revised.
3. Explicit policy for missing/ambiguous official timestamps beyond the existing conservative next-session fallback.
4. A versioned historical news source, or proof that existing article records preserve original publication time and original content/version as known at T0.
5. A dedicated historical analyst-revision dataset with original effective timestamps and non-future-aware fields, if analyst evidence is desired.
6. Separate preregistration before any catalyst feature is computed or associated with outcomes.

Prompt B must independently verify this audit, changed-file scope, frozen artifact hashes, sealed holdouts, and the `not_ready` decision before closeout.
