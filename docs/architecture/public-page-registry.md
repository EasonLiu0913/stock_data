# Public Page Registry Architecture

## Problem

`public/index.html` historically accumulated tool links from multiple writers:

- direct edits to `public/index.html`;
- `scripts/generate_prediction_version_ui.js`;
- `scripts/update_public_index_*.js`;
- research workflows that performed targeted string replacements.

This caused stale links, duplicate entries, and versioned-page drift. A concrete example was the EPS valuation lab, where the homepage contained one legacy `eps-valuation-lab.html` entry plus multiple duplicated `eps-valuation-lab-v2.html` entries.

## Decision

Public homepage tool identity has one canonical source of truth:

```text
config/public-page-registry.json
```

Each homepage-visible page has a stable `id`, canonical `file`, `title`, `description`, `enabled`, and `order`. Historical URLs are documented in `legacy_files`.

Root-level HTML files under `public/` that intentionally should not appear on the homepage must be explicitly classified in:

```text
non_homepage_html
```

Each such entry requires a reason. A new root HTML file that is neither a canonical page, a declared legacy URL, nor a declared non-homepage page is a CI/deployment error.

The canonical generator is:

```text
scripts/generate_public_index.js
```

It updates only the `const tools = [...]` block inside `public/index.html`, deliberately preserving the rest of the existing homepage and the prediction compatibility block.

The canonical validators are:

```text
scripts/validate_public_pages.js
scripts/validate_public_index_writers.js
```

They verify:

- registry schema;
- unique page IDs;
- unique canonical files;
- valid legacy-file declarations;
- every enabled canonical HTML file exists under `public/`;
- every declared legacy/non-homepage HTML file exists;
- every root `public/*.html` file is explicitly classified;
- `public/index.html` tool entries exactly match the registry-generated block;
- no feature-specific script/workflow reintroduces an independent homepage tools writer.

## Phase 1 — completed

Phase 1 established the registry, generator, validator, and migrated the existing visible homepage tool list into the registry.

The homepage visual design and search behavior were intentionally unchanged.

The unused historical per-stock `predictions` payload was reduced to a compatibility slot; the current homepage renders only the registry-driven tool list. The daily prediction generator may still repopulate that block.

The EPS valuation lab has one canonical homepage entry:

```text
eps-valuation-lab-v2.html
```

with legacy URL:

```text
eps-valuation-lab.html
```

## Phase 2 — completed

Legacy homepage-entry writers no longer construct or inject their own `tools` entries. The following compatibility scripts delegate to `scripts/generate_public_index.js`:

```text
scripts/generate_prediction_version_ui.js
scripts/update_public_index_oversold_rebound_dashboard.js
scripts/update_public_index_etf_market_regime_analysis.js
scripts/add_three_day_breakout_report_to_index.js
```

The EPS valuation research workflow also no longer performs a targeted `eps-valuation-lab.html` string replacement. Its finalize step checks out `config/public-page-registry.json`, regenerates the homepage through the canonical generator, and runs `scripts/validate_public_pages.js`.

This establishes the ownership rule:

```text
homepage-visible tool entries
  -> config/public-page-registry.json
  -> scripts/generate_public_index.js
  -> public/index.html const tools block
```

One deliberate compatibility exception remains:

```text
scripts/generate_all_stock_predictions.js
```

It may still rewrite the separate `const predictions = [...]` block. That block is dynamic prediction payload data, is not rendered as the homepage tool registry, and must not add or modify entries inside `const tools = [...]`.

## Phase 3 — completed

The repository now enforces the registry in two layers.

### Fast CI guard

```text
.github/workflows/validate-public-page-registry.yml
```

runs on relevant pull requests and pushes and executes:

```text
node scripts/generate_public_index.js --check
node scripts/validate_public_pages.js
node scripts/validate_public_index_writers.js
```

This catches homepage drift, missing page classification, and reintroduced independent tools writers before full Pages packaging.

### Deployment guard

The canonical Pages workflow:

```text
.github/workflows/deploy-pages.yml
```

runs the same checks before dependency scanning, artifact preparation, upload, and deployment. A registry failure therefore cannot be published to GitHub Pages.

### Public HTML classification rule

Every root-level file matching:

```text
public/*.html
```

must belong to exactly one category:

1. `pages[]` — homepage-visible canonical destination;
2. `legacy_files[]` — historical/redirect URL associated with a canonical page;
3. `non_homepage_html[]` — intentional detail, embedded, research, or compatibility page with an explicit reason;
4. `public/index.html` — the generated homepage itself.

Do not silently ignore new HTML files.

### Homepage writer ownership rule

Feature-specific scripts/workflows must not construct or inject `const tools = [...]` entries or perform targeted replacements for homepage-visible HTML links.

The only canonical tools writer is:

```text
scripts/generate_public_index.js
```

`scripts/generate_all_stock_predictions.js` remains a temporary explicit exception only for the separate `const predictions = [...]` compatibility block.

## Rule for new public homepage entries

New homepage-visible pages must be registered in:

```text
config/public-page-registry.json
```

Then run:

```text
node scripts/generate_public_index.js
node scripts/validate_public_pages.js
node scripts/validate_public_index_writers.js
```

If a new root HTML page intentionally should not appear on the homepage, add it to `non_homepage_html[]` with a clear reason.

Do not add another independent homepage registry or generator. Do not directly insert or replace entries inside the `const tools = [...]` block from feature-specific scripts or workflows.
