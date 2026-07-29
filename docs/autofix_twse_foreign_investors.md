已完成。現在檢查工具可以在掃描後，自動重新抓取錯誤日期的 TWSE 外資資料，驗證成功後修復正式檔案。

## 執行方式

只檢查、不修改：

```bash
npm run check:twse-foreign-json
```

檢查並自動修復：

```bash
npm run repair:twse-foreign-json
```

`repair:twse-foreign-json` 已設定為：

```bash
node scripts/check_twse_foreign_investors_json.js --repair --fail-on-invalid
```

也就是修復完成後，若仍有無法修復的檔案，指令才會回傳 exit code 1。

## 修復流程

針對每一份格式錯誤檔案，程式會：

1. 從檔名或 JSON 的 `date` 取得日期。
2. 使用該日期重新呼叫 TWSE `TWT38U`。
3. 對新回應重新執行完整格式驗證。
4. 新資料有效後，先備份舊壞檔。
5. 使用原子寫入方式覆蓋正式檔案。
6. 再次讀取正式檔並驗證。
7. 若覆蓋後驗證失敗，自動還原舊檔。
8. 有成功修復時，重新產生 `files.json`。

新資料會在寫入硬碟前再次驗證；正式檔覆蓋後也會再驗證一次。

## 舊檔備份

舊的錯誤檔案不會直接消失，會備份到：

```text
reports/
└── twse_foreign_investors_invalid_backups/
    └── <執行時間>/
        └── 20260525_twse_foreign_investors.json
```

修復報告會記錄每一份檔案的：

```json
{
  "file": "data_twse_foreign_investors/20260525_twse_foreign_investors.json",
  "backup_file": "reports/twse_foreign_investors_invalid_backups/.../20260525_twse_foreign_investors.json",
  "status": "repaired"
}
```

## 會列出實際修正的欄位

修復時會先以股票代號找出新資料中的同一列；找不到時才使用原始 row index 比對。

以 `9914 美利達` 為例，原本只有 6 欄：

```json
[
  " ",
  "9914",
  "美利達",
  "685,000",
  "467,000",
  "218,000"
]
```

重新抓取後為完整 12 欄，報告會記錄：

```json
{
  "changes": {
    "matched": true,
    "matched_by": "stock_code",
    "stock_code": "9914",
    "stock_name": "美利達",
    "old_field_count": 6,
    "new_field_count": 12,
    "changed_fields": [
      {
        "column_index": 6,
        "field_name": "買進股數",
        "old_value": null,
        "new_value": "0"
      },
      {
        "column_index": 7,
        "field_name": "賣出股數",
        "old_value": null,
        "new_value": "0"
      },
      {
        "column_index": 8,
        "field_name": "買賣超股數",
        "old_value": null,
        "new_value": "0"
      },
      {
        "column_index": 9,
        "field_name": "買進股數",
        "old_value": null,
        "new_value": "685,000"
      },
      {
        "column_index": 10,
        "field_name": "賣出股數",
        "old_value": null,
        "new_value": "467,000"
      },
      {
        "column_index": 11,
        "field_name": "買賣超股數",
        "old_value": null,
        "new_value": "218,000"
      }
    ]
  }
}
```

欄位差異會比較舊列與新列，記錄欄位 index、欄位名稱、舊值與新值。

## 最終報告

報告仍輸出到：

```text
reports/twse_foreign_investors_validation_report.json
```

修復模式下會包含：

```json
{
  "mode": "scan_and_repair",
  "counts_before_repair": {},
  "counts_after_repair": {},
  "initially_invalid_files": [],
  "repair": {
    "attempted": 1,
    "repaired": 1,
    "failed": 0,
    "backup_directory": "...",
    "results": []
  },
  "remaining_invalid_files": []
}
```

修復後會重新掃描所有資料，因此可以明確知道是否還有錯誤檔案。

## 防呆行為

遇到以下情況不會覆蓋正式檔案：

* 無法從檔名或內容判斷日期。
* TWSE 請求失敗。
* TWSE 回傳日期不一致。
* 新資料仍缺欄位。
* 新資料買進、賣出、買賣超不一致。
* 新資料寫入後再次驗證失敗。

重新抓取失敗時，原始檔案會保持原樣。這個情境已有自動測試。

美利達 6 欄修復為 12 欄、備份舊檔以及第 6～11 欄差異，也都有測試涵蓋。

正式修改 commit：

```text
0741768084bbb46b3ef8cb3b830f3a732294b12a
feat: report repaired TWSE foreign fields
```

目前程式與模擬測試已完成；尚未實際執行全資料的 TWSE 線上修復指令。
