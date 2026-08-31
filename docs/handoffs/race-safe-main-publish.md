# Race-safe main publish

Canonical handoff: `docs/handoffs/race-safe-main-publish.md`

## Current phase

Implementation round 1 preregistered; implementation has not yet been committed.

## Objective

Promote the proven regenerate-after-push-race pattern into one shared repository capability and adopt it first in the TWSE margin-balance workflow that lost a successful 2026-08-31 crawl at push time.

## Frozen decisions / constraints

- Follow `AGENTS.md`, `docs/project-philosophy.md`, `docs/roadmap/current-phase.md`, and `docs/architecture/github-actions.md`.
- Do not extract the older rebase-only retry as the canonical pattern. Evidence from Daily Gainers shows that derived artifacts must be regenerated from current `origin/main` after a push race.
- A TWSE raw crawl must not be repeated merely because `main` advanced. Preserve the already validated raw CSV outside the repository worktree, then republish it during each retry.
- Every retry must start from current `origin/main`, restore the validated raw artifact, regenerate derived artifacts that depend on repository state, validate, stage only exact owned paths, commit, and push.
- Writer workflows remain non-cancelable (`cancel-in-progress: false` when a concurrency group is used).
- Do not perform a repository-wide migration in round 1. First prove the shared capability with Margin and a regression harness.

## Evidence

Repeated real cases establish the abstraction threshold:

- `848a5480f46107b37a721c8ec9df13e67b398e87` — SMA scoped writes + rebase retry.
- `bdac872600bb8f73e3e6ec2089a60811edf442b4` — warrant scoped writes + rebase retry.
- `4bb37eed503903e9e10eec0f8a145f11fb2935e7` — Daily Gainers summary upgraded to reset/regenerate/validate after push races.
- `dd6453e0ec4536661074694c36ab43c5913101ae` — news summary uses the same regenerate-after-race policy.
- `b1c3f0e8a024083894e92499908ae31e83e007d7` and `8d15565df419040c2226fef955b6047ad4de6d17` — same-artifact writers serialized with a shared concurrency group.
- `[01 台股資料] Crawl TWSE Margin Balance #195` successfully generated the 20260831 raw/derived artifacts but lost them because `main` advanced again after a successful rebase and before push.

## Entry points

- `.github/workflows/crawl-twse-margin-balance.yml` — first adopter; currently uses one `git pull --rebase origin main` followed by one push.
- `scripts/refresh_daily_gainers_flow_preserve_cause.js` — rebuilds daily-gainers flow while preserving researched cause analysis.
- `.github/workflows/refresh-daily-gainers-market-summary.yml` — proven regenerate-after-race implementation.
- `.github/workflows/publish-daily-gainers-news-summary.yml` — second proven regenerate-after-race implementation.
- `docs/architecture/github-actions.md` — canonical workflow architecture and write-layer concurrency rules.
- `tests/` — Node `node:test` regression suite invoked by `npm test`.

## Prompt A — Next-round implementation prompt

Implement race-safe main publishing round 1 on current remote `main` only.

1. Re-read `AGENTS.md`, `docs/project-philosophy.md`, `docs/roadmap/current-phase.md`, `docs/architecture/github-actions.md`, and this handoff.
2. Add one shared helper under `scripts/` implementing the proven policy: fetch current `origin/main`; reset to it; run caller-owned prepare/regenerate logic; run validation; stage only explicit paths; no-op if current main already contains equivalent output; commit; push; on push race discard the generated commit and repeat from latest main; bounded retry with jitter/cooldown.
3. Add a Node `node:test` regression harness that creates temporary local Git repositories/remotes and proves that when another writer advances remote main between generation and first push, the helper preserves that competing commit and regenerates the derived artifact from the new main before a later successful push.
4. Modify only `.github/workflows/crawl-twse-margin-balance.yml` as the first production adopter. Preserve a validated crawled CSV outside the repository worktree before entering the helper; retries must restore that snapshot rather than re-crawl TWSE. Regenerate the target-date daily-gainers flow from latest main when the target-date 5% list exists. Stage only the exact target-date raw/derived paths.
5. Update `docs/architecture/github-actions.md` with the new shared policy and exact helper/test paths.
6. Run/obtain syntax and regression evidence. Do not migrate unrelated writers in this round.

Round boundary: helper + regression + Margin adoption + architecture documentation are committed to current main and the relevant CI/regression evidence is available. Then stop for Prompt B closeout.

## Prompt B — Next-round closeout / verification prompt

Verify race-safe main publishing round 1 independently against current remote `main`.

Required checks:

1. Re-read current `AGENTS.md`, `docs/architecture/github-actions.md`, and this handoff; identify the implementation commit(s) for this round.
2. Verify the shared helper starts every attempt from current `origin/main`, never relies on a stale rebase-only derived artifact, retries a bounded number of times, and exits nonzero after exhaustion.
3. Verify its staged paths are explicit and it rejects/does not accidentally include unrelated worktree changes.
4. Run the dedicated regression test and confirm the simulated competing remote commit survives while the final derived artifact is regenerated from the advanced remote state.
5. Inspect `.github/workflows/crawl-twse-margin-balance.yml`: validated raw CSV must be snapshotted outside the worktree; retry must restore that same raw snapshot without another TWSE crawl; derived `analysis-flow/YYYYMMDD.json` must be regenerated from latest main; cause analysis preservation must remain intact; only exact target-date artifacts are staged.
6. Confirm writer cancellation policy still obeys `cancel-in-progress: false` where concurrency is used and downstream Pages deployment runs only after a successful repository publish.
7. Check current main for the 20260831 Margin artifact. If still missing, perform only the bounded recovery needed to publish/re-run it and verify downstream facts readiness; do not broaden to unrelated writer migrations.
8. If any invariant fails, fix only this round and repeat verification. If all pass, update this handoff with durable PASS evidence and preregister the next audit/migration round Prompt A + Prompt B, then stop.
