# GitHub Pages 自動部署指南

## 設定 GitHub Pages

### 1. 初次設定

在 GitHub repository 設定中：
1. 進入 Settings → Pages
2. Source 選擇 `main` branch
3. 資料夾選擇 `/ (root)`
4. 點擊 Save

### 2. 訪問網站

部署完成後，可以通過以下網址訪問：
```
https://你的用戶名.github.io/stock_data/public/foreign.html
```

## 使用自動部署腳本

### 執行方式

每天執行一次即可更新 GitHub Pages 上的股票資料：

```bash
./scripts/deploy_to_github.sh
```

### 腳本功能

1. ✅ 自動執行 `test_extract_stock_data.js` 提取最新股票資料
2. ✅ 檢查資料是否有變更
3. ✅ 自動提交變更到 Git
4. ✅ 自動推送到 GitHub
5. ✅ GitHub Pages 會自動更新（約 1-2 分鐘）

### 設定自動化排程（可選）

#### macOS/Linux - 使用 cron

編輯 crontab：
```bash
crontab -e
```

加入以下內容（每天下午 3 點執行）：
```bash
0 15 * * * cd /Users/eason/Documents/stock && ./scripts/deploy_to_github.sh >> logs/deploy.log 2>&1
```

#### macOS - 使用 launchd（推薦）

創建 `~/Library/LaunchAgents/com.stock.deploy.plist`：
```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.stock.deploy</string>
    <key>ProgramArguments</key>
    <array>
        <string>/Users/eason/Documents/stock/scripts/deploy_to_github.sh</string>
    </array>
    <key>StartCalendarInterval</key>
    <dict>
        <key>Hour</key>
        <integer>15</integer>
        <key>Minute</key>
        <integer>0</integer>
    </dict>
    <key>WorkingDirectory</key>
    <string>/Users/eason/Documents/stock</string>
    <key>StandardOutPath</key>
    <string>/Users/eason/Documents/stock/logs/deploy.log</string>
    <key>StandardErrorPath</key>
    <string>/Users/eason/Documents/stock/logs/deploy_error.log</string>
</dict>
</plist>
```

載入排程：
```bash
launchctl load ~/Library/LaunchAgents/com.stock.deploy.plist
```

## 手動部署步驟

如果不想使用自動腳本，可以手動執行：

```bash
# 1. 提取股票資料
node scripts/test_extract_stock_data.js

# 2. 提交到 Git
git add data_fubon/ public/
git commit -m "Update stock data"

# 3. 推送到 GitHub
git push origin main
```

## 注意事項

- ⚠️ 確保已經設定好 Git remote（origin 指向 GitHub repository）
- ⚠️ 確保有 GitHub 的推送權限
- ⚠️ GitHub Pages 更新需要 1-2 分鐘
- ⚠️ 大型 JSON 檔案可能會增加 repository 大小

## 疑難排解

### 問題：推送失敗
```bash
# 檢查 remote 設定
git remote -v

# 重新設定 remote
git remote set-url origin https://github.com/你的用戶名/stock_data.git
```

### 問題：GitHub Pages 沒有更新
1. 檢查 GitHub Actions 是否有錯誤
2. 確認 Settings → Pages 設定正確
3. 清除瀏覽器快取後重新訪問

### 問題：資料無法載入
1. 檢查瀏覽器 Console 是否有錯誤
2. 確認 JSON 檔案路徑正確
3. 確認 JSON 檔案已經推送到 GitHub
