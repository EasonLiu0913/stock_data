# M5-R2 — Candidate weight provenance audit (research-only, 2026-10-11)

Parent main snapshot: b34c4beae1f09ed107b2ebe717a47fc3709c3751. This document records external source observations, not runtime approval, not edits to the machine-readable inventory, and not acoustic evidence. The initial manual static contract Run 38144039746 / artifact 11703843344 passed, with ZIP SHA256 48f0dc1db42dea0c37ed9793563d41c63b71d7ec7b4ec296e1c803f175546536.

## Additional candidate discoveries
1. Qwen/Qwen3-ASR-0.6B: Hugging Face model file https://huggingface.co/Qwen/Qwen3-ASR-0.6B/blob/main/model.safetensors lists 1,876,091,704 bytes and LFS SHA256 79d6cbd4c98c7bbffe9db2edac07f56cd6637d0d5944b27f6c2b8353840323ea. Model listing declares Apache-2.0; config lists Chinese and English. These are upstream metadata observations, not downloaded-byte verification, pinned snapshot revision or mixed-language acoustic test.
2. Qwen/Qwen3-ForcedAligner-0.6B: https://huggingface.co/Qwen/Qwen3-ForcedAligner-0.6B/blob/main/model.safetensors lists ~1.84 GB and SHA256 47831d0e82f96b20e9034dba01a075ee06436654719f6a68289e49f1b65ce0e7. Listing declares Apache-2.0; config lists Chinese and English. Formal or research alignment remains separately gated and unauthorized.
3. Systran/faster-whisper-small: https://huggingface.co/Systran/faster-whisper-small declares MIT, converted openai/whisper-small FP16 weights and a CTranslate2 example. Specific immutable revision, complete file digests, CPU memory and actual Chinese-English code switch performance not yet accepted.
4. FunASR: https://github.com/modelscope/FunASR explicitly separates MIT toolkit source from pretrained model licenses. No specific model identity, revision, weights terms or digest approved.
5. Silero VAD: speech activity only; can never establish English pronunciation, lexical transcript or actual subtitle sentence boundaries.

## Acceptance deltas and next bounded research
- Freeze immutable Hugging Face commit/revision for each candidate AND per-file digest, model card/license text at that revision. Current main links are mutable discovery references.
- Validate exact selected weight license independent of repository code license, usage restrictions and redistribution requirements.
- Estimate dependencies, model memory, disk download, CPU runtime and CI runner constraints. GitHub-hosted CPU cannot be presumed suitable for Qwen runtime.
- Only then design separate manually approved, isolated scene-01 read-only ASR feasibility gate; preserve scene01 SHA256 a84daf97cb8036d78d942d734fb0b9b4d0b0e7c45164d48d5bdb57e50c6f26aa and original ZIP SHA256 b29ab56784279c000a73e5174736c9d3d4eea7f2b330ce7d69f1919cdaee7a2a.
- Do not elevate upstream declarations to local binary verification, model approval, pronunciation approval or acoustic sentence boundary verification.

Status: research_progress_status PROGRESS; Prompt A INCOMPLETE; Prompt B NOT ELIGIBLE. model_inference_authorized=false; pronunciation_approved=false; forced_alignment_executed=false; acoustic_sentence_boundary_verified=false (0/15); publication_authorized=false. Original seven MP3 aggregate 79.416 seconds and fixed opening unchanged. No TTS, formal alignment, MP4, YouTube, production, cron, Pages or release unlock.
