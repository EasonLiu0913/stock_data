# AI Research Handoff v3

The scheduled ChatGPT AI authors the daily stock-video analysis. Programs supply verified dated market and featured-stock evidence, then validate the AI-authored result. Deterministic sentence templates are not the final writer.

Input: target date, complete Research Master SHA-256, official market breadth with scope, turnover and previous-five-day comparison, three independently reconciled institutional groups, selected >=5% quotes, dated Facts and News, provenance and unknowns.

Output: version, target date, input hash, selected stocks, claim IDs with original source IDs and epistemic classification (verified event, association, hypothesis, unknown), original Traditional Chinese narration, matching captions, and information-card claim IDs. Preserve the fixed three brand lines and CC reminder. Actual opening duration is measured from rendered audio, not guessed by AI.

Validation rejects mismatched date/hash, unsupported claims, invalid source pointers, contradictory figures, missing market fields, stale V1 narration, three-surface drift and any publication authorization. Incomplete optional evidence is omitted or marked unknown. AI revises its own draft; validator must not compose substitute narration.

Research-only checkpoint. No live schedule, production, upload, publication, TTS, SRT, MP4 or Prompt B is activated by this document.

## A3 real input CI checkpoint — 2026-10-15
- Verified research branch commit: `e0d274edad1bf977215325516ceacd1229ff72ea`.
- Full isolated workflow Run: https://github.com/EasonLiu0913/stock_data/actions/runs/38757561678 ; Job `116499912540`; both SUCCESS.
- Job log confirms `AI_SCRIPT_V3_CONTRACT_NEGATIVE_TEST_PASS`, `AI_EDITOR_INPUT_V3_CONTRACT_PASS`, `AI_EDITOR_INPUT_V3_REAL_20261008_PASS candidates=6`; dedicated real-input and `sha256sum -c /tmp/video-recovery-proof/SHA256SUMS` step SUCCESS.
- Actual `ai-editor-input-v3.json` file SHA-256: `8a2c42c97f980030c34baa299811ac41d65d4bc0a0f1925eefd3dbce550fd44f`. Artifact `11984236800` (`video-recovery-readonly-proof`) ZIP digest: `sha256:5f2aacc87c671a0ad179c1a0456ddd815518774c9e85ec1921ae61a4b482179c`. ZIP digest and inner file hash are distinct.
- Candidates: `6672`, `2305`, `1301`, `3416`, `9103`, `2428`; upstream references and hypotheses are NOT certified stock-price causation. Market scope is official MI_INDEX 股票 column, not certified historical common-stock roster.
- Earlier shared-test false green diagnosed: separate sparse MI_INDEX workflow logged ENOENT under a tee pipeline; restored independent parser test and moved actual editor input proof to dedicated full-workflow step. Do not cite old green as proof.
- Research verdict PROGRESS; phase A3 input proof PASS, A4 NOT COMPLETE. Current blocker: actual AI-authored original full script with source-level review, real TTS/SRT/MP4 and M8VIS proof not yet produced. Planned research: verify primary source claims and produce original dated AI editorial with explicit epistemic labels, then validate three surfaces and isolated composite. Stop/pivot: fail closed on unverifiable attribution, source drift, or audio/caption mismatch. Prompt B remains FROZEN; no main, production, cron, Pages, YouTube or publication lock change.

## Four-line opening CI checkpoint — 2026-10-15
Owner fixed CC reminder as exactly fourth opening sentence after three brand lines, once only, before market analysis. Validator `scripts/validate_ai_script_research_v3.js` commit `1ceaa8d9257fff86a1a6553bdf350f091260285c`; negative tests `tests/ai_script_research_v3.test.js` commits `737d2f35f3e042c527d2e53f5db904054f8fb370`, `498bd8ebde29d877b85779cdd6cff42cd8034f98`; scoped CI trigger commit `22ca9c921f00dbc0ad2e87508c931c295e1215d9`. Run https://github.com/EasonLiu0913/stock_data/actions/runs/38758911266 Job `116504642774` SUCCESS, `AI_SCRIPT_V3_CONTRACT_NEGATIVE_TEST_PASS`, real editor input and SHA256SUMS PASS. Artifact `11983934817`, ZIP digest `sha256:e4b31cf2341eae1bfde1999120d8aedd440b39522410ae236cfd0a943dd12c7e`. Research PROGRESS, A4 NOT COMPLETE: original full AI-authored script and genuine TTS/SRT/MP4/M8VIS still missing. Prompt B frozen, publication unauthorized.

## CC fourth-line and no-repeat final test checkpoint — 2026-10-15
- Research-only validator and negative test commits: `88b45d0252a819cddce9f55537eddcb8c035d5df`, `4fca324248bdf19316efde1dd4880442278c857b`.
- Both corresponding runs completed SUCCESS: https://github.com/EasonLiu0913/stock_data/actions/runs/38759533206 and https://github.com/EasonLiu0913/stock_data/actions/runs/38759551187 . Latest Job `116506883176` SUCCESS with `AI_SCRIPT_V3_CONTRACT_NEGATIVE_TEST_PASS` and `AI_EDITOR_INPUT_V3_REAL_20261008_PASS candidates=6`; `ai-editor-input-v3.json: OK`. Latest Artifact `11984039313`, ZIP SHA256 `1787046fb3e63e4333705227d9e8548eaf5144c8e1c3f55ce79a1c1e8d5a4e1d`.
- This closes the isolated fourth-line/no-repeat contract test, not A4 or the video. Original featured editorial research commit `31c74a48fc3077e45990d4b6a4410f7ef55bb553` is a prose draft; claim-level verification, semantic spoken/caption number parity and actual TTS/SRT/MP4/M8VIS remain outstanding. Prompt B frozen; publication false. Progress verdict PROGRESS. Next focus is full original script, not repeated CC-rule changes.
