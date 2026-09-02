# Institutional Accumulation Official-disclosure Source Collection Preregistration v1

Methodology identity: `institutional-accumulation-official-disclosure-source-collection-preregistration-v1`

Research status: Prompt A preregistration / feasibility only. This document does **not** authorize or perform historical network backfill, catalyst-feature construction, outcome association, holdout opening, or production strategy changes.

Canonical parent handoff: `data_research/institutional-flow/institutional-accumulation-validation-handoff.md`

## Decision

`collection_preregistered`

A bounded later collection round is feasible for the official MOPS monthly-revenue historical archive. Historical MOPS material-information collection is also a legitimate first-party candidate, but its machine-query/pagination contract must pass an explicit fail-closed preflight before any material-information batch is allowed.

This round itself performs no historical source collection.

## Frozen outcome-blind scope

The unresolved identities are derived mechanically from:

`data_research/institutional-flow/institutional-accumulation-official-disclosure-artifact-reconstruction-v1.json`

The reconstruction artifact reports exactly `33` unresolved `source_missing` identities. No development outcome value, stock-holdout outcome, time-holdout outcome, or protected `2454` outcome is used here.

Exact unresolved identities, ordered by T0 then stock:

```text
20260814: 1102, 1104, 1201, 1215, 1216
20260817: 1102, 1104, 1201, 1203, 1215, 1216, 1217
20260818: 1102, 1104, 1216
20260819: 1102, 1104, 1216
20260820: 1102, 1109, 1215, 1216
20260821: 1102, 1109, 1216
20260824: 1102, 1103, 1104, 1109, 1215, 1216
20260825: 1102, 1216
```

Count check: `5 + 7 + 3 + 3 + 4 + 3 + 6 + 2 = 33`.

Unique stocks:

```text
1102, 1103, 1104, 1109, 1201, 1203, 1215, 1216, 1217
```

All identities are TWSE-listed development identities already frozen by the parent research contract.

## Candidate source audit

### 1. MOPS historical monthly-revenue archive — accepted for later bounded collection

Official / first-party: **yes**.

Verified repository implementation:

`scripts/crawl_mops_monthly_revenue.js`

The existing production crawler deterministically maps a Gregorian revenue month `YYYYMM` to the official MOPS historical archive URL:

```text
https://mopsov.twse.com.tw/nas/t21/sii/t21sc03_<ROC_YEAR>_<MONTH>_0.html
```

For example, revenue month `202607` maps to ROC year `115`, month `7`.

Verified semantics from the existing parser/production history:

- query partition: one listed-market revenue month per URL/request;
- historical date/range support: deterministic single-month historical archive; a range is a finite list of month URLs;
- pagination: none in the repository contract; one archive document contains the listed-company rows for that month;
- timestamp precision: the page exposes an official `出表日期`, parsed by `parseReportDate`; this is an aggregate snapshot/report date, not a company-specific publication timestamp;
- row identity: company code plus revenue month;
- response-empty semantics: HTTP success alone is insufficient; the existing parser rejects a document with no company rows (`MOPS revenue page contained no company rows.`);
- response-quality evidence already used by the repository: company count, baseline-month coverage, parsed rows, and archive metadata;
- historical value reproducibility: the archive is first-party and month-addressable;
- version/update caveat: the archive does not provide an immutable row-version identifier in the current repository contract. A row fetched later must not claim that its current numeric value is byte-identical to the value visible at T0 unless an independent version history proves that fact.

PIT use rule for the later collection round:

- the official archive/report date can prove that a monthly-revenue aggregate existed by a historical date;
- it must **not** be upgraded to company-specific second/minute publication precision;
- current retrieval time or future git commit time is never historical availability proof;
- numeric metrics whose original-version immutability is unproven must retain an explicit version-safety flag and may not silently become stronger evidence than the timestamp/provenance actually supports.

For the currently unresolved identities, the deterministic first month to probe is `202607` because all T0 anchors are in August 2026 and the immediately preceding completed revenue month is July 2026. The later collector must derive this from the frozen identity/T0 set rather than hard-code an outcome-selected month.

### 2. MOPS historical material information — accepted candidate, machine contract gated by preflight

Official / first-party: **yes**.

Verified public interface:

```text
https://mops.twse.com.tw/mops/web/t05st01
```

The public MOPS site exposes `歷史重大訊息` and supports company/year query parameters. Indexed first-party pages demonstrate historical queries such as company `2330` with ROC year `113` / `111`.

Verified detail identity shape from first-party MOPS detail URLs:

```text
COMPANY_ID=<stock>
SEQ_NO=<sequence>
SPOKE_DATE=<YYYYMMDD>
SPOKE_TIME=<HHMMSS>
```

and detail route family:

```text
https://mops.twse.com.tw/mops/web/ajax_t05sr01_1
```

This is materially stronger timing evidence than the monthly aggregate archive when a qualifying disclosure row is retrievable, because the record identity carries official spoke date/time down to seconds.

Still unresolved / must be verified by later preflight before batch collection:

- the exact stable machine request (GET/POST form body) used to enumerate historical rows without browser state;
- pagination parameters and a trustworthy end-of-pagination condition;
- whether result pages expose a stable total-count or sentinel row;
- explicit source-side empty-result marker;
- cookie/session requirements;
- anti-bot/WAF behavior under GitHub-hosted runners;
- request-frequency limits;
- whether corrections/updates appear as distinct sequence/timestamped disclosures or may mutate an older row in place for every relevant disclosure class.

Observed feasibility caveat during this preregistration audit:

- direct/ajax MOPS requests can return a security-denial page rather than the requested data;
- therefore HTTP `200` or a small HTML body cannot be treated as source-empty;
- any security-denial, shrunken document, missing expected marker, header-only result, or parser-incomplete page is `suspected_soft_block_or_extraction_failure` and remains retryable in a later fresh runner.

No material-information collection is authorized until the preflight below proves the enumeration contract.

### 3. TWSE OpenAPI `t187ap05_L` / `t187ap04_L` — rejected as historical backfill source

Current builder entry point:

`scripts/build_fundamental_event_timeline.js`

Current endpoints:

```text
https://openapi.twse.com.tw/v1/opendata/t187ap05_L
https://openapi.twse.com.tw/v1/opendata/t187ap04_L
```

These endpoints are useful for current snapshots, but the current repository implementation has no verified historical date/range parameter or immutable historical-version contract. They are therefore **not** preregistered as the source for reconstructing the 33 historical gaps.

A future collector must not fetch the current OpenAPI snapshot and infer that the returned row/version was visible at an earlier T0.

### 4. TPEx equivalents — not applicable to this frozen set

The frozen unresolved stocks listed above are TWSE-listed. TPEx OpenAPI endpoints are not needed for this exact 33-identity collection plan.

### 5. Generic news / analyst / daily-gainers retrospective sources — rejected by scope

Not official-disclosure substitutes. They remain forbidden in this round and in the later collection round unless a separately preregistered evidence-class contract explicitly authorizes them.

## Historical availability and provenance contract

A future collected raw record must separate:

```text
source identity
requested historical key
source-reported publication/report time
collection time
response hash
parser/version identity
version-safety state
PIT availability decision
```

Minimum provenance fields:

```text
source_provider
source_interface
source_url_or_request_key
stock_id
historical_period_or_spoke_date
source_reported_date
source_reported_time
source_timestamp_precision
source_sequence
collected_at
http_status
final_url
response_bytes
response_sha256
parser_version
quality_state
version_safety
pit_known_at
pit_availability_rule
```

Rules:

1. `collected_at` and the later artifact git commit timestamp are audit metadata only; they never prove historical visibility at T0.
2. MOPS material-information `SPOKE_DATE` + `SPOKE_TIME`, once collected through a verified listing/detail chain, may support `official_timestamp` precision.
3. MOPS monthly-revenue `出表日期` supports only aggregate snapshot/report-date provenance. It does not become company-specific publication time.
4. When immutable historical value-version provenance is not proven, set `version_safety=historical_timing_safe_value_version_unproven` (or an equivalent explicit state) rather than silently upgrading the row.
5. A later event builder must fail closed when the provenance state does not satisfy the PIT contract.
6. Corrections/revisions discovered as separately timestamped official disclosures must be retained, not overwritten.

## Proposed exact raw-source layout for the later collection round

The monthly-revenue source contract is verified enough to preregister exact paths:

```text
data_research/institutional-flow/official-disclosure-raw/mops-monthly-revenue/202607/source.html
data_research/institutional-flow/official-disclosure-raw/mops-monthly-revenue/202607/source-meta.json
data_research/institutional-flow/official-disclosure-raw/mops-monthly-revenue/202607/rows.json
```

The raw HTML is retained because source structure, `出表日期`, row content, byte size, and response hash are part of the provenance/quality evidence.

For material information, the storage root is preregistered but per-page/detail naming remains conditional on successful preflight of pagination/record identity:

```text
data_research/institutional-flow/official-disclosure-raw/mops-material-information/
```

Do not finalize deeper material-information path naming until the machine enumeration contract proves the stable page/detail keys. This is intentional fail-closed behavior, not a rediscovery requirement.

## Deterministic future collection plan

The later round must create a planner before any fetch. Planner inputs are only:

- the immutable development freeze;
- the exact 33 unresolved identities from the reconstruction artifact;
- committed raw-source/checkpoint state;
- this preregistered source contract.

The planner must not inspect outcomes.

### Wave A — monthly-revenue archive

Deterministic queue key:

```text
mops-monthly-revenue | market=sii | revenue_month=202607
```

Current bounded queue size: `1` request key.

Physical batch rules:

- `batch_size = 1` archive request per fresh GitHub runner;
- `strategy.max-parallel: 1`;
- randomized pre-request jitter: `2-5` seconds;
- no same-runner looping across additional historical months;
- runner exits after validating and checkpointing the one archive key;
- any retry is scheduled by re-plan on a **fresh runner**;
- maximum attempts per request key across replans: `3` before manual review;
- randomized cooldown before a retry/following physical batch: `20-60` seconds;
- checkpoint after every successful physical batch.

Required quality checks before persistence:

- HTTP status and final URL;
- response bytes and SHA-256;
- expected MOPS/上市公司 structural markers;
- `出表日期` parse result;
- parsed company row count;
- all nine unique frozen stock codes are checked for visibility and their presence/absence is recorded explicitly;
- no header-only or materially shrunken response may become terminal source-empty;
- parser must report incomplete/duplicate row diagnostics.

A genuine missing stock row is terminal only when the overall archive passes quality checks and the relevant company code is truly absent from that complete archive.

### Wave B — material-information preflight

This wave is a **gate**, not yet the full material-information backfill.

Use one known frozen stock and one frozen historical year solely to verify machine-query semantics; selection must be deterministic (lowest stock id: `1102`, ROC year `115`) and outcome-blind.

Preflight request cap: maximum `3` requests total in the workflow run:

1. historical listing/query request;
2. at most one pagination/navigation verification request if required;
3. at most one detail request for a returned record.

Physical execution:

- one fresh runner;
- randomized `2-5` second jitter before each permitted request;
- stop immediately on WAF/security-denial, ambiguous shrunken HTML, missing structural marker, or unverified pagination termination;
- do not persist a terminal negative from an ambiguous response;
- no more than the preregistered three requests.

Preflight PASS requires all of:

- exact request method/body/parameters captured;
- stable historical year/company selection verified;
- pagination/end condition verified or proven unnecessary;
- detail identity includes stock, sequence, spoke date, spoke time;
- explicit source-empty signal identified;
- response-quality markers recorded;
- security/WAF response is distinguishable from genuine empty data.

If any item fails, material-information collection remains blocked; Wave A monthly-revenue evidence may still proceed independently.

### Wave C — material-information collection, only after preflight PASS

Deterministic listing partitions:

```text
(stock, ROC year 115)
```

for exactly these nine stocks:

```text
1102, 1103, 1104, 1109, 1201, 1203, 1215, 1216, 1217
```

Initial safety default:

- one company-year listing partition per physical runner;
- `strategy.max-parallel: 1`;
- maximum `1` listing request per runner plus only the bounded pagination requests proven by preflight;
- details are a second deterministic queue derived from committed listing checkpoints;
- initial detail `batch_size = 1` record per fresh runner;
- per-request jitter `2-5` seconds;
- inter-batch randomized cooldown `20-60` seconds;
- maximum `3` fresh-runner attempts per request key before manual review.

No one-long-running runner is allowed.

## Checkpoint / write / resume contract

Every physical batch writes only its bounded source key and checkpoint metadata.

Required behavior:

- checkout/fetch latest remote `main` at the start of each fresh runner;
- planner calculates only missing/retryable keys from committed state;
- completed, quality-passed remote artifacts win and disappear from the next queue;
- confirmed terminal negatives remain recorded and are not blindly refetched;
- suspected soft blocks/extraction failures remain retryable and never poison the queue permanently;
- successful later fetch overrides an earlier ambiguous failure for the same source key;
- checkpoint after every physical batch;
- before push, fetch current `main` again;
- on push race, remote completed artifacts win; replay only files still absent;
- do not use an add/add-prone blind `git pull --rebase` pattern;
- write-layer concurrency must use `cancel-in-progress: false`;
- cancelled runs resume from committed checkpoints without refetching completed source keys.

## Proposed exact later entry points

These files do not exist yet; their exact repo-relative paths are preregistered for the collection implementation round:

```text
scripts/plan_institutional_accumulation_official_disclosure_collection.js
scripts/collect_institutional_accumulation_mops_monthly_revenue_batch.js
scripts/preflight_institutional_accumulation_mops_material_information.js
scripts/collect_institutional_accumulation_mops_material_information_batch.js
tests/institutional_accumulation_official_disclosure_collection.test.js
.github/workflows/collect-institutional-accumulation-official-disclosure.yml
```

The implementation should remain domain-specific. Do not create a generic crawler framework merely for this one evidence-class collection.

## Later collector completion boundary

A future collection Prompt A may collect only the preregistered official source rows and build durable raw-source checkpoints. It must stop before:

- opening development outcomes;
- opening stock/time holdouts;
- reading protected `2454` outcomes;
- computing catalyst/outcome association;
- choosing thresholds/scores/weights;
- promoting any production strategy.

A separate Prompt B must verify durable remote artifacts and provenance before any catalyst-development round can be promoted.

## Stop conditions

Stop/fail closed when any of the following occurs:

- current remote `main` changes a frozen research identity or the 33 unresolved set materially;
- monthly archive response fails structural/row-quality checks;
- material-information machine enumeration or pagination cannot be verified;
- MOPS returns a security/WAF denial or ambiguous shrunken page;
- a source has no trustworthy historical publication/report-time semantics;
- current collection time is the only available historical-availability evidence;
- source requires broadening to generic news/analyst data;
- the task would require outcome inspection to choose what to collect.

## Explicitly unchanged / forbidden

- Phase 2 immutable freeze: unchanged.
- Refreshed development outcome artifact: not read or mutated.
- Refreshed development association artifact: not read or mutated.
- Stock holdout/time holdout outcomes: sealed.
- Protected `2454` outcomes: sealed.
- Withdrawal v6.0-v6.5 methodology/validation state: unchanged.
- No catalyst feature, success threshold, composite score, production weight, model, or strategy is created.
- No historical network backfill is executed by this preregistration round.
