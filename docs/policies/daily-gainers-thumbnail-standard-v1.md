# TAIWAN STOCK 每日影片縮圖標準規格 v1

- Owner approval: 2026-11-05, based on the four mock PNGs actually rendered by GitHub Actions #41995250296.
- Status: **approved visual direction; isolated renderer implementation/verification in progress**. This policy is not evidence that the production YouTube thumbnail has been changed.
- Scope: TAIWAN STOCK daily 5% gainers videos. Read with `AGENTS.md`, `docs/policies/daily-gainers-video-editorial-verification-delivery-v1.md`, and current owner instructions.
- Reference: original 10/13 editorial thumbnail and approved 11/03 down-day concept; prefer deterministic composition using existing `assets/daily-gainers-vtuber-sprite.webp`, not a regenerated/random presenter every day.

## 1. Immutable brand/layout
- Canvas 1280 × 720 (16:9), output PNG for review and valid JPEG for YouTube upload.
- Dark navy market/candlestick background; brand identity at upper left: `TAIWAN STOCK`. Keep the same male presenter on the right with visual continuity.
- Large date `MM/DD`; very legible primary headline for `台股 5%強勢股`; secondary count `N檔盤點`; lower strip/keywords. Avoid clipping when rendered at phone-thumbnail scale.
- Keep most geometry consistent across dates. Daily editorial variables should inform the message without changing the visual identity.
- Host should occupy right portion, with hands/face unobstructed; do not hide headline, badge, footer or safety margins.

## 2. Verifiable daily variables
| Verified index direction | Frame and date stripe | Direction arrow |
| --- | --- | --- |
| Positive `index_change_points > 0` | TWSE red `#D91F32` | up |
| Negative `index_change_points < 0` | TWSE green `#0CA74D` | down |
| Exactly zero | muted blue `#447DA8` | flat/sideways |

- **Frame exactly 3 physical pixels** at final 1280 × 720 output, including corners; never simulate 3px in a differently sized intermediate and assume precision.
- Index percent is strictly computed from the verified same-date closing level and change points/official percentage, correctly signed, rounded for display without changing authoritative data. Never infer daily market direction from 5% gainers count.
- Date and stock count must match the same verified source list. Correctly distinguish stock and ETF/inverse ETF in copy; `N檔` refers to the verified eligible list, not market-wide limit-up count.
- Optional market micro-label uses a *real, proved* one-line question or tension (example: 「大盤重挫，誰逆勢？」), rather than unsupported causal or sensational claims. Agent provides the actual question only after source research. Badge may show verified index percentage when readable; do not overload with many numbers.
- Up to three bottom keywords, drawn from validated news/Facts/AI and actually covered in the video; fallback `主線題材 • 法人籌碼 • 風險重點`. Avoid exact claims before verification.
- Fixed brand identity and presenter are assets; original creative text is safe to use as a design reference. No new facial identity in every generation.

## 3. Role assignment
- **Hourly Agent**: finds oldest pending trading date first according to owner-approved FIFO, researches a credible daily hook, reconciles stock-count and official index, writes date-scoped SEO/thumbnail variables with evidence/source SHAs. Thumbnail work never displaces main AI/script/video blocker work.
- **GitHub Actions renderer**: combines *verified* variables and the approved fixed template, using the existing `scripts/build_daily_gainers_thumbnail.js` and VTuber sprite. Do not introduce a second production thumbnail implementation when refining the current renderer.
- **Validator**: checks source date, index direction, stock count, non-fabricated captions, branding, correct thumbnail size, 3px perimeter, readable mobile-scale text, approved presenter and SHA trace. Actual PNG/JPEG must be inspected, not merely CI green.
- **YouTube verification**: when an authorized existing PRIVATE video is available, check it from YouTube Studio/API after thumbnail setting. A local file and GitHub receipt alone are not YouTube-origin confirmation.

## 4. Mock tests and safety
- Proven isolated test entrance: `.github/workflows/daily-gainers-thumbnail-mock-preview.yml`, reading `thumbnail-preview-requests/demo-v1.json` and `scripts/render_daily_gainers_thumbnail_preview.js`.
- Mock examples must be clearly marked `模擬測試 · DEMO` and must never be treated as official trading data, copied into production SEO, or attached to a real YouTube video.
- Tests cover up, down, flat, long/short headlines and distinct stock counts; collect actual PNG Artifact and verify dimensions, color-coding and border thickness.
- No YouTube scopes/secrets, private upload attempts, publication, schedule changes or duplicate video render for mock-image tests.
- Production integration requires the usual original media/YouTube safety locks, source-backed metadata and actual validator PASS. Do not assume this v1 document grants publication authorization.

## 5. Production rollout gate
1. Approve visual reference from actual Action-generated PNGs.
2. Refine current **isolated test** with larger presenter and concise market-question text; validate Artifact.
3. Integrate only verified deterministic fields into existing production thumbnail generator, add regression checks, then re-run safe Render-only, inspect JPEG and ensure no upload side effect.
4. After an authorized PRIVATE upload, inspect real YouTube thumbnail visually and record origin-readback evidence.

### Owner decisions
- 2026-11-05: retain the original daily 5% thumbnail skeleton, add red-up/green-down/neutral frame exactly 3px and matching date/arrow, daily index/count, presenter on right, market question and bottom evidence-backed keywords. Reuse existing GitHub pipeline, not a new hourly Agent or new production upload flow.
