# TAIWAN STOCK｜多交易日補片與 PRIVATE 上傳安全落地 v1

Owner direction: 2026-11-05; same original hourly ChatGPT Agent v2.2, no parallel Agent. Repository: `EasonLiu0913/stock_data`, `main`.

## 目標與完成定義

從 20261103 起逐日維護各有效已收盤交易日的狀態，允許一輪 Agent 補多日新聞、AI、Market Opening、完整講稿與 Render-only。任何較早日期 BLOCKED 不得阻擋較新日期的研究。**每日期只有當該日完整 MP4/SRT/QA/SHA、同日來源與原始 A/B 全部驗證，YouTube PRIVATE 上傳/字幕/Video ID/Receipt/真實隱私回讀也完成，才是 `PRIVATE_UPLOAD_VERIFIED`；只有此時凍結新聞及退出待辦佇列。** 完成僅代表 PRIVATE，不得自動 public/unlisted。

## 可驗證事實（2026-11-05）

- 已觀察 11/04 orchestrator CI #41916560290 錯取 20261013 舊影片講稿，Validator 報 `missing/invalid scene_type 0`。
- 原 `.github/workflows/generate-upload-daily-gainers-video.yml` 上傳工作全域 `concurrency: group: daily-gainers-video; cancel-in-progress: true`，不同日期可互相取消。
- `scripts/decide_daily_gainers_video_upload.sh` 只用近期全域 active job 計數，且「receipt 不存在」不證明此前 YouTube 沒有已上傳影片；多日期直接並行上傳有重複風險。
- 20261103 有既存私人試傳 receipt／Video ID `GiWA60DJoWI`，禁止重傳。

## 已實作並測試的安全小步（main）

1. 將 Generate & Upload 和 Retry Upload 改為共用 `daily-gainers-video-upload-serial` 併發群組、`cancel-in-progress: false`，正在上傳的影片不會被新日期取消；**此為保守序列化，不宣稱已完成多日同時上傳**。
2. 新增 `scripts/select_daily_gainers_pending_video_dates.js`，以日期升冪列出 `20261103` 起有日期匹配、`privacy_status=private` 且**沒有任何 upload receipt** 的候選講稿；舊日期及 receipt 異常時 fail closed。
3. 修正 `daily-gainers-video-upload-orchestrator.yml`：手動 dispatch 必須給明確 `YYYYMMDD`；排程/推送掃描待交付候選並先執行原始 `validate_daily_gainers_video_script.js`，只分派首個驗證 PASS 的日期；沒有驗證候選時不啟動 YouTube。**目前每次 orchestrator 最多路由一個上傳工作**。
4. 新增四組檔案日期／receipt／私密性測試與無秘密讀取的 GitHub Actions CI `daily-gainers-multidate-date-gate-tests.yml`；Run #41971732954 已 PASS。此 PASS **僅代表日期選擇與安全鎖靜態及單元驗證**，不等於真實多日期產片／YouTube 端到端驗收。

## 後續必須完成的階段與 A/B

A. 加入日期化、可並行且**絕不包含 YouTube 上傳步驟**的通用 Render-only 工作流程；每個有效交易日獨立 facts/news/AI/final summary/12值opening/逐檔 scripts/MP4/SRT/QA/SHA，避免 11/3 golden 硬編日期與 44 檔內容不一致。保留驗證器的嚴格門檻，不能因多日期而將 missing 概念成 PASS。

B. 在任何自動私人上傳前建立**不可重複建立影片的持久化上傳意圖／idempotency 保護**：在 YouTube API 建立影片前保存日期、輸入 SHA、來源 run 與 PENDING；上傳回覆模糊時唯讀查證而非盲目 retry；只有 video ID、真實 private 與字幕回讀、receipt 完整後更新 COMPLETE。所有 retry / Generate Upload 共用檢查，需測 race/取消/並行情境。GitHub concurrency 序列化同一時間只允許一個 upload job；待完整測試再評估按日期上傳併發。

C. 才讓 Agent 單輪觸發多個日期化 **Render-only** 工作流程，並將其合格影片排入**單一安全上傳序列**；各日 `PRIVATE_UPLOAD_VERIFIED` 才結案。不同日期相互獨立，但相同日期不重跑不重傳。

D. 對 20261104 及另一有效日期做原定 A/B、現場 Job Logs 與真正 Artifact 逐項驗證：來源 SHA、官方12值、全部股票、TTS、SRT、1080p MP4、burn QA、SHA、YouTube private、字幕、receipt。這些尚未 PASS，不得寫成已完成。

## 執行邊界

- Owner 已授權合格影片自動 **PRIVATE** 上傳（2026-11-05），**未授權**自動 public/unlisted 或修改既存影片隱私；不得降低任何原始 A/B。
- 不重傳 11/3，不自動回補 20261102 及更早。
- 所有正式流程必須先核對遠端 main 與 push 副作用，保持一個原本每小時 ChatGPT Agent、直接 main 小步演進。舊的硬編 11/3 workflow 保留 golden，不用它假冒 11/4。

## 2026-11-05 小步實作與驗證進度（接續 v1）

**已寫入 main、CI 已實際 PASS**：

- `.github/workflows/daily-gainers-date-render-only.yml`：從 11/3 Golden 派生的通用日期參數化 Render-only（`workflow_dispatch date=YYYYMMDD`），`concurrency` 以 `inputs.date` 隔離；沒有 YouTube API 或任何上傳 Secrets；所有日期限定檢查已改用該日 raw stock_count、qa.target_date、scene_count、動態字幕百分比，並產出日期化 metadata/thumbnail、MP4/SRT/QA/SHA。**目前只有靜態安全／單元測試通過，尚未以 11/4 真實 44 檔跑出完整影片；不能宣稱渲染驗收通過。**
- `.github/workflows/generate-upload-daily-gainers-video.yml` 與 `retry-upload-daily-gainers-video.yml` 已取消「空白日期自動選最新」後備：必須帶入確切日期（retry 還必須帶來源 Run ID）；二者共享不可中途取消的 PRIVATE 上傳併發鎖 `daily-gainers-video-upload-serial`。
- `scripts/reserve_daily_gainers_private_upload.sh`：每次私人上傳 API POST 前，以 GitHub Contents API **create-only** 寫入 `video_upload_attempts/daily-gainers/YYYYMMDD.json`，內含日期、source Run、workflow Run、MP4 SHA-256、私人狀態與啟動時間。若先前已有 Attempt 或既有 Receipt，一律拒絕重傳。
- `scripts/select_daily_gainers_pending_video_dates.js` 與 `scripts/decide_daily_gainers_video_upload.sh`：發現 Attempt 而沒有完整 Receipt 時不自動重試，而是保留阻塞並要求 YouTube 唯讀對帳（`blocked_reconcile_upload`），消除「成功上傳卻沒寫入 Receipt 後重傳」的已知風險。**但尚無自動對帳成功即完成 Receipt 的測試，不能宣稱整條 upload idempotency 完成。**
- 日期選擇已限定 `20261103` 起，優先最早尚未交付且完整 Validator PASS 的日期；舊 `20261013` 不再作預設。每輪可另行派多個**無上傳**的 Render-only，PRIVATE 上傳仍保守一個接一個，避免真正同時寫入 YouTube。
- 唯讀 CI：[Multi-date safety gates #41972808906](https://github.com/EasonLiu0913/stock_data/actions/runs/41972808906) **SUCCESS**，涵蓋 5 組日期／receipt／attempt 選擇測試、Shell 語法、並行鎖／Render-only 禁止上傳與上傳前 reservation 順序。

**接下來還缺真正 A/B：** 針對至少兩個日期以實際 Agent 撰寫的合格講稿完成 Render-only MP4/SRT/QA/SHA/開尾畫面及新聞來源驗收；在未有 ambiguity 的測試條件下完成 YouTube PRIVATE 上傳／真實狀態／字幕／Receipt 回讀，並測試上傳中斷後由 Attempt 正確阻擋重傳。這些項目尚未執行，不要標為 PASS。發布鎖維持 **PRIVATE only**，禁止 public/unlisted。

## 2026-11-05 每小時多日期缺資料觸發（Phase: date-scoped source recovery）

新增 `.github/workflows/taiwan-stock-date-recovery-dispatch.yml`（Commit `7450c57549e60430efeb80eeacd85ba74a59afea`），整合原本單一每小時 ChatGPT Agent v2.2。

- **Agent 可用入口**：由 GitHub Connector 在 `main` 建立或有實質變更才更新 `recovery-requests/daily-gainers/YYYYMMDD.json`，內容 `{"schema_version":1,"target_date":"YYYYMMDD","mode":"missing_data_recovery","reason":"實際缺少哪些來源及上輪證據","max_dispatches":2}`。GitHub Actions `push` path filter 會啟動日期化補檔 Dispatcher。人工亦可透過 `workflow_dispatch` 指定 `date`。嚴禁直接使用不具日期參數的預設值。
- **可觸發的既有資料來源**：`daily-gainers-over-5.yml`（raw 5%）、`crawl-twse-mi-index.yml`、`crawl-twse-institutional-summaries.yml`（外資／投信／自營商）、`crawl-twse-margin-balance.yml`、`crawl-fubon-broker-details.yml`。保留各自原始契約；源 Workflow 可能帶 Pages deploy 副作用，Agent 發請求前須查原 Workflow 是否符合該日安全與成本限制。
- **成本／重試界線**：每個 Dispatcher 最多派送兩個源 Workflow；已有資料文件就跳過、原工作仍在跑就跳過、該類最近 2 小時內執行過則標 `REVIEW_FIRST` 等 Agent 查實際 Job Log；不做盲目高頻重跑。不同日期可各自補資料，但共用 Router serial concurrency；不是允許同時多日 YouTube upload。
- **內容邊界**：Dispatcher 僅以**檔案存在與非空**作為缺檔初判，**不是**日期／語義／來源 SHA 與 Validator PASS。已有但異常檔案需 Agent 依原驗證 Log 專案化修復；尚未具通用 `Facts`、`official market-opening` 或 AI 創作自動重建器。ChatGPT 本身必須撰寫新聞候選和非模板 AI 候選，讓現有日期化 CI 驗證及推廣；影片仍要完整 QA、PRIVATE 上傳及 receipt 才結案。
- **證據**：安全靜態／日期選擇回歸 CI [#41975732119](https://github.com/EasonLiu0913/stock_data/actions/runs/41975732119) SUCCESS；尚未以實際 `recovery-requests` 推送證實其源 Workflow 連鎖成功，**不得稱端到端 PASS**。每小時 Agent 已寫入相關入口與真實 Run/Log 續行規則。沒有可安全行動時照實報 `BLOCKED`／`WAITING_SOURCE`，不能為了每輪報告 PASS 而造假或重複提交。
