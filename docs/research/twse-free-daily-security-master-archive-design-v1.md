# M1 research design: Free TWSE daily security-master archive (v1)

Status: **DESIGN ONLY / NOT DEPLOYED / NOT M1 ACCEPTED**  
Task: `daily-gainers-market-opening-end-to-end` (sole Active)  
Charter version: `goal-v1`. No changes to frozen M1 Prompt A/B, acceptance, production sources, or publishing rights.  
Reference date: 2026-10-08. Future capture cannot retroactively attest this trading date.

## Goal, boundaries, official candidate sources

Build a no-subscription-price, source-verifiable and reproducible daily *research* snapshot for TWSE-listed ordinary common shares; distinguish ordinary stock, Innovation Board, changed-trading-method, TPEx, ETF, ETN, depositary receipts, preferred shares, warrants and other non-common securities. No code-length inference. Access and re-use remain contingent on official website conditions; GitHub Actions storage/running quotas are finite.

| Source | Free candidate fields | Role | Critical limitation |
|---|---|---|---|
| TWSE ISIN mode 2 `https://isin.twse.com.tw/isin/e_C_public.jsp?strMode=2` | security code/name, ISIN, listed date, market, industrial group, CFI code, remarks, publisher update label | Primary point-in-time security classification **when** a valid captured source and field semantics are independently verified | Observed site update label 2026-09-26; dynamic page is not an authenticated 2026-10-08 historical archive. HTML stability and automated access require verification |
| TWSE listed-company basic info, `https://openapi.twse.com.tw/` documented `/opendata/t187ap03_L` | per-company identification | Cross-check current listed companies | Company-level, not every security/issuance; no as-of history implied |
| TWSE recent actual listings `https://www.twse.com.tw/rwd/zh/company/newlisting?response=html` | actual trading/listing effective date, board remarks | Verified listing delta after snapshot | Partial history and applicants without actual date cannot be considered listed |
| TWSE delist/board-transfer/changed trading-method disclosures and `TWTAWU` | dated events and security state | State transitions and exceptions | Separate event feeds not exhaustive market-wide issuer master; intraday halt is not a multi-day suspended `S` status |
| TWSE `MI_INDEX` archive `data_twse_mi_index/YYYYMMDD_twse_mi_index.json` | actual mixed-instrument prices and date, official five-bucket stock aggregates | Quote joins and denominator cross-check | Quote presence does not prove common-stock security class; absence does not prove delisting |
| Internal historical category CSV | Stock/InnovationBoard/ETF/TDR categories, Git commit+blob digest | Secondary bounded reconciliation | Git blob identity is not independent original issuer/date authenticity |

## Proposed research-only GitHub Actions topology (not created)

Name proposed: `[研究] TWSE Free Security Master Daily Archive` at `.github/workflows/research-twse-free-security-master-archive.yml`. This document is **not** the workflow definition; do not add an active workflow or cron in this planning phase.

- Proposed initial trigger **manual `workflow_dispatch` only** with optional strict `target_date=YYYYMMDD`, no backfill inference. After a separate approval and actual source validation, consider `schedule` on TWSE business days at **Asia/Taipei 19:47** local, converted to UTC cron **11:47 UTC**; GitHub Actions scheduled starts can be delayed. Never treat cron time as source as-of time. Provide one controlled manual retry rather than concurrent duplicate collectors.
- `permissions: contents: read`, `timeout-minutes: 20`, explicit `concurrency` grouping by trading date to avoid overlapping archives, Node 24, no GitHub Pages deployment, no YouTube upload, no V1/V2/prediction modifications. Separate archival save operation may require appropriately scoped write permission only after review.
- Phase 1 acquisition: fetch only whitelisted TWSE endpoints with stable user-agent, bounded retry/backoff, low request volume, explicit response status, MIME/type, max-bytes, byte completeness, headers. If access blocked/429/403, stop; do not evade rate limits or antibot protections. Date is never inferred from current wall clock alone.
- Phase 2 evidence: SHA-256 over **unaltered original response bytes**, exact source URL and mode, response headers (sanitize secrets), local acquisition timestamp with offset, declared publisher update/effective date (separate fields), `target_trade_date`, `archive_schema_version`, Git HEAD, declared origin and collector version, byte length, immutable per-file manifest. A TLS fetch and locally computed hash establish integrity/recorded provenance, **not historical truth** of the publisher on a prior date.
- Phase 3 normalization: validate ISIN, code, CFI/type, market, listed date, listing/delisting event effective windows, board transfer; retain raw+parsed value and `evidence_refs` per security; explicitly mark `UNVERIFIED_TYPE`, `STALE_SOURCE`, `DATE_GAP`, `CONFLICTING_EVENT`, `MISSING_CODE` instead of guessing. Treat future dated issue events as separate from actual listed date. No length-based ticker filters.
- Phase 4 reconciliation: compare source roster to current date MI_INDEX quoted codes (including non-common exclusions), official stock 5-category counts, and list absent quote records separately from official `no_trade` and `no_comparison` buckets. Reconcile known `S/T/H/R` event states only where direct dated originals exist. Halt/quote-only proof does not certify ordinary/common classification.
- Phase 5 gates: independent `fetch_ok`, `archive_sha_ok`, `publisher_date_ok`, `date_effective_coverage_ok`, `type_coverage_ok`, `quote_reconciliation_ok`, `rights_review_ok`; each tri-state `PASS|BLOCKED|FAIL` with machine reason. **`publish_authorized=false` always** in research design until separately verified original frozen M1 B. Distinguish job success `ARCHIVED_BUT_BLOCKED` from verified master: GitHub Action should be **red** when a required dated feed is absent/stale/unverifiable, not misleading green; if a business-day file is genuinely already present, check matching manifest/digest before permitting idempotent green. Non-trading day = `SKIPPED_NON_TRADING_DAY`, with auditable calendar, not automatic previous-day fallback.

## Proposed file tree and lifecycle

```text
research-archives/twse-security-master/
  YYYYMMDD/
    manifest.json                       # machine-readable date/source/gates
    raw/isin-listed-mode2.bin           # original response, no rewrite
    raw/t187ap03_L.json                 # only if legitimately fetched
    raw/listing-events.json
    raw/delisting-events.json
    raw/market-change-events.json
    derived/classified-roster.json      # research only; may contain UNKNOWN
    derived/coverage.json
    checks/verification.json
```

Storage must remain **outside `public/`, `_site/` and the deployed Pages artifact**. Preferred: archived GitHub Actions artifacts for short-term troubleshooting and hash-pinned durable repository or an approved private/free external store for essential originals and manifests (subject to actual quota); artifacts have finite retention and cannot be the sole permanent archive. Avoid committing large daily HTML/JSON captures into `main` indefinitely; proposals for dedicated archive branch or object storage need governance, byte budgets and write permission review. Suggested preliminary policy: retain daily original bytes and manifest **indefinitely if capacity permits**, rolling Actions debug logs/artifacts for **30 days or the account's available minimum**, and prune derived/cached copies after 90 days *only if reproducible from immutable originals*. Define storage budget caps, monthly review, content hash de-duplication across dates only with distinct date manifests, and integrity sampling. Fail closed when retention capacity cannot preserve required immutable evidence; never claim full historical replay if required bytes expired.

## Evidence and acceptance boundary

1. A successful new daily snapshot from date D establishes only the date and source as independently documented at D; no retrofit of D' older than the publisher's available original snapshot.
2. Reconstructing an older date from events is acceptable only after demonstrating **exhaustive** boundary-state evidence for all issuer types and transfers; no assumption that no event found means no event happened.
3. Match every eligible common share's genuine effective-date type/listing window and exclusions. Market trading values and ordinary-share trading values must never be substituted.
4. Research collector is standalone and never changes the frozen M1 A/B contracts; future pilot requires separate scoped Prompt A implementation then independently verified Prompt B, before any production routing or publishing.
5. Existing 2026-10-08 evidence (#27: 62/62 unit tests, 1082/3 quote matching) remains supported quote-join only. The 2026-10-08 ordinary-share security-master identity gate **remains BLOCKED** until qualified original date-effective evidence is acquired.

## Planned validation matrix before optional implementation

| Test | Required result |
|---|---|
| Wrong publisher updated date or stale day | BLOCKED, no fallback |
| Rate limited / website HTML changed / API missing | FAIL/BLOCKED with exact endpoint, no partial promotion |
| Raw response altered | Digest mismatch -> FAIL |
| Duplicate code / contradictory classification | FAIL |
| Code appears in quote but not a verified master | BLOCKED with per-code exception |
| Suspended-not-quoted vs no-trade vs X | Distinct categories, never double count |
| Innovation board, TDR, ETF, preferred, ETN, warrant | Explicit type evidence and exclusion handling |
| Repeat run with same byte hashes | Idempotent, no duplicate artifact promotion or Pages deployment |
| Legitimate non-trading date | Correct SKIPPED with sourced trading calendar |
| Archive retention exhausted | BLOCKED + visible manifest reason, original evidence retained if possible |
| Historical rewind/backfill without original day archive | BLOCKED, no invented history |

## Decision and scope

**Recommended route:** validate free official capture semantics and source completeness first; then separately seek approval for a **manual research-only pilot**. Do not schedule or automatically collect now. Do not presume free official source guarantees 2026-10-08 historical M1 PASS. TRANISIN remains qualified paid reference/optional owner procurement, not an automatic purchase. Goal v1 and frozen M1 acceptance remain unchanged.
