# Public Page Registry Architecture

## Problem

`public/index.html` historically accumulated tool links from multiple writers:

- direct edits to `public/index.html`;
- `scripts/generate_prediction_version_ui.js`;
- `scripts/update_public_index_*.js`;
- research workflows that performed targeted string replacements.

This caused stale links, duplicate entries, and versioned-page drift. A concrete example was the EPS valuation lab, where the homepage contained one legacy `eps-valuation-lab.html` entry plus multiple duplicated `eps-valuation-lab-v2.html` entries.

## Decision

Public homepage tool identity now has one canonical source of truth:

```text
config/public-page-registry.json
```

Each registered page has a stable `id`, canonical `file`, `title`, `description`, `enabled`, and `order`. Historical URLs may be documented in `legacy_files`.

The canonical generator is:

```text
scripts/generate_public_index.js
```

It updates only the `const tools = [...]` block inside `public/index.html`, deliberately preserving the rest of the existing homepage and the prediction compatibility block.

The validator is:

```text
scripts/validate_public_pages.js
```

It currently verifies:

- registry schema;
- unique page IDs;
- unique canonical files;
- valid legacy-file declarations;
- every enabled canonical HTML file exists under `public/`;
- `public/index.html` tool entries exactly match the registry-generated block.

## Phase 1 scope — completed

Phase 1 establishes the registry, generator, validator, and migrates the existing visible homepage tool list into the registry.

The homepage visual design and search behavior are intentionally unchanged.

The unused historical per-stock `predictions` payload was reduced to a compatibility slot; the current homepage renders only the registry-driven tool list. The daily prediction generator may still repopulate that block.

The EPS valuation lab now has one canonical homepage entry:

```text
eps-valuation-lab-v2.html
```

with legacy URL:

```text
eps-valuation-lab.html
```

## Phase 2 — not yet completed

Existing scripts that independently mutate `public/index.html` still need to be migrated. Until Phase 2 is finished, they are compatibility writers and must not be treated as canonical sources.

Known examples include:

```text
scripts/generate_prediction_version_ui.js
scripts/update_public_index_oversold_rebound_dashboard.js
scripts/update_public_index_etf_market_regime_analysis.js
scripts/add_three_day_breakout_report_to_index.js
```

Phase 2 should remove their direct homepage mutation responsibility and route homepage updates through `scripts/generate_public_index.js`.

## Phase 3 — planned

Deployment/CI should run:

```text
node scripts/generate_public_index.js --check
node scripts/validate_public_pages.js
```

before Pages publication. Later validation may also report unregistered `public/*.html` files, but it must distinguish intentional detail/debug/embedded/legacy pages from homepage-visible pages rather than automatically publishing every HTML file.

## Rule for new public homepage entries

During and after migration, new homepage-visible pages should be registered in:

```text
config/public-page-registry.json
```

Do not add another independent homepage registry or generator.
