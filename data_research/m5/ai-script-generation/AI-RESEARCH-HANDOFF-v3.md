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
