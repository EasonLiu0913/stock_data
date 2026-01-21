#!/bin/bash

# GitHub Pages 自動更新腳本
# 用途：提取股票資料後自動提交到 GitHub，更新 GitHub Pages

echo "🚀 開始 GitHub Pages 更新流程..."

# 1. 執行股票資料提取
echo "📊 正在提取股票資料..."
export PATH="/Users/eason/.nvm/versions/node/v22.11.0/bin:$PATH"
node scripts/test_extract_stock_data.js

# 檢查是否成功
if [ $? -ne 0 ]; then
    echo "❌ 股票資料提取失敗！"
    exit 1
fi

echo "✅ 股票資料提取完成"

# 2. 取得當前日期
TODAY=$(date +%Y%m%d)
echo "📅 日期: $TODAY"

# 3. 檢查是否有變更
if git diff --quiet data_fubon/fubon_${TODAY}_stock_data.json; then
    echo "ℹ️  資料無變更，跳過提交"
    exit 0
fi

# 4. 提交變更到 Git
echo "📝 正在提交變更到 Git..."
git add data_fubon/fubon_${TODAY}_stock_data.json
git add public/foreign.html

# 建立提交訊息
COMMIT_MSG="Update stock data for ${TODAY}"
git commit -m "$COMMIT_MSG"

if [ $? -ne 0 ]; then
    echo "❌ Git 提交失敗！"
    exit 1
fi

echo "✅ Git 提交完成"

# 5. 推送到 GitHub
echo "🔄 正在推送到 GitHub..."
git push origin main

if [ $? -ne 0 ]; then
    echo "❌ 推送到 GitHub 失敗！"
    exit 1
fi

echo "✅ 推送到 GitHub 完成"
echo "🎉 GitHub Pages 將在幾分鐘內更新"
echo "📍 訪問: https://你的用戶名.github.io/stock_data/public/foreign.html"
