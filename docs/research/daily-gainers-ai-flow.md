# Daily >=5% Gainers — Deterministic Facts + ChatGPT Synthesis

Last updated: 2026-08-20

## Architecture

```text
Raw same-day data
  -> GitHub Actions / Node.js deterministic calculation
  -> data_daily_gain_over_5/analysis-facts/YYYYMMDD.json
  -> ChatGPT synthesis + targeted web verification
  -> research_pending/daily-gainers-ai/YYYYMMDD.json
  -> GitHub schema/contract validation
  -> data_daily_gain_over_5/analysis-ai/YYYYMMDD.json
  -> normal Pages publication

If institutional verification is unresolved:
  -> next trading morning ChatGPT web recheck
  -> update the same pending JSON
  -> pending-file push triggers the same validator/promote gate
```

## Single source of truth for versions

The only canonical version/configuration source is:

`config/daily-gainers-ai-contract.json`

It defines:

- policy (`latest-rules-only`);
- current facts `schema_version` and `methodology_version`;
- current AI `schema_version`, `methodology_version`, and `model_role`;
- institutional record statuses that require external verification;
- allowed AI verification statuses.

Do **not** hard-code current `vN` methodology strings or schema numbers in generators, validators, workflows, scheduled ChatGPT prompts, or other runtime components. Documentation may describe behavior, but runtime version identity always comes from the central contract.

When the methodology evolves to v3/v4/etc., update the central contract together with the actual schema/rule implementation. Any date touched after that uses the newest contract.

Runtime consumers:

- `scripts/lib/daily_gainers_ai_contract.js` — validated contract loader;
- `scripts/daily_gainers_ai_contract_cli.js` — workflow-facing contract checks;
- `scripts/build_daily_gainers_ai_facts.js` — writes facts using the contract;
- `scripts/validate_daily_gainers_ai_analysis.js` — validates facts/AI using the contract;
- `.github/workflows/analyze-daily-gainers-margin-flow-2200.yml` — deterministic facts workflow;
- `.github/workflows/publish-daily-gainers-ai-analysis.yml` — upgrade/validate/promote workflow;
- ChatGPT scheduled synthesis and next-morning recheck — read the contract before processing.

Guardrail:

- `scripts/check_daily_gainers_ai_contract_consistency.js` rejects runtime methodology literals outside the central contract.
- `.github/workflows/check-daily-gainers-ai-contract.yml` runs that guard when contract/runtime files change.

## Latest-rules-only policy

This research pipeline does not preserve historical methodology compatibility as a production requirement.

Once the facts schema, AI methodology, verification policy, or interpretation rules are upgraded, the newest rule set becomes canonical for **all dates**. Any date regenerated, backfilled, rechecked, or re-analyzed is overwritten using the current contract.

Historical traceability comes from Git history rather than keeping stale methodology active in the production data tree.

The publication workflow therefore behaves as follows:

```text
resolve target date
  -> facts match current contract?
       no -> regenerate facts using current generator/contract
  -> pending AI matches current contract?
       no -> mark pending_outdated and do not publish old AI
       yes -> run schema + semantic validator
  -> promote to analysis-ai only after validation succeeds
```

This prevents a future contract upgrade from failing merely because an existing date was generated under an older version.

## Deterministic facts layer

Owner: GitHub Actions + Node.js.

Workflow: `.github/workflows/analyze-daily-gainers-margin-flow-2200.yml` at 21:30, 22:00, 22:30 Asia/Taipei.

Generator: `scripts/build_daily_gainers_ai_facts.js`.

Output: `data_daily_gain_over_5/analysis-facts/YYYYMMDD.json`.

For each foreign / trust / dealer source, Node.js reads the original institutional JSON rather than inferring record existence from legacy flow text. Each actor contains:

```text
net_shares
net_lots
record_status
requires_external_verification
source_file
```

`record_status` semantics:

- `reported`: official source contains the stock row and net is non-zero;
- `zero_net`: official source contains the stock row and net is exactly zero;
- `no_record`: official source is valid but contains no row for this stock;
- `unavailable`: source file is missing, empty, malformed, or not OK.

Which statuses require web verification is defined by the central contract. A facts package must never silently convert `no_record` or `unavailable` into numeric zero.

## ChatGPT synthesis and web verification

Owner: ChatGPT scheduled automation.

Primary run: 22:45 Monday-Friday Asia/Taipei.

Before analysis ChatGPT must read `config/daily-gainers-ai-contract.json` and verify the facts file matches the current contract. It must never assume a hard-coded v2/v3 value.

ChatGPT performs cross-signal reasoning across price/volume, catalyst context, foreign/trust/dealer activity, margin, broker branches, technical position, and MI_INDEX. It must not treat `legacy_rule_interpretation` as the answer.

When `institutional.verification_required=true`, ChatGPT must search public sources before finalizing the stock interpretation. Source preference:

1. official TWSE/TPEX/MOPS or other official published data;
2. traceable broker/financial data pages;
3. other credible financial information sources as secondary confirmation.

The verification distinguishes:

- confirmed real value, including confirmed zero;
- valid official daily table with no stock record;
- data not yet published / source not yet updated;
- conflicting or inconclusive evidence.

Web findings are stored separately in `institutional_verification`; allowed status values come from the central contract. The AI must not overwrite deterministic facts.

Pending output: `research_pending/daily-gainers-ai/YYYYMMDD.json`.

## Validation and publication

Owner: GitHub Actions.

Workflow: `.github/workflows/publish-daily-gainers-ai-analysis.yml`.

Triggers:

- pending AI JSON changes — immediate validation;
- central contract or runtime contract consumer changes — upgrade/consistency validation;
- 23:00 and 23:30 — same-day fallback;
- 10:15 and 10:45 next morning — recheck fallback;
- manual `workflow_dispatch`.

Validator: `scripts/validate_daily_gainers_ai_analysis.js`.

It validates against the current central contract, exact target date, stock count/order, required fields/enums, model role, and institutional verification state. Only validated pending JSON is copied to `data_daily_gain_over_5/analysis-ai/YYYYMMDD.json`.

## Next-morning recheck

A ChatGPT automation runs at 09:45 Asia/Taipei on weekdays. It reads the central contract first, then rechecks prior pending results with `pending_publication` or `inconclusive` institutional verification.

If the prior artifact is outside the current contract, that date is first recomputed/re-analyzed under the latest rules. Old methodology is never a fallback.

## Ownership rules

- `analysis/YYYYMMDD.json`: catalyst/cause research.
- `analysis-flow/YYYYMMDD.json`: legacy deterministic compatibility data; not canonical AI.
- `analysis-facts/YYYYMMDD.json`: canonical deterministic evidence under the current contract.
- `research_pending/daily-gainers-ai/YYYYMMDD.json`: unvalidated ChatGPT output/recheck state.
- `analysis-ai/YYYYMMDD.json`: canonical validated AI synthesis.

Do not allow ChatGPT and Node.js to write the same canonical derived file.

## Failure semantics

- Missing required inputs are never replaced by a previous trading day.
- `no_record` and `unavailable` are not numeric zero.
- Suspicious/true zero is externally checked before AI relies on it.
- Publication uncertainty becomes `pending_publication` and is rechecked next morning.
- Conflicting evidence becomes `inconclusive`.
- AI JSON failing the current contract remains pending and is not promoted.
- Older methodology is never used as fallback; regenerate under the central contract instead.
