# MVP10-A | Exact committed 1080p source-gated render entrypoint execution — 2026-10-31

## Goal and immutable bounds

Active `daily-gainers-market-opening-end-to-end`, goal `goal-v3/MVP-10DAY-v1`; Prompt A research `PROGRESS`, Phase A **INCOMPLETE**, B **NOT_ELIGIBLE**, `plan_changed=NO`. Owner has confirmed the original full fourth-line spoken phrase and accepted the earlier isolated visual preview overall, not official full A/B, mouth shape or YouTube caption QA. The word-by-word clipping study is intentionally stopped per owner instruction.

Prior source-only frozen GitHub Actions CI: **Run #41197655187, Job #124526973513, 10/10 PASS**, using pinned true historical `20261008` and `20261013` artifacts. That workflow **does not** test the additional 1080p render entrypoint; preserve the distinction.

## Closed prior gap: exact GitHub committed render entry has now been executed

Fetched GitHub research branch and reconstructed each of the three source files **byte-exact**, checking Git Blob SHA-1 hashes:

- `scripts/research_render_pinned_scene1_1080p.py`: Git blob **`020251234f4acd735ff31fe87c654b6abc87b797`**, exact GitHub script from research commit `73e4ad07a2fa045d569707d80e958964d8759e24`.
- `scripts/research_build_pinned_scene1_fixture.py`: **`7fbed7d400a0b829eff9619640a024b46f58234e`**.
- `scripts/research_verify_20261008_scene1_source.py`: **`698dfb8f62732781775562d4fbdc84f9015630fb`**.

Executed **the exact committed render entry**, not an equivalent script, using the two previously verified historical ZIPs and frozen audited 14-cue SRT:

```bash
python scripts/research_render_pinned_scene1_1080p.py \
  --old-zip pinned-12953454424.zip \
  --v4-zip pinned-13036325288.zip \
  --audited-srt 20261008_scene1_V4_RESEARCH_ONLY.srt \
  --output-dir NEW_EMPTY_RESEARCH_DIRECTORY
```

**EXECUTION PASS**. The new exact entry produced first-scene MP4 SHA-256 **`5004507086ee002c897744af0c607de7719d8878026e78c8901655e423479939`**, *byte-identical* to the earlier independently generated 1080p safe-band research preview. Original audited SRT SHA-256 **`adf0c086bc5c73cf0a3cb9604adad90c2112264381f5b3517dcbba919cfb9024`** unchanged and separate. Reconstructed PCM SHA-256 **`fc5598fcb5a4def1a3a0f1bf5d17609c12a7f065589c27109e8d50ce3ce06bc7`** unchanged. MP4 ffprobe: **1920×1080, 1045 frames, 24 fps, video 43.541667s, audio 43.562s**, 20.333ms difference (less than one frame). Real caption video is NOT burned in. Local execution result `/mnt/data/mvp10_exact_entry_run/verified_entry_stdout.json`; durable isolated receipt `20261008_exact_entry_1080p_verification_receipt.json` SHA-256 **`fc3c723dbaf4070df07cd752956a601957528a3ff98cac790423028d66f651d6`**.

Additionally executed **4/4 LOCAL safety tests** against exact committed entry including verified rendered output, modified source ZIP rejection, modified source SRT rejection and nonempty output destination rejection. No remote GitHub CI for render entry has been triggered; distinguish `local_exact_committed_entrypoint=PASS` from `render_entrypoint_remote_CI=NOT_RUN`. No reason to repeat the previously successful source-only 10-case CI.

## Honest visual/brand and formal acceptance caveats

- During the inserted 1.850s V4 phrase, the presenter is a held source video frame. Full sentence speech is owner accepted; **presenter lip motion is not formally accepted**. Exact phonetic alignment is not required by owner's latest decision.
- The working comparison uses an opaque matte at y=928..1080 to reserve subtitle space and **hides original historical footer** `TAIWANSTOCK｜每日5%強勢股研究`. Therefore `footer_branding_preserved=false` as a production grade acceptance. The original static `總長 05:44` overlay also belongs to the historical 9-scene video and must not be mistaken for a newly dynamically computed 43s research preview progress.
- The two-line **display candidate** SRT has different SHA from the original frozen audited source because of inserted line breaks; original 14 cue timing/text preserved, but actual YouTube CC player placement and formatting remain **NOT TESTED**. A controlled FFmpeg subtitle simulation using Fontsize=18/MarginV=8 is not equivalent to YouTube playback.
- Current official `scripts/render_daily_gainers_video.js` remains untouched and does not import the source adapter. This script is isolated and cannot publish. New render script does not create nine-scene video, official 5–10 min QA or YouTube upload.
- No edits to `main`, production runner, existing official SRT builder, official schedules, credentials, release locks, Prompt B; none have been authorized.

## Correct next minimal research step

The precise new entrypoint execution gap is closed and shouldn't be retested without a real defect. The next highest-value technical work is one **non-destructive branded footer + CC safe-zone layout proposal** for the actual 1920×1080 progress bar and VTuber, preserving branding rather than masking required footer text. Validate at least three real video frames with first-line/long-two-line/late captions, and decide whether the official slide/overlay typography needs a small research-only branch patch. If this proposal is not part of frozen A acceptance, register it as a minimal owner-reviewed change proposal, never silently change paired A/B. Then proceed to meaningful isolated full-scene integration as allowed by original goal; do not restart word-edge, repetitive receipts, or reprocess identical source artifacts.

Status `research_only=true`, `publishable=false`, `MVP10-A=INCOMPLETE`, `MVP10-B=NOT_ELIGIBLE`, `plan_changed=NO`.
