# TAIWAN STOCK 每日 5% 影片固定品牌開場（Frozen V1）

狀態：已核定；獨立於尚未開始的「市場開場 Phase 1」資料蒐集。

## 不可改寫的固定開場（三句原文）

1. 大家好，歡迎來到 TAIWAN STOCK！
2. 追蹤資金，解讀行情。
3. 錢在哪，我們就在哪！

以上三句是每支影片的**第一段語音**，必須依序完整出現。禁止任何生成式 AI 改寫、同義替換、刪減或依交易日調整；原文由 `scripts/daily_gainers_brand_opening.js` 統一管理。

## 講稿／影片處理

- 日常資料與個股講稿內容在固定開場**之後**，不可把大盤動態數據插到品牌開場之前。
- V1 相容路徑：`scripts/build_daily_gainers_video_package.js` 在第一場景打包時加入固定開場；`scripts/validate_daily_gainers_video_script.js` 驗證可形成正確開場，拒絕衝突招呼。
- V2 主路徑：`scripts/daily_gainers_text_variants.js` 在第一個場景開頭插入三個共用語意 cue，從同一組 token 產生 speech、captions 與 display；禁止語音和字幕各自重寫。
- 已含完整固定開場時應保持原文不重複添加；不符合規則的其他招呼要報錯，而不是默默改寫。
- TTS 音檔及 SRT 字幕必須與講稿內容一致，不准為配合時長刪去口號。每一段 cue 完整保留三句固定開場的字詞和順序。
- 用字「錢在哪，我們就在哪！」描述的是研究資金流向，不表示追價建議或收益保證。
- 市場開場目標 60–90 秒（專業主播 70%＋犀利分析師 30%）包含上述固定句；必須用 TTS 實際量測時長，不得為了達成時間限制剪掉固定招呼。
- 舊影片資料維持原狀，不修改歷史輸出與既有 YouTube 影片。

## 驗收與停止條件

- 運行 `node --test tests/daily_gainers_brand_opening.test.js`。
- 使用實際交易日的 V1 打包與 V2 Preview 檢查第一場景，並確認語音逐字、字幕 cue 與配音時長，才算完整整合驗收。
- 本次改動不開始市場開場 Phase 1，不啟動影片上傳，沒有音檔實測時不得宣稱端到端 PASS。
