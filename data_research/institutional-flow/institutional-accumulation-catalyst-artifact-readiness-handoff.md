# Institutional Accumulation — Catalyst artifact readiness handoff

Canonical active routing handoff:
`data_research/institutional-flow/institutional-accumulation-catalyst-artifact-readiness-handoff.md`

This handoff supersedes `data_research/institutional-flow/institutional-accumulation-material-information-api-contract-handoff.md` for the active catalyst-readiness lineage. The former handoff remains the durable historical record for the material-information contract and Wave C collection/closeout.

## Closed round — catalyst artifact reconstruction/readiness

Round:
`institutional-accumulation-catalyst-artifact-reconstruction-readiness-v1`

Status:
- Prompt A: **COMPLETE**
- Prompt B closeout: **PASS**

Frozen state carried forward:
- Phase 2 semantic SHA-256: `66ddb3bbf99e40bb1babb9e25a5257612a61206d827e273e6fb9b45b9c35e25b`;
- methodology-development identities: exactly `41`;
- protected `2454` remains motivation-only;
- stock/time holdout outcomes remain sealed;
- refreshed development outcome SHA-256 remains `f1c94313a023b420501033b26ce35f90ba8d52c89a0756ce9b6fc42f44a2c59e`;
- refreshed association SHA-256 remains `779e2be6708e6d8bc55062058ede6178e2dd4cf7634621d05ab05228c31e7b68`;
- Withdrawal v6.0-v6.5 remains frozen and is not an Accumulation input;
- no catalyst/outcome association, threshold, score, optimized weighting, model, strategy, production behavior, generic-news layer, or outcome-driven tuning is authorized;
- Wave A was not refetched and legacy `/mops/web/ajax_t05st01` attempt count remains frozen at exactly `2`.

Prior readiness evidence remains durable in repository history, including Prompt B PASS run `34466672001`, job `102836756516`, and readiness result 33 total / 0 ready / 33 `not_pit_ready`.

## Current round

`institutional-accumulation-catalyst-pit-provenance-resolution-v1`

Status:
- Prompt A: **COMPLETE**
- Prompt B: **PREREGISTERED / PENDING**

Prompt A baseline immediately before implementation:
`dd9566de193d8d970f047204e2ab8a7a926b44d2`.

### Prompt A result

The zero-network, outcome-blind repository/git-history audit completed for exactly the frozen 33 identities.

Deterministic decision counts:
- identities: **33/33**, each exactly once;
- `pit_ready`: **0**;
- `not_pit_ready`: **33**;
- `manual_review`: **0**;
- positive imputation: **0**;
- source/MOPS network requests: **0**.

The result is intentionally fail-closed. No identity was upgraded merely to force progress.

Durable evidence:
- Wave A source meta remains `pit_known_at=20260902` and `version_safety=historical_timing_safe_value_version_unproven`;
- all frozen T0 values are between `20260814` and `20260825`, so Wave A's declared known-at is after every T0;
- for every identity, complete git history contains no commit for the Wave A source-meta path at or before that identity's T0;
- for every identity, complete git history contains no commit for its Wave C listing source-meta path at or before that identity's T0;
- Wave C remains `source_timestamp_precision=listing_only`, `pit_known_at=null`, and `version_safety=historical_timing_safe_value_version_unproven`;
- present-day API visibility, collection time, and source event date were not back-imputed as historical PIT/version proof.

Audit history cutoff is deterministic and Taiwan-local:
`git log --all --format=%H%x09%cI --until=<T0 23:59:59+08:00> -- <repo-path>`.

### Prompt A implementation / checkpoint commits

- `c8e50795cd99432d4df84dce98469fd85186e3b7` — add catalyst PIT provenance audit;
- `6ec1cd138507e59bed6516f9393b8304e33cec07` — add PIT provenance regression;
- `2f5c6db23dad969363235a09fd1880587ca154b2` — compact audit evidence;
- `d0d9747d391cf2182ef77de73e560ce9e8474523` — align regression output contract;
- `1f3435defeeb0b317307be7d04cd6bad7af3dedf` — finalize compact PIT provenance audit;
- `ba8ad877259fd960bb5cc5bde33ad74fbe229b8d` — finalize regression assertions;
- `ffab75ac02d3a45dc35f6ea7af69bb416dca3c70` — checkpoint machine-readable PIT decisions;
- `f96797fcbe5630470390e57dbac28586c2aa32e7` — verify PIT provenance under Node 24 with complete git history.

Durable outputs / entry points:
- `scripts/audit_institutional_accumulation_catalyst_pit_provenance.js` — zero-network git-history PIT audit;
- `tests/institutional_accumulation_catalyst_pit_provenance.test.js` — deterministic regression contract;
- `data_research/institutional-flow/institutional-accumulation-catalyst-pit-provenance-resolution-v1.json` — 33-identity machine-readable audit artifact;
- `.github/workflows/test-institutional-accumulation-catalyst-readiness.yml` — Node 24 remote regression with full git history and bounded sparse worktree;
- `data_research/institutional-flow/institutional-accumulation-catalyst-artifact-reconstruction-readiness-v1.json` — prior readiness decisions;
- `data_research/institutional-flow/institutional-accumulation-official-disclosure-artifact-reconstruction-v1.json` — frozen unresolved identity source;
- `data_research/institutional-flow/official-disclosure-raw/mops-monthly-revenue/202607/source-meta.json` — Wave A provenance;
- `data_research/institutional-flow/official-disclosure-raw/mops-material-information/listings/115/` — Wave C listing provenance;
- `data_research/institutional-flow/institutional-accumulation-material-information-api-contract-handoff.md` — prior Wave C/PIT contract history.

### Node 24 validation

Workflow:
`test: institutional accumulation catalyst readiness`

Run/job:
- run `34478084243`;
- job `102873698591` (`regression`);
- conclusion: **success**.

Verified remote properties:
- checkout ref exactly `f96797fcbe5630470390e57dbac28586c2aa32e7`;
- `actions/checkout@v7` with `fetch-depth: 0`, `filter: blob:none`, and bounded non-cone sparse checkout;
- Node `v24.20.0`;
- readiness regression: **1 pass / 0 fail**;
- PIT provenance regression: **1 pass / 0 fail**;
- regenerated readiness artifact deep-equals the committed readiness artifact;
- regenerated PIT provenance artifact deep-equals the committed PIT artifact;
- workflow contains no source-fetch stage.

### Protected-state / scope verification

Prompt A did not open development outcome values, stock/time holdout outcomes, or protected `2454` outcomes. It did not open catalyst/outcome association values. It did not mutate frozen Phase 2/outcome/association artifacts, did not use Withdrawal as an input, did not refetch Wave A or Wave C, did not retry the legacy endpoint, and introduced no catalyst/outcome association, threshold, score, optimized weighting, model, strategy, production behavior, or generic-news layer.

## Next required action

Mandatory Prompt B closeout is pending for the **same round**. No future Prompt A is promoted while Prompt B remains pending.

The closeout must independently verify routing, exact 33-identity membership, zero-network execution, complete-history evidence, fail-closed decisions, protected-state invariants, Node 24 reproducibility, and durable remote outputs.

## Prompt A — PIT provenance resolution audit (completed contract)

The exact Prompt A executed in this round remains recoverable from pre-Prompt-A durable repository history at baseline `dd9566de193d8d970f047204e2ab8a7a926b44d2`. Its completion contract is satisfied; it must not be re-executed while Prompt B is pending.

## Prompt B — PIT provenance resolution closeout

```text
Perform mandatory closeout for `institutional-accumulation-catalyst-pit-provenance-resolution-v1` only after its Prompt A completes. Fetch current remote `main` and recover this exact Prompt B from durable pre-Prompt-A history. Independently verify sole active routing; exact frozen identity set and 33 identities each once; zero source network requests; repository/git-history evidence only; every `pit_ready` upgrade, if any, has affirmative pre-/at-T0 known-at and immutable-value/version proof rather than present-day visibility or event-date inference; unresolved/ambiguous identities remain fail-closed; protected development outcomes/holdouts/2454/refreshed association/Withdrawal v6 unchanged/unopened; no catalyst/outcome association, threshold, score, optimized weighting, model, strategy, production behavior, or generic-news layer; Node 24 regression reproduces exact decisions; durable outputs exist on remote `main`. Fix only bounded defects and restart verification. On PASS record exact commits/tests/counts/limitations, promote only a preregistered next round that is justified by the resulting evidence, end `Prompt B closeout: PASS`, and stop without executing the promoted Prompt A.
```

## Stop conditions

- Do not execute Prompt B automatically as part of Prompt A.
- Do not promote or execute a future Prompt A while current Prompt B is pending.
- Do not open protected outcomes or holdouts.
- Do not mutate frozen Phase 2/outcome/association artifacts.
- Do not introduce catalyst/outcome association, thresholds, scores, models, strategies, or production behavior.
- Do not refetch Wave A or Wave C.
- Do not retry the legacy endpoint.
- Fail closed whenever historical PIT/value-version proof remains unresolved.
