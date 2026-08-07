# Prediction Pipeline Architecture

## Purpose

This document defines the intended direction of data flow through the production pipeline.

```text
Data Collection
  -> Normalization
  -> Prediction
  -> Replay / Validation
  -> Dashboard
  -> Deployment
```

Dependencies should move forward through this flow and should not create reverse or cyclic dependencies.

## Data collection

Crawler workflows obtain source data such as TWSE, MOPS, institutional investors, broker details, margin data, ETF data, external markets, and market indicators.

Crawler workflows should not contain unrelated prediction or deployment responsibilities.

## Normalization

Normalization converts source-specific formats into stable schemas used downstream.

Normalized outputs should be reproducible and should not depend on dashboards or Pages deployment.

## Prediction

Prediction reads validated source/normalized data and produces versioned prediction artifacts and UI data.

Production strategy definitions must remain stable and versioned. Research findings must not silently alter them.

## Replay

Replay evaluates historical predictions against subsequently available outcomes.

Replay may read predictions and historical results but must not rewrite the original prediction decision.

## Dashboard

Dashboards render already-produced data. They should not become hidden research engines or recompute large historical studies in the browser.

## Deployment

Deployment publishes verified site artifacts. It must not regenerate prediction, replay, or research data.

The canonical reusable Pages workflow is `.github/workflows/deploy-pages.yml`.

## Daily prediction chain

The repository-level required chain is documented in `AGENTS.md` and currently follows:

```text
generate_v1
  -> generate_v2
  -> apply_strategy_registry
  -> deploy_pages
```

## Daily replay chain

```text
replay_and_compare
  -> deploy_pages
```

## Research isolation

Research workflows may use historical market data and produce research summaries/dashboards, but research is not allowed to mutate daily strategy definitions merely because a factor performs well.

## Failure boundaries

A downstream stage must not run when its required upstream output is invalid.

Long-running historical jobs should prefer checkpoint/resume and incremental rebuild patterns so a late failure does not invalidate all completed work.
