# TAIWAN STOCK — MVP10-A Inclusive Eligibility Change Proposal v1

Status: **OWNER-APPROVED FOR VERSIONED REGISTRATION; implementation not started.**

Repository: EasonLiu0913/stock_data  
Owner approval: 2026-11-08 — “核准「依此草案完成正式登記」。”  
Registration base: remote main 5a7869e4fedf3270a10c83a28f03b08b5247da74  
Original frozen pair (immutable): data_research/m5/change-proposals/DAILY-VIDEO-MVP-10DAY-PAIR-v1.md  
Original pair blob at registration: 8cebf1a8e50f9d044e777419f7f120b4afa699a0  
Registered successor pair: data_research/m5/change-proposals/MVP10-A-INCLUSIVE-ELIGIBILITY-PAIR-R2-v1.md

## Owner decision

The owner directed that candidate eligibility must not be restricted to ordinary common stocks and approved formal registration of the revised direction. This proposal is prospective. It does not alter the original MVP10-A/B pair or erase the current MVP10-A R1 result.

## Evidence and reason for the versioned change

The original pair requires TWSE-listed ordinary common stocks and a TWSE_COMMON_STOCK opening breadth. The owner-approved editorial policy v1.1 applies to trading dates from 20261103 and uses date-matched, independently supported 5% gain eligibility with accurate instrument labeling. The repository instructions preserve frozen A/B criteria, so the later editorial rule cannot silently rewrite the already-started MVP10-A R1.

Remote main at registration contained:
- Verified 20261104 official opening blob 3578047ff03548e2bcb65d908228e9753deb434b, using scope TWSE_MI_INDEX_OFFICIAL_STOCK_COLUMN.
- Official numeric Receipt PASS run 42231051247.
- Verified 20261104 Facts blob 75e0573aa2fb394712f40cb9b115096b3e136c07, News blob c31055e4c0f3e60899be5e8e4fe9358c923190a6, Market Summary blob 5560810319b843c1b5e57c3ddbf009ff51946bc4, AI v3 blob 24cf09ade6b98488b792aebc5036db9240c58a30, and R2-passed candidate blob f690c703058a4367ac1f619dd786d61f9d55eab0.
- The 44-stock candidate includes 910322 康師傅-DR. The present opening is an official MI_INDEX aggregate, not ordinary-common-stock breadth.
- Date-specific SEO input research_pending/daily-gainers-seo/20261104.json was absent.
- MVP10-A R1 was recorded WAITING_SOURCE, not complete. Its paired B was not eligible.

The practical correction is a new paired round that explicitly adopts the approved inclusive eligibility direction and the official MI_INDEX breadth scope without pursuing a full historical ordinary-stock security master.

## Approved scope of this proposal

1. Keep the project's TWSE-only exchange boundary. This proposal does not add TPEx or infer other exchanges.
2. For dates covered by editorial policy v1.1, use the date-matched TWSE source and independently verified gain of at least 5% as the featured-candidate rule. Do not exclude an otherwise eligible TWSE-listed instrument solely because it is a DR, ETF, ETN, or other instrument category covered by policy.
3. Retain accurate source-backed instrument labels. Do not describe a DR or fund as an operating company. Verify only evidence required for the featured candidates and the current validators; do not require a full historical ordinary-stock universe archive.
4. Use the same-date verified MI_INDEX official 股票 column as TWSE_MI_INDEX_OFFICIAL_STOCK_COLUMN for the opening. Keep its scope explicit. Do not rename it TWSE_COMMON_STOCK or represent it as ordinary-common-only breadth. A second ordinary-stock breadth is outside this registered scope.
5. Reuse verified 20261104 evidence by exact source identity and blob/SHA. Do not repeat the completed 44-stock research or News attribution.
6. Preserve official source/date/unit/arithmetic/provenance requirements, current script/news validators, actual media and visual QA requirements, and the owner-approved thumbnail standard.
7. Preserve all existing YouTube upload, scheduling, public-release, and release-lock prohibitions. Do not commit a formal script to video_scripts/daily-gainers/*.json while that path can activate upload orchestration. Render must use the isolated date-scoped Render-only workflow.
8. Preserve the original private-upload requirement as a separate permission gate. No private upload is authorized here; without separate owner authorization it remains WAITING_OWNER/WAITING_PERMISSION, never PASS.

## Governance disposition

- Original MVP10-A/B v1 criteria remain byte-for-byte unchanged and preserved.
- MVP10-A-R1 is closed as SUPERSEDED_OWNER_APPROVED for future execution only; its WAITING_SOURCE checkpoint remains historical and is not called PASS.
- The v2 R1 Prompt B failure and all preserved run IDs remain unchanged.
- Register the successor pair before execution: MVP10-A-R2 / MVP10-B-R2.
- This approval authorizes the registration and prospective pair only. It does not start Prompt A, authorize Render dispatch, or authorize any YouTube action.
- Plan changed: YES, prospectively, under this explicit owner-approved versioned change.

## Acceptance change summary

| Contract item | Original frozen pair | Registered successor R2 |
|---|---|---|
| Featured instruments | TWSE-listed ordinary common stocks only | Date-matched TWSE 5% candidates across supported instrument types, accurately labeled |
| Opening breadth | TWSE_COMMON_STOCK | TWSE_MI_INDEX_OFFICIAL_STOCK_COLUMN, with its official scope stated |
| Full historical ordinary-stock master | Required by the original ordinary-only gate | Not required for this video path |
| Same-date official values, provenance and script/news checks | Required | Retained |
| Real render, thumbnail, subtitles, visual QA | Required | Retained |
| YouTube upload/publication | Separately gated / prohibited absent authorization | Unchanged; no upload or publication authorized |

## Next action

The registered successor pair is in MVP10-A-R2. A is eligible but not started. A new owner-issued promptA is required to begin. Prompt B remains ineligible until the same-round A completion contract is met.
