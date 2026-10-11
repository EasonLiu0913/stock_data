# M5 bulk execution decision and acceptance (isolated research only)

## Outcome targeted, not model-completion-driven
Generate a full-text, natural-sentence **private candidate** SRT from the fixed seven original MP3s in one research CI run; preserve the original opening and total 79.416 seconds. A candidate must not be described as real acoustic synchronization.

## Existing evidence and local complete-batch proof
Original artifact `11697447563`, SHA-256 `b29ab56784279c000a73e5174736c9d3d4eea7f2b330ce7d69f1919cdaee7a2a`, contains source.json and audio/01..07.mp3. On 2026-10-11, downloaded and rehashed original ZIP and each of seven MP3 against audio/audio-proof.json. The scene durations sum to 79.416. Local offline proof completed against these original bytes: punctuation-delimited natural complete sentences (not commas), 14 subtitle blocks, all speech/caption/display strings equal, concatenated subtitle text exactly equals source, fixed `大家好，歡迎來到 TAIWAN STOCK！` in one opening block. Original audio remains untouched. Timing inside multi-sentence scenes is 20ms RMS-energy valley near a text-length prior and is a **candidate hypothesis**, never a real audited acoustic sentence boundary. Still 0/15 verified boundaries, release BLOCKED. No TTS or model inference.

## Approaches compared
- Source-only sentence segmentation + fixed original per-scene MP3 durations: deterministic, low resource, proves full text and scene edges, NOT inner sentence acoustic match.
- Original-audio RMS local minima: identifies lower-energy interval candidates without ASR or model downloads; silence can arise within words, speech can cross boundaries; no word recognition, NOT source-realization or proper alignment proof. Selected for private candidate and manual inspection only.
- ASR and separately gated forced aligner: may support future realized pronunciation and word/sentence alignment, but five model checkpoint licenses, inference authorization and actual resource fit have not cleared. Do NOT silently install or run. VAD alone is nonlexical and cannot validate sentence text.
- Character-proportional SRT only: rejected as evidence of real speech sync.

## One-shot integration
`scripts/m5_bulk_private_candidate.py`: accepts exact pinned original artifact ZIP or downloads it by ID with bounded 6MB GitHub actions:read; checks full ZIP SHA-256, seven MP3 SHA-256 and 7 matched speech/caption/display scene texts, generates `candidate.srt` and `proof.json` with explicit blocked flags and 0/15. Existing manual branch-only research workflow runs previous source/license static evidence together with full candidate pass, retries temporary candidate-stage failures at most three times and uploads separate private proof Artifact. No schedule or production trigger, no YouTube or Pages. A successful candidate step is not formal acoustic, media, or publication PASS.

## Remaining gate
To certify real synchronicity requires authorized pronunciation review, independent audible sentence-boundary evidence per required interval (not RMS heuristic, not mere text-length allocation), resource and model-specific rights checks for any inference, and a separately agreed release decision. Preserve all six false locks. Do not promote Prompt B merely because private SRT exists.
