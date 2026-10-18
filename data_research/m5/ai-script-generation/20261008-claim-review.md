# 20261008 A4 claim review — research-only

This review cross-checks repository's dated partial market-opening JSON, analysis-facts and analysis-news. It does NOT assert independent verification of linked news webpages or certify market causation. No render or publication authorization.

| Claim ID | Claim | Internal evidence | Editorial status / limitation |
| --- | --- | --- | --- |
| MARKET_INDEX | TAIEX close 49313.44, -492.93 points, -0.9897% | market-opening/20261008.json taiex | dated repository verified market snapshot |
| MARKET_TURNOVER | TWSE whole-market turnover 924509097873 TWD, previous-five-day mean 1007158931238.4 TWD, ratio .9179376453885247 | market-opening/20261008.json market_trading | TWSE whole-market scope; not ordinary-stock-only |
| MARKET_INSTITUTIONAL | foreign -75852293490, trust +3008930013, dealers -18731261604 TWD | market-opening/20261008.json institutional; final BFI82U source archive proof | final values, not preliminary trust +4688777263 |
| MARKET_BREADTH | 425 up, 540 down, 109 unchanged, 14 limit up, 2 limit down; 1082 five-bucket denominator | separately verified official dated MI_INDEX 股票 column CI | do not call certified historical common-stock roster |
| 6672_PRICE | 505 previous, 555 close, +9.9%, 3825 lots | analysis-facts/20261008.json price | dated upstream stock snapshot |
| 6672_FLOW | foreign +251, trust +20, dealer -21, margin -178 lots | analysis-facts/20261008.json flow | reported; lots rounded from net shares |
| 6672_REVENUE | September revenue 10.21 億 TWD, +201.68% YoY | NEWS_6672_1 (upstream news entry dated 2026-10-06) | source webpage not independently reviewed; verify before upgrading to verified_event |
| 6672_THEME | high-grade CCL demand/pricing, low-orbit theme | NEWS_6672_2 and NEWS_6672_3 | contemporary association only; no proved causal link |
| 2305_PRICE | 58.9 previous, 64.7 close, +9.85%, 10587 lots | analysis-facts/20261008.json price | dated upstream stock snapshot |
| 2305_FLOW | foreign +3698, trust -5, dealer +41, margin +529 lots | analysis-facts/20261008.json flow | Corrected isolated research Facts flag institutional_verification_required=false. Independently cross-checked foreign and trust against dated raw TWSE tables: foreign buy 4,608,000 minus sell 910,025 = +3,697,975 shares; trust buy 0 minus sell 5,000 = -5,000 shares. Dealer raw file retrieved via repository contents endpoint: proprietary net 0 shares, hedging buy 73,283 minus sell 32,000 = +41,283 shares, total +41,283 shares. Corrected research Facts and AI now agree with the dated raw TWSE total; do not narrate dealer as zero-net. This does not prove price causality. |
| 2305_REVENUE | September revenue 1.97 億 TWD, +212.8% YoY | NEWS_2305_1 upstream nstock URL dated 2026-10-07 | source is a generic ticker URL; seek actual company announcement/dated page before verified_event |
| 1301_PRICE | 75.4 previous, 81.3 close, +7.82%, 245433 lots | analysis-facts/20261008.json price | dated upstream stock snapshot |
| 1301_FLOW | foreign +14225, trust +13940, dealer -567, margin +10542 lots | analysis-facts/20261008.json flow | reported; individual institutional_verification_required=false in upstream, not a claim of independently checked raw files here |
| 1301_THEME | Q4 petrochemical seasonal/downstream expectations | NEWS_1301_1 dated 2026-10-08 | contemporary association; actual spreads and operating benefit unknown |

Editorial action: retain 6672 and 1301 as provisional featured subjects; retain 2305 as a candidate with the dated reconciled dealer total (+41,283 shares), and do not imply the institutional flow caused the price move. If full source review remains unavailable, mark the corresponding revenue/news assertions as association or omit from final spoken claims. Keep fixed four opening lines with CC fourth exactly once. Spoken/caption numeric parity and actual TTS/SRT/MP4/M8VIS are still unproven. Prompt A ACTIVE, Prompt B FROZEN; publication_authorized=false.

## 2305 research-branch data correction checkpoint
Research-only Facts correction commit `b6cf9bd1bed5d3d6d9b3ea366df17925f18b8d6b` updates 2305 dealer to +41,283 shares (+41 rounded lots), including 0 proprietary plus +41,283 hedging, and sets its individual institutional verification flag false after cross-checking foreign +3,697,975 and trust -5,000 raw rows. This is a dated snapshot correction on isolated research branch, NOT a correction to the upstream Facts generator. Research AI snapshot and editor input were reconciled and verified in Run 38765410438; editorial stale-text guard passed in Run 38766194902. Actual source-linked original narration, numeric spoken/caption parity and video proof remain pending.

Editorial checkpoint 2026-10-18: The index phrase ending in decimal 「點四四點」 is decimal reading plus the index-point unit, not a numeric error. Preserve accepted media; independently verify theme/news sources before editorial certification. Dashboard's dated weakness assessment must be dynamic for future trading dates. Research only; Prompt B and publication remain closed.
