# MVP10-A — BFI82U date-contradiction fail-closed guard

Date: 2026-11-02 (Asia/Taipei). Project `daily-gainers-market-opening-end-to-end`; Goal `goal-v3/MVP-10DAY-v1`. This is a **research-only checkpoint**, not an editorial or media release.

## What changed and why
- `scripts/research_mvp10_fetch_bfi82u_20261013.py` originally checked dated title only. A response with title `115年10月13日` **and** contradictory machine-readable `date: 20261012` could pass if the six monetary rows reconciled. This is a fail-open source identity defect.
- Commit `b6e81c43333bd11e02c1b8e240c04e6bbcc832a2`: when official response contains `date`, require it to equal the 20261013 target (accepting plausible YYYYMMDD and ROC date presentations); continue allowing absent `date` only when the title has the exact required ROC date and original data checks pass. Preserve source response SHA, HTTP metadata and research-only gates.
- Commit `2a98214e0edc3314a42de3ed46d9a423c23ef7bb`: add exact contradictory-machine-date negative case to the existing research-only Python heredoc test. Offline fixture now defines five negative cases (title date, machine date, net arithmetic, missing row, corrupted total). The change was read back using GitHub connector; **the offline fixture and real endpoint have not yet passed an independently observed GitHub CI**.
- Public source-format cross-check: current official BFI82U table gives exactly six investor classifications and columns `單位名稱 / 買進金額 / 賣出金額 / 買賣差額`. Official source https://www.twse.com.tw/fund/BFI82U?response=html&type=day is **a current-date page**, not 20261013 evidence. Separate contemporaneous third-party code examples describe `dayDate=YYYYMMDD&type=day&response=json` syntax; this is URL plausibility only.
- No official 20261013 HTTP raw response, source hash, source-revision history or independent BFI82U CI Run ID has yet been retrieved. Repo has 20261013 market-chart foreign -165290508085 TWD with secondary revision matching -1652.91 億, but **institutional totals remain NOT_CERTIFIED**.
- GitHub Connector `fetch_commit_workflow_runs` is PR-run-only and `get_commit_combined_status` does not enumerate GitHub Actions checks. Empty results are **not** proof push CI did not execute. Do not invent Run ID or label PASS.
- Network in standalone working container could not resolve TWSE domain; GitHub isolated runner is still expected verification environment, not an excuse to infer source values.

## Immutable boundaries and next action
Keep sole owner-approved `TAIWAN_STOCK_TABLE_LIST_20261102_V1` dashboard, previously verified video research run `41463609661`, prior MI_INDEX research run `41468872124`, and frozen MVP10-A/B criteria. No main, cron, Pages, YouTube, secrets or publishing-lock changes.
Next Prompt A: obtain the actual BFI82U workflow run/job/log and dated JSON evidence from https://github.com/EasonLiu0913/stock_data/actions/workflows/research-mvp10-bfi82u-original-evidence.yml ; if unavailable do not repeat same source speculation or false CI success. If exact original bytes are available, validate title/date/rows/buy-sell/net sums and write a dated SHA+HTTP receipt before updating Market Opening Master.
research_progress_status: PROGRESS (bounded date identity fix + negative CI test)
phase_status: MVP10-A INCOMPLETE
b_status: NOT_ELIGIBLE
blocker: no independently verified 20261013 original BFI82U response, CI run, or three-entity monetary rows
plan_changed: NO
publication_authorized: false
upload_authorized: false
