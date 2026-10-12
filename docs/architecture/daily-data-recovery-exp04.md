# Experiment 04 — video-only data contracts and indirect-trigger firewall

Status: ISOLATED RESEARCH / no production promotion. Latest inspected main tree SHA b86fa8fc018a7717990fa8539a09c74a439bdd8a; recursive tree response truncated, so not a complete global listener audit.

## Direct video script validator inputs (main)
`scripts/validate_daily_gainers_video_script.js` reads date-scoped `data_daily_gain_over_5/<date>.json`, `analysis-ai/<date>.json`, `market-summary/<date>.json`, and `video_scripts/daily-gainers/<date>.json`. Upstream provenance includes Facts, News and Unified but these should not be mistaken for direct reads. Video script is an existing authored input, not a recovery crawler output. Validate each source's expected date, schema, nonempty validity, provenance and relevant source publication cadence independently.

## Observed workflow mapping and side effects (not executable recovery allowlist)
- `.github/workflows/daily-gainers-over-5.yml`: `scripts/generate_daily_gainers_over_5.js`, market-summary builder/validator; contains deploy job. Must extract and test source-only list generation, not call whole workflow.
- `.github/workflows/publish-daily-gainers-ai-analysis.yml`: `scripts/build_daily_gainers_ai_facts.js`, AI contract/validation and unified/summary publishing; contains deploy-pages job. Facts producer may be extracted only after inputs are audited; AI needs independently authorized generation and validation.
- `.github/workflows/publish-daily-gainers-news-summary.yml`: responds to `analysis-news/*.json` push, canonicalizes news, rebuilds summary and deploys. Not a source-news crawler.
- `.github/workflows/publish-daily-gainers-unified-analysis.yml`: responds to `analysis-ai/*.json` push, publishes unified and summary, deploys. Not a side-effect-free source producer.
- `.github/workflows/daily-gainers-video-upload-orchestrator.yml`: responds to `video_scripts/daily-gainers/*.json` push and may initiate render/upload; strictly excluded.

## Explicit firewall
A future dedicated Data-Only Recovery must not copy or invoke the above publishing workflows as whole units, must never modify video_scripts, must not contain deployment, dispatch, workflow_run, upload, Pages or YouTube steps, and must not push output into main until an exhaustive listener/path audit is complete. A push of analysis-news, analysis-ai, or video_scripts on main is NOT side-effect-isolated. The dedicated writer must validate expected trading/source dates, skip already-complete and in-progress work, stage an explicit allowlist of missing output paths, fail closed if extra changes are present, and verify exact post-write content. Existing push listeners are not fully inventoried because main's recursive tree was truncated. No runtime use of synthetic data as real market evidence.

## Experiment 04 isolated CI acceptance
A read-only, research-branch-only test compares a frozen source-to-side-effect inventory against known main workflow text and validator inputs; enforces no publishing tokens in a proposed safe data-only contract; verifies that hazardous push path examples are rejected and data-only candidate paths remain review-blocked until global audit. This is architecture/contract CI, not production readiness. Require a matching GitHub run/head SHA, successful job and `EXPERIMENT_04_FIREWALL_PASS` log marker before PASS.
