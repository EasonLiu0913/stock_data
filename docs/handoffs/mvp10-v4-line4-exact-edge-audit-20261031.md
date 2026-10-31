# MVP10-A | Exact source WordBoundary review and acoustic ambiguity (2026-10-31)

**Result: ORIGINAL FOUR EVENT AUDIO BYTES REVERIFIED; TRUE PHONETIC WORD ALIGNMENT PENDING.** The owner's independent whole-original-phrase hearing **PASS** for the exact wording `那麼我們開始囉。` remains in force, with source voice `zh-TW-YunJheNeural` +15%; do not extrapolate that human observation to individual event start/end precision.

## Real source and isolated audio verification

- Original source: successful prior `20261013` Run `41182709089`, Artifact `13036325288`, MP4 SHA-256 `47b27163fc74289373eedaf311897b44b651af83430018a0b2f07be1b6d9a474`; source fourth-line 1.850s PCM WAV SHA-256 `059f9403f614b7c83ecffdf625c3a18adaee21af66cf1f4f394dd0c079d71a40`, mono 24kHz 16-bit/44,400 samples.
- Re-extracted four **un-padded** WAV windows directly from the exact source PCM using the original source `offset` and `duration` (rebase by 7.6 seconds; nearest 24kHz sample). All four output WAVs are **byte-for-byte identical** to the existing earlier original `v4_line4_word_event_0[1-4]_REVIEW_ONLY.wav` audio in `v4_line4_word_boundary_listening_pack_20261031.zip`; newly generated files are only re-packaged for unambiguous hearing, **not** adjusted speech or timestamps:
  - Event `那麼`: 0.330416–0.613041s, WAV SHA `a4a268703f03274b8799700127de46f9cf1a1610ebaff00d764b66fdb348151e`.
  - Event `我們`: 0.613041–0.808707s, WAV SHA `2ba41bef760b673fd12fb3fa4a6c7d5fffe897d3811047096720ccf93101a5d0`.
  - Event `開始`: 0.808708–1.080416s, WAV SHA `759962ca9b2c7849b3dd682638080e87c780c5faaad032c3a4529eb37463a150`.
  - Event `囉`: 1.080416–1.439124s, WAV SHA `732fdff76dabd9ee16eda5765243bc2d9e5af2577a719fc4426424ec2263ce1d`.
- New isolated ZIP `v4_line4_four_exact_edge_windows_REVIEW_ONLY.zip` SHA-256 `cedec61786e40d8780e6c947bb3983039f1eeba51c664f6b161ae53f5d951a98`; each file's name denotes **original metadata label**, not independently confirmed words. Same source owner-confirmed original 1.850s WAV remains unchanged. No media uploaded to GitHub or production.

## Distinct independent acoustic signal review

Applied an isolated 20ms RMS analysis at 5ms hop to actual source waveform and compared the **minimum-energy point within ±60ms** of each original reported inter-word boundary (not forced word alignment):
| Nominal boundary | Original reported t | Nearby minimum t | Minimum minus event | Evidence class |
| --- | ---: | ---: | ---: | --- |
| `那麼／我們` | 0.613041s | 0.580s | -33ms | ENERGY HINT ONLY |
| `我們／開始` | 0.808707s | 0.790s | -19ms | ENERGY HINT ONLY |
| `開始／囉` | 1.080416s | 1.105s | +25ms | ENERGY HINT ONLY |

At the first boundary, high-amplitude continuous energy across the Edge event means there is no clear silent seam; this is normal with coarticulated Mandarin and cannot be adjudicated by local RMS troughs. The ±60ms search window and 20ms/5ms energy analysis **cannot label actual phonemes**. It must **not** be used to automatically shift Edge offsets by -33/-19/+25ms or call a 33ms timing failure/success.

### Independent human evidence status

- Owner has listened to the **complete original** and explicitly confirmed `有，清楚完整讀出「那麼我們開始囉。」`. **Whole-line lexical verification: OWNER_CONFIRMED_PASS.**
- Previous 120ms-context clips were heard with extra overlapping words; this is consistent with their deliberate extra audio. They do **not** certify original unpadded event boundaries.
- Four exact original unpadded event clips now ready for actual independent review. The clip-by-clip heard words / syllable truncation and proper phonetic word boundary placement have **not yet been supplied by independent listening**. **Keep `per_word_acoustic_alignment=PENDING`** rather than pretending the energy minimum identifies a word boundary.
- Next action must request actual review evidence for the unpadded clips; only then is it legitimate to determine whether any retiming is needed and whether isolated scene-1 picture QA can be authorized. No speculative TTS regeneration or full video rendering.

## Reproducibility

- Isolated script `verify_unpadded_word_boundaries_20261031.py`, local file only; input SHA exact, source event label and tick validation, independent byte-equality to prior clips, 24kHz sample boundaries and nearby 20ms-energy observations.
- Machine-readable local `v4_line4_exact_edge_acoustic_research_20261031.json` SHA-256 `4fb8c3f7f6e99a530570f93c9aa5a1bc363ca394f758c13bdca35b313f34005b`.
- No new GitHub Actions CI. No modifications to `main`, production subtitle builder, video renderer, YouTube, schedules or publication locks.
- Status: research `PROGRESS`, MVP10-A `INCOMPLETE`, MVP10-B `NOT_ELIGIBLE`, `plan_changed=NO`.
