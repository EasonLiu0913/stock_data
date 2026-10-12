# Daily Data Recovery v2 — Experiment 05 (research-only)

Status: IN PROGRESS / NOT PROMOTED. Main reference b86fa8fc018a7717990fa8539a09c74a439bdd8a; Experiment 04 verified run 38302869548 (firewall contract only). Research branch research/daily-data-recovery-v2-exp01-20261013.

## Scope and evidence

The GitHub Contents directory listing of .github/workflows at the above main ref returned 232 YAML files; the older recursive Git tree was truncated and is not exhaustive evidence. The Experiment 05 Node24 script inventories every available local workflow YAML, records push/workflow_run/repository_dispatch/workflow_dispatch event declarations, filters, data path references, publication risk and local reusable callers. CI produces tmp/research/experiment05-matrix.json as an artifact. This is a syntactic inventory, not a proof of every indirect behavior; exact filter matching, called scripts and transitive effects require separate verification.

Script: scripts/research/experiment05_listener_audit.js; workflow: .github/workflows/research-daily-recovery-exp05.yml. Registration commit 3001e7bc0d685ecea1db1ba303781bcd4e854ed8; independent push probe a6ae8d1d5f695d3b6283fb8a449d7d699d01076a. CI independent run: https://github.com/EasonLiu0913/stock_data/actions/runs/38303712124. At initial inspection in_progress; do not mark PASS without terminal success, marker and artifact review.

## Authorization boundaries

Read-only contents permission. No production crawler, workflow_dispatch, repository write, cron, Pages, YouTube, video render, Prompt B, or publication lock change. Write allowlist EMPTY and policy DENY ALL until manual exact path/event/filter and transitive job/script audit. Four negative checks deny list/AI/video paths and empty inputs. This does not yet satisfy owner-requested real source recovery or validated safe-path allowlist. Synthetic test is not equivalent to real collection.

## Handoff v3

Active project Daily 5% Data Recovery; phase Experiment 05; A status IN PROGRESS; B status INELIGIBLE; research progress PROGRESS evidenced by new read-only audit code, CI workflow and actual independent push run. Current blocker: CI terminal proof pending and complete transitive listener/source-to-output validation missing. Planned research: inspect run 38303712124 and artifact, check all high-risk actual YAML filters and called jobs/scripts; preregister allowlist with negative path cases; use only temporary-root real producer on synthetic inputs until source and safety evidence permits otherwise. Prior attempt: Experiment 04 tested only five high-risk contracts, explicitly left global audit open. Anti-loop: do not rerun identical audit absent new failed log or inventory change; pivot to exact transitive chain review after CI evidence. Next action: inspect CI and artifact; do not promote to main.
