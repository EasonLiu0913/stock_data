# M5-R — Multi-model acoustic evidence research contract v1

Status: PENDING / manual research only. Parent: M5 Handoff LF (current handoff appended after this preregistration). Active project remains daily 5% video M5; M5-R is an isolated study, not a production route.

## Authentic upstream and immutable boundaries
- Original artifact ID: 11697447563; ZIP SHA256: b29ab56784279c000a73e5174736c9d3d4eea7f2b330ce7d69f1919cdaee7a2a.
- Scene 01 original MP3 SHA256: a84daf97cb8036d78d942d734fb0b9b4d0b0e7c45164d48d5bdb57e50c6f26aa.
- Seven original MP3s, aggregate 79.416 seconds; opening exactly: 大家好，歡迎來到 TAIWAN STOCK！
- Existing LF acoustic report has only 29 nonlexical RMS windows for 2.880s scene 01, not English words or time boundaries.
- Permanent until separately justified: pronunciation_approved=false; forced_alignment_executed=false; acoustic_sentence_boundary_verified=false; publication_authorized=false. Genuine internal acoustic sentence boundaries 0/15.
- No TTS reruns, Prompt B, formal MFA align, MP4, YouTube, production, cron, Pages, release unlock or source rewrite.

## Source-code selection snapshot, checked 2026-10-11
Stars are a mutable discovery indicator, NOT acceptance evidence. Pin exact source commits instead of following HEAD:
| Official repo | Source commit | Stars at review | GitHub repository license | Research use |
|---|---|---:|---|---|
| modelscope/FunASR | e7e61293d308f4342ab9307895e710e4b51b949c | 20642 | MIT | First ASR evidence |
| SYSTRAN/faster-whisper | a52b026ac844c02117865e61968547639b60a6f8 | 25810 | MIT | Independent ASR evidence |
| QwenLM/Qwen3-ASR | 7c6daf77a2421100f5fb066495372c00129d39ff | 3677 | Apache-2.0 | ASR and separate ForcedAligner compatibility research |
| snakers4/silero-vad | 1e261b036686cd0017d500ee96acd1c4ba572a9d | 10403 | MIT | Speech-activity candidates, never words |

Sources: GitHub API repository metadata and /commits?per_page=1 queries on review date; official READMEs and LICENSEs must additionally be frozen when implementation is authorized. Model card/weights license, exact model revision, file SHA256, dependency and CPU/GPU requirements, input rate, bilingual/code-switch behavior, and redistribution must each be documented per selected model separately. In particular repository LICENSE must not be silently propagated to weights.

## Explicit study gates
M5-R0 INVENTORY: document each official repo commit, package version, model ID and immutable weight revision, weight/model-card license, required resources, Chinese-English mixed-speech claims and CI runtime fit. Unknown license or resource requirement is BLOCKED, not PASS.
M5-R1 OPTIONAL original scene-one read-only ASR: only after individual model approvals and verified source MP3 SHA256; each run isolated, research-only and manual. Capture command, pinned dependency lock, model weights SHA256/revision, audio SHA256, decoded audio method, environment, stdout/stderr, raw outputs/uncertainty and tool/model metadata. ASR output NEVER replaces fixed source text. Cross-model agreement NEVER proves auditory reading.
M5-R2 OPTIONAL independent transcript review: source-ground human listening record, actual realization for TAIWAN/STOCK and uncertainty, reviewers and observed time intervals if defensible. Record unknown as null; source literal TAIWAN STOCK is not itself listening evidence.
M5-R3 OPTIONAL alignment: requires separately authorized research-only gate, exact verified spoken transcript, audio/phone/model compatibility and time interval provenance; do not execute now. Silero VAD is speech activity only, never word or subtitle-boundary evidence.
M5-R4 sentence boundary acceptance: each of the 15 existing boundaries gets its own supporting acoustic observation and independent review, with VERIFIED/PENDING/REJECTED and evidence references; default all PENDING/0 verified.

## CI / design safeguards
Separate workflow_dispatch only, no schedule and no workflow_call/production dependency; least-privilege contents:read, actions:read. Do not automatically pull gigabyte models into stock_data CI or silently execute ASR. Prefer initial CPU-only license/requirements audit and prerequisite checks; isolated inference only after approved pinned model cards and reasonable runner budget (Qwen aligner/large models may require GPU, GitHub hosted ubuntu-latest GPU not assumed). Retain source and outputs as PRIVATE research artifacts with short retention. Fail closed on any source/hash/approval discrepancy. Publish only report of model selection, never unlock video.

Research status PROGRESS for inventory; no multi-model inference, independent English spoken identification or genuine alignment performed by this preregistration.
