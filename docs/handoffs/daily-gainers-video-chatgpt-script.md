# 每日 5% 影片 ChatGPT 撰稿交接

每次現有 5% ChatGPT 排程：讀取 remote main 的 AGENTS.md、原始清單、analysis-ai 與 market-summary。若最終 market-summary.status 不為 final 或 coverage.overall 不為 complete，停止影片階段，絕不使用舊日期。
即使 AI 分析已完成且不需要重跑，也務必繼續檢查影片講稿。檔案路徑 video_scripts/daily-gainers/YYYYMMDD.json；已存在且來源 generated_at 與當日 final 摘要相符則 no-op，避免同日重複上傳。
若未建立，由 ChatGPT 依當日真實研究重新撰寫 5–10 分鐘繁體中文自然講稿，選出當天最重要的題材、代表股票、催化證據與籌碼風險，不得引用舊日模板文字、把缺值當零或將推測寫成事實。
JSON 格式：schema_version=1; methodology_version='chatgpt-video-script-v1'; target_date='YYYYMMDD'; source_summary_generated_at=market-summary.generated_at; stock_count=raw.stock_count; privacy_status='private'; scenes 陣列 5–20 項，每項 title、subtitle、bullets（最多五項）、narration（長段口語旁白）、stock_codes（當天 raw 有的代號）、footer。旁白全片 1100–5500 字，單段 75–1800 字，詳見 scripts/validate_daily_gainers_video_script.js。
提交前依 scripts/validate_daily_gainers_video_script.js YYYYMMDD 檢查一致性；使用 GitHub connector 在 main 建立 video_scripts/daily-gainers/YYYYMMDD.json，commit: video: author ChatGPT daily 5% narration YYYYMMDD。不要改原始研究檔或覆蓋已存在講稿。
講稿 push 觸發 .github/workflows/generate-upload-daily-gainers-video.yml。GitHub 再驗證講稿，之後進行配音、VTuber、1080p、字幕、QA、YouTube 私人上傳。若未實際觸發，不得宣稱上傳成功。
影片腳本由 ChatGPT 撰寫；GitHub 僅驗證、渲染與上傳。維持分析/Pages 原有流程不受影響。
