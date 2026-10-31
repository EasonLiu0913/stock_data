# MVP10-A real 20261008 ordinary-share gate — 2026-10-31

## Goal and scope
Project daily-gainers-market-opening-end-to-end; goal goal-v3/MVP-10DAY-v1. Research-only Prompt A; original A/B frozen. Owner requires truly date-scoped TWSE ordinary common stocks >=5%, four V4 lines, no obsolete on-screen/spoken CC reminder, YunJhe +15%, external zh-TW SRT and eventually complete 1080p private pilot only after separate explicit authorization. No main, official production, YouTube or publishing modifications.

## Verified dated issue
- Historical actual data_daily_gain_over_5/20261008.json: Git blob c61751d61cd4179f985e96a19a8c558cc3ef34e9; 35 stocks, includes code 9103 name 美德醫療-DR, +9.91%. DR depositary receipts are outside ordinary common-share scope.
- Historical analysis-ai/20261008.json blob 0fef928797b707be454ac91c2e592a003d4e0860 and market-summary/20261008.json blob 4f83522db0542f94e0ba792a7e2cea4d12ff7b90 still reflect the old 35-stock source. The summary says final / complete, but this does not override the newer prospective ordinary-only requirement.
- Legacy video_scripts/daily-gainers/20261008.json blob e7ab8463b888bf4d5ca5c90c90fe346597648885 references 9103 in scene 2 and scene 3 and contains a historically questionable scene title 南染與防疫概念. Current historical v2 Master is not automatically a conforming current 9-scene V4 source.
- Other suffixes such as -KY and -創 are NOT automatically DR; their actual date-bound classification must be verified. Excluding DR does NOT certify that remaining 34 records are all valid ordinary common shares. Do not change 35 to 34 without consistent upstream source and editorial recalculation.

## Implemented research-only fail-closed gates
- scripts/daily_gainers_mvp10_ordinary_scope_gate.js commit 0894cfbb0c65bb2a3968c3bf12ca54785e999b39: specifically rejects unambiguous -DR names and prints affected scenes and mandatory upstream regeneration, no silent filtering or positive classification guess.
- Integrated into actual research script validator in commit 7d19d7a7d05d7ed7aa296cddc87d32f0fa698479.
- Integrated into actual research video plan/slide producer in commit 26c8ad5d9e51b8ce60e562777fe17ece60095ec6, BEFORE plan or slides are created.
- Four negative/scope unit tests commit fdb80d2a8e17fad3ffdd77ee1a64437f68756e40.

## Real remote CI evidence
- Research-only read-only GitHub Workflow .github/workflows/research-mvp10-real-date-ordinary-gate.yml commit d56572e553de6b0ff6387b44835ccb52277987fd. Only contents:read. No TTS, rendering, upload or production changes.
- Actual Run https://github.com/EasonLiu0913/stock_data/actions/runs/41214274079 Job 124575423416 completed SUCCESS. Independently fetched entire GitHub job log. 4/4 unit tests PASS, 0 failures. The real historical 20261008 script validator and actual producer both **correctly rejected** 9103 美德醫療-DR; confirmed referenced scenes 2,3 and no output/daily-gainers-video/20261008/plan.json file was generated.
- IMPORTANT: successful CI proves correct fail-closed behavior; it does NOT mean the old dataset is repaired or a full video is ready.

## Next bounded A
Find existing reliable TWSE date-bound ordinary-stock evidence and create a versioned prospective ordinary-stock candidate from immutable original records, retaining source lineage. Audit all source identities rather than assuming 34 correct. Recompute raw, summary, AI/script claims and any dependent media only if semantics change, re-check four V4 lines and no obsolete CC, YunJhe +15%, external SRT, full-duration progress and all frozen gates. Produce a full isolated no-upload video only after this correct source chain, and never dispatch legacy main production upload Workflows.

Status: research PROGRESS, MVP10-A INCOMPLETE, B NOT_ELIGIBLE, plan_changed NO. Main, production schedules, YouTube and release locks unchanged.
