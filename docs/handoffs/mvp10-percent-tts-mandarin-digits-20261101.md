# MVP10-A — Owner-approved Mandarin-only percentage TTS input (2026-11-01)

## Exact owner correction

Owner explicitly rejected the artificial sound of previous spliced percentage and rejected all English "percent" TTS generation. **Use the literal TTS input text 百分之1.95** (as opposed to raw 1.95%, 百分號, 百分之一點九五 or 1.95 percent). For the concrete financial clause, TTS script is **跌幅百分之1.95**; corresponding *visible* hard-burned caption is **跌幅1.95%**. A consistent percent token should render spoken "百分之" + canonical Arabic numeric literal, and displayed numeric literal + "%". The final pronunciation from Edge TTS must be judged from genuine regenerated YunJhe audio; text-only CI is not an acoustic proof.

## Actual implementation (research branch only)

- In `scripts/daily_gainers_text_variants.js`, percent-token mode='speech' now calls existing numeric validation but emits `百分之${value}` in the spoken track; mode='captions' and display emit `${value}%`. Research commit **571c4dc17e6a4926ee128deba1b22d915b8c95e3**.
- Current `scripts/research_mvp10_prepare_dual_track.js` still forbids literal percent glyph in the actual TTS speech track (commit `399b716420bf0411535a79f2f1fe92abceb7d14d`). No English words are introduced. Exact source token test asserts `跌幅百分之1.95`, `跌幅1.95%`, and absence of `percent`, `百分號` and `%` in TTS source.
- Updated `tests/daily_gainers_text_variants.test.js` and `tests/research_mvp10_prepare_dual_track.test.js` to enforce the literal owner-selected TTS representation while retaining immutable four-line V4 opening. Corrected an older unit test that incorrectly omitted automatic V4 intro from full scene concatenation; original negative source constraints preserved.

## Actual test evidence and explicit prior failure

- Initial real CI Run `41221887463` **FAILED** because the added legacy unit test still expected no V4 opening prefix, not because the percent formatter failed. Test expectations were corrected without weakening V4, committed **cb1f19d0b6c482a6aa55f16e70fec71eaa41b1df**.
- Fresh independent research-only CI **Run #41221973028** https://github.com/EasonLiu0913/stock_data/actions/runs/41221973028, Job **124598238647**, real GitHub job log **SUCCESS, 7 tests, 7 PASS, 0 fail**. Explicit exact spoken-vs-caption percent case was checked by Node assertion. Commit on research workflow refresh **8c41460721dee48a2d7c947a28de2218f746c714**.
- This is **source-to-dual-track TTS text/caption contract PASS**, not completed regenerated audio, not proof of oral playback and not a new full 1080p MP4. Previous 20261013 media is unchanged and must not be misrepresented as having its percent audio corrected to owner-selected latest literal TTS input. Existing older local patch used Mandarin clip-edit 百分之一點九五, which user did not accept as natural; treat it as historical experiment superseded by the new scripted requirement.

## Next actual MVP action

At the next full Render-only TTS pass, feed **exact original numeric string 百分之1.95** to YunJheNeural +15%; inspect actual regenerated audio before accepting a new full 1080p production version. Do not synthesize English percent, do not patch sound clips and do not weaken prior A/B. Keep separate display caption `1.95%`. No main, production cron, YouTube upload, or release locks touched.

Goal goal-v3/MVP-10DAY-v1; research PROGRESS, MVP10-A INCOMPLETE, B NOT_ELIGIBLE; plan_changed NO.
