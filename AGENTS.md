# AGENTS.md

This file defines mandatory repository-level instructions for coding agents working in `EasonLiu0913/stock_data`.

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
```

Confirm that the change does not create a second deployment path or duplicate an existing reusable workflow.

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
- Preserve unrelated triggers, permissions, concurrency settings, and reusable workflow inputs.
- Check caller permissions before adding a reusable workflow call; reusable workflows cannot elevate permissions beyond the caller.
- Avoid parallel writes to the same workflow file.
- Re-read the updated file after committing and verify the resulting commit SHA.
