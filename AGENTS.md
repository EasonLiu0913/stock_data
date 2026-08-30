# AGENTS.md

This file defines mandatory repository-level instructions for coding agents working in `EasonLiu0913/stock_data`.

## Project philosophy

Before making a substantial architecture, research, strategy, backfill, workflow, or shared-framework decision, read:

1. `docs/project-philosophy.md`
2. `docs/roadmap/current-phase.md`
3. The relevant `docs/architecture/**` document
4. The relevant `docs/research/**` document
5. Applicable `docs/decisions/ADR-*.md`

All implementation must follow the project philosophy:

> **Let evidence drive evolution.**  
> **Build platforms from proven patterns, not predicted needs.**

Mandatory interpretation:

- Evidence before Strategy.
- Evidence before Abstraction.
- Research before Automation.
- Extract shared platform capabilities only after real repeated use cases demonstrate the pattern.
- Prefer one source of truth for core concepts.
- Preserve traceability/version identity for important strategies, schemas, registries, and research methodology.
- Prefer small validated evolution over speculative large redesigns.
- Optimize for maintainability, observability, and reproducibility rather than cleverness.

Before introducing a major feature or abstraction, answer:

1. What real problem does this solve now?
2. Is this the first use case, or is there repeated evidence of the same need?
3. Should this remain domain-specific, or is there enough evidence to promote it into a platform capability?
4. Which architecture, research, roadmap, or ADR document must be updated with the change?

See `docs/project-philosophy.md` and `docs/decisions/ADR-000-project-philosophy.md` for the canonical rationale.

## Mandatory documentation handoff

The documentation is a living project handoff. Do not rely only on prior chat history when the repository documents contain the current decision or roadmap.

When a major architecture decision, research conclusion, rejected approach, or active development phase changes, update the corresponding document in the same development cycle.

## Phase handoff checkpoints

Every multi-step task, investigation, research thread, backfill, workflow migration, or other effort that is expected to continue across rounds should remain ready for another agent to take over the next round without requiring the user to reconstruct the history manually.

A handoff is a fast path into the current state, not a restriction on how an agent may investigate. A new agent may still search the repository from scratch, independently verify assumptions, or challenge prior conclusions when useful. The requirement is that the repository itself preserves enough current state that continuing from the prior round is possible immediately.

### When to checkpoint

Before beginning the next meaningful round or phase, update and commit the canonical handoff whenever the previous round materially changed any of these:

- current understanding of the problem;
- root-cause evidence;
- architecture or implementation decisions;
- frozen constraints or research rules;
- completed code/workflow/data changes;
- known failure modes or rejected approaches;
- current repository entry points;
- next-round objective or execution order.

Do not update the handoff for every mechanical request, every individual batch, or every trivial commit. Checkpoint at meaningful phase boundaries: investigation → fix, fix → validation, validation → next coverage wave, research → implementation, implementation → rollout, and similar transitions.

### Canonical handoff location

Prefer an existing project-specific handoff when one already exists. Long-running research or domain projects should keep their handoff close to the project, for example:

```text
data_research/<project>/<project>-handoff.md
```

Existing project-specific handoffs remain canonical and should not be duplicated elsewhere.

If no project-specific handoff exists, create one under:

```text
docs/handoffs/<task-or-project-name>.md
```

The handoff must state its own canonical repository path near the top so the user and future agents can reference it unambiguously.

### Required handoff contents

A canonical handoff should contain, as applicable:

```text
# Task / project name

Canonical handoff: <repo path>

## Current phase
## Objective
## Frozen decisions / constraints
## Completed
## Evidence / validation
## Current repository state
## Known problems / rejected approaches
## Entry points
## Next round
## Safety / stop conditions
## Prompt A — Next-round implementation prompt
## Prompt B — Next-round closeout / verification prompt
```

`Entry points` should name the scripts, workflows, directories, functions, or documents most likely to matter next. This is meant to save rediscovery time, not to forbid broader repository search.

`Evidence / validation` should include useful commit SHAs, workflow run IDs, test results, representative diagnostics, or other concrete evidence when available.

`Next round` should be executable and ordered. Avoid vague entries such as "continue investigating" when the next concrete checks are already known.

### Paired implementation + closeout prompts

Every active handoff checkpoint must preserve **two** ready-to-copy prompts for the following round.

- **Prompt A — Next-round implementation prompt** defines startup, planned work, frozen constraints, safety rules, and the meaningful phase boundary.
- **Prompt B — Next-round closeout / verification prompt** must be written **before Prompt A is executed** and defines how that round will be independently verified before it can close.

Prompt B must be phase-specific, not a generic "check the result" instruction. As applicable, predefine the commits, workflow runs/jobs, physical-batch boundaries, request caps, jitter/cooldowns, durable checkpoints, race-safe push behavior, response-quality diagnostics, regression tests, coverage/audit counts, forbidden artifacts, deployment state, or other invariants that must be checked.

The intended lifecycle is:

```text
Handoff N
│
├─ Prompt A
│   Next-round Implementation Prompt
│
└─ Prompt B
    Next-round Closeout / Verification Prompt
        ↓
Agent executes Prompt A
        ↓
work / workflow completes
        ↓
user sends Prompt B to the agent
        ↓
agent performs phase-closeout review
        ↓
problems found?
├─ yes
│   ↓
│   fix / bounded rerun
│   ↓
│   repeat Prompt B verification
│
└─ no
    ↓
update canonical handoff
    ↓
commit handoff
    ↓
verify current main has not made the handoff stale
    ↓
produce:
    Prompt A(N+1)
    Prompt B(N+1)
    ↓
stop
```

The closeout gate is mandatory:

- If Prompt B finds an important failure, lost checkpoint, stale assumption, safety violation, incomplete workflow, or missing evidence, do **not** proceed as if the phase were clean. Fix or bounded-rerun only what is needed, then repeat closeout verification.
- If a preregistered research gate such as a coverage/sample-freeze gate is reached, record and commit that gate at the phase boundary and **stop before opening the next evidence class in the same round**. Reaching sample freeze does not authorize that same round to inspect untouched outcomes.
- The final closeout response must provide both Prompt A and Prompt B for the next round, and the canonical handoff must preserve both as durable repository state.
- Do not begin Prompt A(N+1) merely because it was generated unless the repository owner explicitly asks to continue.

This paired-prompt rule preregisters verification criteria before work starts and prevents a successful-looking implementation summary from substituting for a real phase-closeout review.

### Copy-paste next-round prompt

Every active handoff must end with the paired Prompt A / Prompt B package defined above. Prompt A continues implementation; Prompt B performs closeout/verification after that work finishes.

The prompt must be self-guiding. Do not assume a new agent already knows this repository's handoff rules or other repository-level instructions. The prompt must explicitly instruct the receiving agent to read the repository-root `AGENTS.md` first, then read the canonical handoff, then verify the current `main` state before continuing.

Use a structure like:

```text
Continue the <task/project> in repository `EasonLiu0913/stock_data`.

Before doing any work:
1. Read the repository-level instructions in `AGENTS.md`.
2. Read the canonical handoff for this task: <canonical handoff path>.
3. Verify that the current `main` branch still matches the commits, workflows, files, and assumptions referenced by the handoff.
4. Continue from the handoff's `Next round` section.

You may independently search the repository, re-check implementation details, or challenge previous conclusions when useful. The handoff is intended to provide a ready-to-continue state, not to prevent fresh investigation.

Preserve all frozen decisions, research constraints, safety rules, physical-batch requirements, and stop conditions unless new evidence clearly requires revisiting them.

Next focus: <explicit next-round objective>

Before starting another major round or phase:
- update the canonical handoff with what was completed;
- record important evidence, commits, workflow runs, failures, and changed understanding;
- update `Current phase`, `Current repository state`, `Entry points`, and `Next round`;
- update Prompt A for the following round;
- update the phase-specific Prompt B closeout criteria for the following round;
- commit the handoff to the repository.

Do not rely on private conversation history as the only record of project state. Keep the repository handoff ready for either the same agent or a new agent to continue from the next phase.
```

If the next round has a specific action, include it explicitly rather than leaving only the placeholder. For example:

```text
Next focus: audit historical HiStock source_empty checkpoints created by old long-running runners, classify ambiguous degraded responses, and requeue only unsafe negatives through the fresh-runner physical-batch workflow.
```

The prompt should be usable without relying on private chat history, and it must carry forward the requirement to create the next handoff checkpoint before another major phase begins.

### Handoff commit expectations

The handoff must be committed to the repository before the next major round begins when a checkpoint is required.

Preferred commit-message shape:

```text
docs: checkpoint <task> handoff
```

It is also acceptable to include the handoff update in the final implementation or validation commit of the round when that keeps the repository state atomic.

A conversation summary alone is not a durable project handoff. Important continuing state should live in the repository so another conversation or agent can inspect it directly.

### Research-first architecture rules

- New data or a promising backtest must not directly become a production strategy.
- Research should proceed through historical validation, baseline-relative ranking, stability, industry analysis, and market-regime analysis before explicit strategy promotion.
- Market environment is research/dashboard context only. It must not gate a fixed strategy, hide otherwise matching stocks, or make a strategy disappear.
- Historical stock-price research should use the unified price provider rather than adding new direct legacy price-source dependencies.
- Long historical backfills must prefer checkpoint/resume behavior, and recurring research updates should prefer incremental monthly detail generation over unnecessary full-history recomputation.
- Baseline choice must be explicit: broad factor research compares with the same-month listed-stock universe; industry conclusions compare with the same-month same-industry universe.

See `docs/README.md` and `docs/decisions/` for rationale and details.

## Safe large-fetch architecture: plan + fresh-runner physical batches

These rules are mandatory for any large crawl, backfill, historical repair, multi-stock fetch, coverage expansion, or other workflow that can issue many requests to the same external server.

Whenever the repository owner asks for **plan + batch**, interpret that phrase as this architecture by default. A `for` loop with a small `batch_size` inside one long-running GitHub Actions job is **not** sufficient.

### Required execution model

Use this sequence unless the source has already been proven safe under a stricter documented alternative:

```text
plan
→ deterministic bounded queue
→ split queue into physical batches
→ fresh GitHub runner for batch 0
→ checkpoint / push progress
→ runner exits
→ cooldown
→ fresh GitHub runner for batch 1
→ checkpoint / push progress
→ runner exits
→ ...
→ re-plan from committed state
→ continue remaining batches
```

A physical batch means a separate GitHub Actions job / runner lifecycle. The purpose is to reset the runner process, HTTP connection pool, cookies/session state, DNS/network path, and other long-lived request behavior between batches.

Do **not** treat either of these as equivalent to a physical batch:

```text
one job → loop batch 0 → sleep → loop batch 1 → sleep → loop batch 2
one runner → many requests with only per-request jitter
```

Those patterns may still accumulate server-side throttling or soft-block state even if the code calls them "batches".

### Planner requirements

Before fetching, create a deterministic plan from source-derived or otherwise preregistered inputs. The planner must:

- define the bounded universe / date range / stock set before requests begin;
- calculate the missing work from committed repository state;
- never cherry-pick successful cases based on outcomes;
- produce an explicit queue or matrix that can be inspected before execution;
- cap work per workflow run;
- define `batch_size` explicitly;
- preserve deterministic ordering unless randomized ordering is explicitly required for network safety;
- make re-planning idempotent so completed checkpoints disappear from the next queue;
- support resume after cancellation, runner failure, or partial completion.

For research workflows, planning must remain outcome-blind when the research contract requires it.

### Physical batch defaults

Unless the source-specific workflow documents a safer tested value:

- Use `strategy.max-parallel: 1` for matrix jobs that hit the same external source.
- Keep each physical batch small. For HTTP page scraping, start around 1–5 requests per runner rather than dozens or hundreds.
- Use randomized per-request jitter inside a batch.
- Use a randomized cooldown between physical batches.
- End the runner after the batch instead of keeping one runner alive for the whole queue.
- Re-checkout the latest committed `main` at the start of each new physical batch.
- Commit/push a checkpoint after each batch when the workflow writes repository data.
- Keep write-layer concurrency non-canceling: `cancel-in-progress: false`.

Example shape:

```yaml
jobs:
  plan:
    # produce matrix JSON from committed state

  fetch:
    needs: plan
    strategy:
      max-parallel: 1
      matrix: ${{ fromJSON(needs.plan.outputs.matrix) }}
    runs-on: ubuntu-latest
    steps:
      - checkout latest main
      - randomized physical-batch cooldown
      - fetch only this bounded batch
      - validate response quality
      - checkpoint and push
```

If one physical batch contains several requests, still add a small randomized delay between requests. The batch boundary does not replace request-level pacing; both are required.

### Fresh-runner requirement

For a source that has shown throttling, incomplete responses, connection degradation, or anti-bot behavior, every physical batch must use a fresh runner by default.

Do not "optimize" the workflow back into one long-running job merely to reduce Actions startup overhead. Server reliability and data correctness take priority over a few extra runner startups.

If a later optimization proposes reusing one runner across many batches, it must first demonstrate with diagnostics that response quality does not deteriorate over time and document that evidence.

### Response-quality guardrails and soft-block detection

HTTP `200` is not sufficient evidence that a request succeeded correctly.

Large-fetch code must record enough diagnostics to detect a soft block or degraded response, for example:

- HTTP status;
- final URL / redirects;
- response byte size;
- requested date / stock visibility;
- expected source keywords;
- table row count / record count;
- known structural markers or sentinel records when available;
- parser completeness / incomplete-record count.

If the source normally returns a materially larger document or populated table and a later request suddenly returns a much smaller response or header-only table, classify that as a suspected extraction / throttling failure first. Do not immediately persist it as genuine source-empty data.

In particular, a result such as:

```text
HTTP 200
requested date visible
response materially smaller than normal
table_rows = 1 (header only)
```

must not automatically become terminal `source_empty` when the source may be soft-blocking or returning a degraded page.

Terminal negative evidence should require an explicit, trustworthy source-side empty signal or another validated rule. Ambiguous degraded responses must remain retryable/reviewable and should be retried later in a fresh-runner physical batch.

### Failure memory and checkpoint rules

Every batch must distinguish at least:

- success;
- confirmed source-empty / terminal negative;
- transient network or server error;
- suspected extraction / soft-block failure;
- permanent quality failure when genuinely non-retryable.

Persist enough status to avoid blindly repeating confirmed terminal negatives, but do not let a suspected soft block permanently poison the queue.

A successful later fetch must override an earlier ambiguous failure for the same source key/date.

Checkpoint behavior must be concurrency-safe:

- completed files already on remote `main` win;
- after a push race, fetch the latest `main`, reset/replay safely according to the repository's checkpoint helper, and replay only files still absent;
- do not use an add/add-prone blind `git pull --rebase` pattern for append-only checkpoint files;
- a cancelled workflow must be able to resume from committed checkpoints without restarting the entire range.

### Re-plan between waves

After a bounded wave of TDCC, Broker, market, or other source fetches finishes, re-run the planner against the newly committed state before scheduling more work.

Do not precompute one enormous static request list and execute it for hours. Prefer:

```text
plan wave
→ physical batches
→ checkpoint
→ re-plan
→ next wave
```

This reduces duplicate requests and lets newly satisfied coverage gates remove unnecessary work.

### Evidence from the HiStock validation incident

This rule is based on observed repository behavior, not theory.

During institutional-withdrawal validation coverage, a long-running Broker job initially fetched HiStock normally but later returned degraded pages. One known-positive `1598 / 2026-05-07` request returned approximately 69 KB with only `table_rows = 1` and was incorrectly classified as `source_empty`, even though the browser showed a populated broker table.

A diagnostic using fresh-runner physical batches fetched the same known-positive page repeatedly with approximately 90 KB responses, `table_rows = 16`, and the expected broker rows. The production recovery workflow was then changed to true physical batches. Broker batches at the beginning, middle, and end of the run continued returning populated ~90 KB pages with 16 rows, including the final batch, instead of degrading late in the run.

Therefore the repository-level default is:

> **Large external-source fetches use plan + bounded queue + fresh-runner physical batches + jitter + cooldown + checkpoint + re-plan/resume.**

This is the required meaning of **plan + batch** for future work unless the repository owner explicitly asks for a different execution model or a source-specific documented test proves another model equally safe.

## GitHub Actions workflow architecture

These rules apply to every change under `.github/workflows/**`.

### Never use `workflow_run` for workflow chaining

- Do not use `workflow_run` to continue prediction, replay, strategy, or Pages deployment workflows.
- Do not create a separate workflow that listens for another workflow to finish.
- Do not use event-based workflow chaining for deployment.
- Do not introduce Actions that appear as `Unknown event`.
- Any newly added `workflow_run` must be treated as an architecture error unless the repository owner explicitly authorizes that exact use.

### Required chaining method

Use reusable workflows and explicit job dependencies:

1. The downstream workflow must expose `on: workflow_call`.
2. The upstream workflow must call it with job-level `uses:`.
3. Use `needs:` to define execution order.

Example:

```yaml
deploy_pages:
  name: Deploy GitHub Pages
  needs: previous_job
  uses: ./.github/workflows/deploy-pages.yml
```

Do not replace this pattern with `workflow_run`, `repository_dispatch`, or a new event-listener workflow.

## Canonical Pages deployment workflow

All GitHub Pages deployments must reuse:

```text
.github/workflows/deploy-pages.yml
```

Do not create another Pages deployment workflow when the existing reusable workflow can support the requirement.

## Workflow concurrency layering

Concurrency rules are intentionally different for repository/data writers and for the final Pages publication layer.

### Data / repository write layer: never cancel in progress

Any workflow that may persist repository state is a write-layer workflow. This includes workflows with any of these characteristics:

- `permissions: contents: write`;
- `git commit`;
- `git push`;
- checkpoint commits during crawls, prediction, replay, research, normalization, or backfills.

If such a workflow uses a concurrency group, it must use:

```yaml
cancel-in-progress: false
```

It may omit cancellation when no shared serialization group is required, but it must not use `cancel-in-progress: true`.

Reason: generated or validated data may still exist only on the runner before the final push. Cancelling the writer can discard that uncommitted progress.

### Pages publication layer: stale runs should be cancelled

The canonical `.github/workflows/deploy-pages.yml` is a publication-only workflow. It must:

- never commit or push repository data;
- checkout `ref: main` before packaging;
- use the shared `github-pages` concurrency group;
- use `cancel-in-progress: true`.

Required configuration:

```yaml
concurrency:
  group: github-pages
  cancel-in-progress: true
```

Because every Pages run rebuilds from the latest committed `main`, cancelling an older Pages-only run cannot remove committed data. A newer run simply rebuilds and publishes the newer complete `main` state.

The required boundary is:

```text
generate / validate / commit / push main
→ non-cancelable data-write layer

checkout latest main / package / upload / deploy Pages
→ cancelable publication layer
```

A Pages job must remain downstream of the successful data-writing job, normally through `needs:`. Never move repository writes into `deploy-pages.yml`.

The repository-wide guard is:

```text
node scripts/audit_workflow_deployment_races.js --self-test
node scripts/audit_workflow_deployment_races.js
```

It scans every `.yml` / `.yaml` file in `.github/workflows`, not only currently known Pages callers.

## Required workflow chains

### Daily stock prediction

The intended order is:

```text
generate_v1
→ generate_v2
→ apply_strategy_registry
→ deploy_pages
```

`apply_strategy_registry` must call:

```text
.github/workflows/apply-strategy-tag-registry.yml
```

The strategy registry workflow must then directly call:

```text
.github/workflows/deploy-pages.yml
```

### Daily prediction replay

The intended order is:

```text
replay_and_compare
→ deploy_pages
```

The deployment job must directly reuse `.github/workflows/deploy-pages.yml` with `needs: replay_and_compare`.

## Required checks before editing workflows

Before changing any workflow, search the repository for:

```text
workflow_run
deploy-pages.yml
workflow_call
uses: ./.github/workflows/
cancel-in-progress
contents: write
git push
```

Confirm that the change does not create a second deployment path, duplicate an existing reusable workflow, or violate the write-layer/publication-layer concurrency boundary.

## Playwright and browser-install workflow rules

These rules apply to workflows that use Playwright, Chromium, or another browser runtime.

- Do not remove Playwright, Chromium, or required Linux browser dependencies merely to make a workflow faster. Preserve the runtime requirements of the scraper first.
- If the workflow currently requires `npx playwright install --with-deps chromium`, keep that functional requirement unless the scraper has been explicitly verified to work without it.
- Prefer dependency caching over deleting required install steps.
- When `package-lock.json` exists, configure `actions/setup-node` with npm cache:

```yaml
- name: Setup Node.js
  uses: actions/setup-node@v4
  with:
    node-version: '22'
    cache: 'npm'
    cache-dependency-path: package-lock.json
```

- For Playwright browser downloads, cache the browser directory with a key tied to the dependency lock file:

```yaml
- name: Cache Playwright browsers
  uses: actions/cache@v4
  with:
    path: ~/.cache/ms-playwright
    key: ${{ runner.os }}-playwright-${{ hashFiles('package-lock.json') }}
    restore-keys: |
      ${{ runner.os }}-playwright-
```

- Keep deterministic dependency installation with `npm ci`.
- Keep the browser installation command after cache restore so a cache miss, Playwright version change, or incomplete cache can self-heal safely.
- Treat the first run after adding or invalidating the cache as a cold run; later runs should reuse cached npm metadata and Playwright browser binaries.
- If a workflow repeatedly stalls in dependency installation, inspect whether it is downloading npm packages, Linux packages, or Playwright browser binaries before changing scraper logic.
- Do not assume a long install step means the scraper itself is broken. Distinguish runner/network failures such as HTTP 429 or 503 from application failures.
- Preserve existing triggers, permissions, data-generation commands, and commit/push behavior when applying this caching optimization. Preserve concurrency only when it remains consistent with the repository-wide write-layer/publication-layer rule above.

Known workflows using this pattern include:

```text
.github/workflows/warrant-scraper.yml
.github/workflows/update-twse-industry.yml
```

Apply the same safe pattern to other Playwright-based workflows when the same repeated-install problem is observed.

## Canonical public page registry

Homepage-visible public tools have exactly one source of truth:

```text
config/public-page-registry.json
```

Before adding, removing, renaming, versioning, or replacing a public HTML destination, read:

```text
docs/architecture/public-page-registry.md
```

Mandatory rules:

- Do not directly insert, append, or replace homepage-visible entries inside `public/index.html`.
- Do not create another homepage registry or feature-specific homepage writer.
- Add homepage-visible pages to `pages[]` in `config/public-page-registry.json`.
- Put historical/redirect URLs in the owning page's `legacy_files[]`.
- Root-level `public/*.html` files that intentionally should not appear on the homepage must be listed in `non_homepage_html[]` with a reason.
- Every root `public/*.html` file must be classified as canonical, legacy, non-homepage, or `index.html`.
- Regenerate homepage tools only through `scripts/generate_public_index.js`.
- `scripts/generate_all_stock_predictions.js` may update only the separate `const predictions = [...]` compatibility block; it must not modify `const tools = [...]`.

Required checks after changing public page identity or homepage behavior:

```text
node scripts/generate_public_index.js
node scripts/generate_public_index.js --check
node scripts/validate_public_pages.js
node scripts/validate_public_index_writers.js
```

The canonical Pages workflow and `[00 網站部署] Public Page Registry CI` both enforce these rules. Do not bypass or remove these checks to make a deployment pass.

## GitHub Pages frontend data paths

These rules apply whenever a page under `public/**` reads repository data at runtime.

### Repository root and Pages URL mapping

GitHub Pages serves this repository below `/stock_data`:

```text
repository: data_fubon/files.json
Pages URL: /stock_data/data_fubon/files.json

repository: public/foreign.html
Pages URL: /stock_data/public/foreign.html
```

Data directories such as `data_fubon`, `data_predictions`, `data_prediction_analysis`, `normalized_*`, and `config` remain at the published site root. Do not incorrectly place them below `/public` or request them through `/stock_data/public/data_*`.

For pages that support both GitHub Pages and local viewing, preserve the established base-path pattern:

```js
const isGitHubPages = window.location.hostname.includes('github.io');
const basePath = isGitHubPages ? '/stock_data' : '..';
```

A runtime request should therefore use a repository-root path such as:

```js
fetch(`${basePath}/data_fubon/files.json`);
```

### Dynamic paths must be packaged explicitly

Do not assume the Pages dependency scanner can discover only literal paths. Template strings and dynamically assembled requests such as these are deployment dependencies:

```js
`${basePath}/data_fubon/files.json`
`${basePath}/data_fubon/fubon_${date}_institutional.json`
```

Variable-based paths are also deployment dependencies:

```js
const DATA_DIR = 'data_twse_margin_balance';
fetch(`${getBasePath()}/${DATA_DIR}/files.json`);
```

When adding or changing a runtime data path:

1. Confirm `.github/workflows/deploy-pages.yml` discovers its root directory.
2. Confirm the directory is copied into `_site`.
3. Add a deployment assertion for the required manifest or representative file when the page depends on it.
4. Keep the dynamic dependency scanner and its self-test working.
5. Test the final Pages-shaped path, not only the repository file path.

For a page driven by a manifest such as `files.json`, deployment must include both the manifest and every file that the manifest can direct the page to load. Publishing the HTML without its runtime data is a deployment failure.

### One dependency scanner for every public page

The canonical frontend dependency scanner is:

```text
scripts/scan_pages_dependencies.js
```

It must scan every HTML, JavaScript, module, and CSS asset below `public/**`. It must recognize at least:

- Static relative paths such as `../data_xxx/files.json`.
- Absolute Pages paths such as `/stock_data/data_xxx/files.json`.
- Direct template paths such as `${basePath}/data_xxx/files.json`.
- Paths assembled through constants such as `DATA_DIR`, `*_DIR`, or `*_ROOT`.
- Repository-root data directory names stored in string literals.

The scanner must resolve Git objects even when sparse checkout has not materialized the referenced directory yet. A missing directory in the initial sparse working tree must not be interpreted as an unused dependency.

Before changing Pages path or packaging logic, run:

```text
node --check scripts/scan_pages_dependencies.js
node scripts/scan_pages_dependencies.js --self-test
node scripts/scan_pages_dependencies.js --json .
```

Do not add a second inline regular-expression scanner to the workflow. Update the canonical scanner and its self-test instead. The final Pages build must verify that every dependency returned by this scanner exists under `_site` before upload.

### Never hide a missing deployment dependency with today's date

A failed manifest request must not silently replace an explicitly requested date with the browser's current date. That behavior previously caused a URL requesting `date=20260804` to attempt loading `fubon_20260805_institutional.json` after `/data_fubon/files.json` was omitted from the Pages artifact.

Required behavior:

- Preserve a valid date supplied in the URL while loading dependencies.
- If the manifest cannot be loaded, show the actual manifest/path error.
- Do not present a generated "today" option as though it were available data.
- Do not request a dated file unless that date came from the successfully loaded manifest or another verified source.

### Required checks before changing public data loading or Pages packaging

Search `public/**` for all relevant forms, including:

```text
fetch(
basePath
DATA_DIR
data_fubon
data_twse_margin_balance
data_predictions
data_prediction_analysis
files.json
```

Then verify the generated artifact contains the exact requested resources, for example:

```text
_site/data_fubon/files.json
_site/data_fubon/fubon_YYYYMMDD_institutional.json
_site/data_twse_margin_balance/files.json
_site/data_twse_margin_balance/YYYYMMDD_twse_margin_balance.csv
```

Add or update a regression test whenever a path omission, date fallback, or Pages-only path problem is fixed. A repository file existing on `main` is not sufficient evidence that it exists in the deployed Pages artifact.

## Pages deployment performance rules

- Validate only the requested target prediction or replay date during deployment.
- Do not validate every historical date during routine deployment.
- Keep sparse checkout enabled in `.github/workflows/deploy-pages.yml`.
- Package only data roots actually referenced by frontend assets.
- Do not restore full-repository checkout and full-repository `rsync` packaging.
- Preserve historical dashboard access only for data that the published frontend actually references.
- Keep `scripts/prepare_pages_site.sh --self-test` working when deployment packaging logic changes.
- Keep `scripts/scan_pages_dependencies.js --self-test` working when frontend data-loading patterns change.

## Safety when modifying workflows

- Fetch the latest `main` version before editing.
- Preserve unrelated triggers, permissions, and reusable workflow inputs.
- Preserve or change concurrency according to the mandatory write-layer/publication-layer rule above; do not blindly retain an unsafe legacy setting.
- Check caller permissions before adding a reusable workflow call; reusable workflows cannot elevate permissions beyond the caller.
- Avoid parallel writes to the same workflow file.
- Re-read the updated file after committing and verify the resulting commit SHA.
