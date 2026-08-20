# Daily >=5% Gainers — Deterministic Facts + ChatGPT Synthesis

Last updated: 2026-08-20

## Problem

The previous late-evening flow used Node.js `if/else` rules to produce prose such as `flow_interpretation`. Deterministic text is reproducible but is not AI reasoning. A second ambiguity also existed: an institutional value of `0` could mean a genuine zero-net row, no row in an otherwise valid official table, or an unavailable/not-yet-published source. Those states must not be collapsed before AI interpretation.

## Architecture decision

```text
Raw same-day data
  -> GitHub Actions / Node.js deterministic calculation
  -> data_daily_gain_over_5/analysis-facts/YYYYMMDD.json
  -> ChatGPT synthesis + targeted web verification
  -> research_pending/daily-gainers-ai/YYYYMMDD.json
  -> GitHub schema validation
  -> data_daily_gain_over_5/analysis-ai/YYYYMMDD.json
  -> normal Pages publication

If institutional verification is unresolved:
  -> next trading morning ChatGPT web recheck
  -> update the same pending JSON
  -> pending-file push immediately triggers the same GitHub validator/promote gate
```

## Layer 1 — deterministic facts

Owner: GitHub Actions + Node.js.

Workflow: `.github/workflows/analyze-daily-gainers-margin-flow-2200.yml` at 21:30, 22:00, 22:30 Asia/Taipei.

Generator: `scripts/build_daily_gainers_ai_facts.js`.

Output: `data_daily_gain_over_5/analysis-facts/YYYYMMDD.json`.

Current contract:

```text
schema_version: 2
methodology_version: daily-gainers-ai-facts-v2
```

For each foreign / trust / dealer source, Node.js reads the original institutional JSON rather than inferring record existence from the legacy flow file. Each actor has:

```text
net_shares
net_lots
record_status
requires_external_verification
source_file
```

`record_status` has exactly these semantics:

- `reported`: official source contains the stock row and net is non-zero;
- `zero_net`: official source contains the stock row and net is exactly zero;
- `no_record`: official source is valid but contains no row for this stock;
- `unavailable`: source file is missing, empty, malformed, or not `OK`.

`zero_net`, `no_record`, and `unavailable` set `requires_external_verification=true`. `institutional.verification_required` is true if any institutional actor requires verification.

A deterministic facts package must never convert `no_record` or `unavailable` into a factual zero.

## Layer 2 — ChatGPT synthesis and web verification

Owner: ChatGPT scheduled automation.

Primary run: 22:45 Monday-Friday Asia/Taipei.

ChatGPT performs cross-signal reasoning across price/volume, catalyst context, foreign/trust/dealer activity, margin, broker branches, technical position, and MI_INDEX. It must not treat `legacy_rule_interpretation` as the answer.

When `institutional.verification_required=true`, ChatGPT must search the public web before finalizing the stock interpretation. Source preference:

1. official TWSE/TPEX/MOPS or other official published data;
2. traceable broker/financial data pages;
3. other credible financial information sources only as secondary confirmation.

The verification must distinguish:

- confirmed real value, including confirmed zero;
- valid official daily table with no stock record;
- data not yet published / source not yet updated;
- conflicting or inconclusive evidence.

The AI must not overwrite deterministic facts. Web findings are stored separately in `institutional_verification` with:

```text
status: not_required | verified | pending_publication | inconclusive
summary
checked_at
sources[]
```

A `pending_publication` or `inconclusive` result is explicitly eligible for the next-morning recheck.

Pending output: `research_pending/daily-gainers-ai/YYYYMMDD.json`.

Current AI contract:

```text
schema_version: 2
methodology_version: daily-gainers-ai-synthesis-v2
model_role: chatgpt_synthesis_with_web_verification
```

Each stock contains:

```text
code
name
funding_structure
synthesis
supporting_signals[]
conflicting_signals[]
risks[]
continuation_bias: bullish|neutral|cautious|bearish
confidence: high|medium|low
follow_up[]
institutional_verification
```

## Layer 3 — validation and publication

Owner: GitHub Actions.

Workflow: `.github/workflows/publish-daily-gainers-ai-analysis.yml`.

Triggers:

- any push changing `research_pending/daily-gainers-ai/*.json` — immediate validation;
- 23:00 and 23:30 — same-day fallback;
- 10:15 and 10:45 next morning — recheck publication fallback;
- manual `workflow_dispatch` with an optional date.

Validator: `scripts/validate_daily_gainers_ai_analysis.js`.

It checks facts v2 / AI v2 versions, exact date, exact stock count and order, required fields and enums, and institutional verification status. If a fact requires web verification, AI cannot use `not_required`.

Only validated pending JSON is copied to `data_daily_gain_over_5/analysis-ai/YYYYMMDD.json`.

## Next-morning recheck

A separate ChatGPT automation runs at 09:45 Asia/Taipei on weekdays. It finds the most recent prior `daily-gainers-ai-synthesis-v2` pending result containing `pending_publication` or `inconclusive`, rechecks only those stocks/actors on the web, and updates the same pending JSON if evidence changed.

Because the validation workflow watches pending-file pushes, an updated recheck is immediately validated/promoted; the 10:15/10:45 schedules are only fallback safety windows.

If the next-morning search still cannot confirm the data, keep `inconclusive` with updated `checked_at` and sources. Never silently convert it to zero.

## Ownership rules

- `analysis/YYYYMMDD.json`: catalyst/cause research.
- `analysis-flow/YYYYMMDD.json`: legacy deterministic flow compatibility data; not canonical AI.
- `analysis-facts/YYYYMMDD.json`: canonical machine-readable deterministic evidence.
- `research_pending/daily-gainers-ai/YYYYMMDD.json`: unvalidated ChatGPT output/recheck state.
- `analysis-ai/YYYYMMDD.json`: canonical validated AI synthesis.

Do not allow ChatGPT and Node.js to write the same canonical derived file.

## Failure semantics

- Missing required 6/7/10 inputs do not get replaced by a previous trading day.
- `no_record` and `unavailable` are not numeric zero.
- A suspicious/true zero is externally checked before AI relies on it.
- If publication timing is uncertain, mark `pending_publication` and recheck next morning.
- If sources conflict, mark `inconclusive` and preserve the conflict.
- AI JSON failing schema validation remains pending and is not promoted.

## Methodology versions

Current:

```text
daily-gainers-ai-facts-v2
daily-gainers-ai-synthesis-v2
```

Historical v1 artifacts remain traceable as v1 and are not silently rewritten by the v2 validator.
