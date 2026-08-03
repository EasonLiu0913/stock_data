# 標籤與版本化策略 UI v2

## 目標

- 預測頁由共用 registry 固定顯示所有啟用標籤與策略。
- 原子標籤支援 AND、OR、NOT 組合篩選。
- 0 檔與 N/A 分開顯示。
- 覆盤頁可切換當時實際版本與新版歷史重算。
- 正式 live snapshot 首次產生後保持不可變。
- historical recalculation 依 registry 指紋與 data_as_of 分檔，可在同一日期保存多個版本。

## 相容性

新版 UI 優先讀取 `tag_registry`、`strategy_registry_v2`、`atomic_tags`、`registered_strategy_matches`，並保留舊欄位 fallback。既有正式策略覆盤卡片會由新版動態面板取代，但市場準備度覆盤仍保留。
