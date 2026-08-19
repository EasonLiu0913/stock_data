# Daily >=5% Gainers — Deterministic Facts + ChatGPT Synthesis

Last updated: 2026-08-19

## Problem

The previous late-evening flow used Node.js `if/else` rules to produce prose such as `flow_interpretation`. That text was deterministic and reproducible, but it could be mistaken for AI analysis and could not reason well across conflicting signals such as institutional buying, margin changes, broker concentration, price action, catalyst evidence, and market context.

The repository also had a ChatGPT evening automation that directly updated `analysis-flow/YYYYMMDD.json`, overlapping with GitHub Actions that wrote the same derived file. This created unclear ownership and unnecessary write races.

## Architecture decision

Separate calculation from interpretation.

```text
Raw same-day data
  -> GitHub Actions / Node.js deterministic calculation
  -> data_daily_gain_over_5/analysis-facts/YYYYMMDD.json
  -> ChatGPT synthesis
  -> research_pending/daily-gainers-ai/YYYYMMDD.json
  -> GitHub schema validation
  -> data_daily_gain_over_5/analysis-ai/YYYYMMDD.json
  -> normal Pages publication
```

### Layer 1 — deterministic facts

Owner: GitHub Actions + Node.js.

Workflow:

```text
.github/workflows/analyze-daily-gainers-margin-flow-2200.yml
```

Schedule (Asia/Taipei):

- 21:30
- 22:00
- 22:30

Required same-day late inputs:

- ⑥ margin / credit trading;
- ⑦ broker branch details;
- ⑩ TWSE MI_INDEX;
- existing >=5% list and catalyst research.

Generator:

```text
scripts/build_daily_gainers_ai_facts.js
```

Output:

```text
data_daily_gain_over_5/analysis-facts/YYYYMMDD.json
```

The facts package may calculate deterministic metrics and copy verified source facts, but must not claim to be AI reasoning. `legacy_rule_interpretation` may remain only as compatibility/reference context and must not be treated as the final conclusion.

### Layer 2 — ChatGPT synthesis

Owner: ChatGPT scheduled automation.

Target schedule (Asia/Taipei):

```text
22:45 Monday-Friday
```

ChatGPT reads the same-day facts package only after it exists and performs cross-signal reasoning. It may also use the existing same-day catalyst context already embedded in the facts package. It must not invent missing numeric values.

Pending output:

```text
research_pending/daily-gainers-ai/YYYYMMDD.json
```

This location deliberately does not match the Pages `data*/**` publish path. An unvalidated AI response must not be treated as production research data.

Required root fields:

```text
schema_version: 1
methodology_version: daily-gainers-ai-synthesis-v1
target_date
source_facts_file
model_role: chatgpt_synthesis
market_summary
priority_watchlist
analyses
```

Each stock analysis must contain:

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
```

The AI should answer questions such as:

- Is the move institutionally confirmed or mostly short-term/speculative flow?
- Is margin expanding into the move or being cleaned out while institutions buy?
- Are broker branches concentrated or dispersed?
- Do broker and institutional signals agree or conflict?
- Is the stock move mostly individual, industry-wide, or broad-market driven?
- What evidence supports continuation and what could invalidate it?

### Layer 3 — validation and publication

Owner: GitHub Actions.

Workflow:

```text
.github/workflows/publish-daily-gainers-ai-analysis.yml
```

Schedule (Asia/Taipei):

- 23:00
- 23:30 retry window

Validator:

```text
scripts/validate_daily_gainers_ai_analysis.js
```

The validator checks:

- date consistency;
- methodology/schema version;
- source facts path;
- exact stock count and stock order;
- required text/array fields;
- allowed confidence and continuation enums;
- priority watchlist codes exist in the facts package.

Only a validated pending result is copied to:

```text
data_daily_gain_over_5/analysis-ai/YYYYMMDD.json
```

The existing canonical Pages mechanism can then publish the validated `data*/**` change.

## Ownership rules

- `analysis/YYYYMMDD.json`: catalyst/cause research. Do not overwrite in late deterministic refresh.
- `analysis-flow/YYYYMMDD.json`: legacy deterministic flow compatibility data. Not the canonical AI conclusion.
- `analysis-facts/YYYYMMDD.json`: canonical machine-readable evidence handed to ChatGPT.
- `research_pending/daily-gainers-ai/YYYYMMDD.json`: unvalidated ChatGPT output.
- `analysis-ai/YYYYMMDD.json`: canonical validated AI synthesis.

Do not allow ChatGPT and a GitHub Node.js workflow to write the same canonical derived file.

## Failure semantics

- If any required same-day 6/7/10 input is missing or invalid, GitHub does not create a new facts package from old data.
- If the facts package is missing at 22:45, ChatGPT reports that AI synthesis was skipped; it must not use the previous trading day.
- If ChatGPT output is missing at 23:00, publication safely skips and retries at 23:30.
- If AI JSON fails validation, it stays pending and is not promoted.
- A push race on deterministic generated files is resolved by resetting to latest `origin/main`, regenerating from current inputs, and retrying; do not rebase stale generated JSON.

## Methodology versions

Current versions:

```text
daily-gainers-ai-facts-v1
daily-gainers-ai-synthesis-v1
```

When the facts schema or synthesis contract changes materially, bump the corresponding methodology version so historical output remains traceable.
