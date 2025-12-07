# Browser Console Data Extraction

Since the WantGoo API blocks automated requests (returns HTTP 400), use this browser console script to extract data manually.

## Quick Start

1. **Open the page** in your browser:
   ```
   https://www.wantgoo.com/stock/major-investors/net-buy-sell-rank?market=Listed
   ```

2. **Select "近15日"** (Last 15 days) from the dropdown

3. **Wait** for the table to load with stock data

4. **Open Console**:
   - Press `F12` (or `Cmd+Option+I` on Mac)
   - Click the **Console** tab

5. **Run the script**:
   - Open `extract_data.js`
   - Copy the entire content
   - Paste into the console
   - Press `Enter`

6. **Download**: The CSV file will automatically download to your Downloads folder

## What the Script Does

- ✅ Finds `table#netBuyRank`
- ✅ Extracts top 10 rows with data
- ✅ Converts to CSV format
- ✅ Downloads as `stock_data_YYYYMMDD.csv`
- ✅ Shows preview in console

## Output Format

CSV with 7 columns:
- Rank
- Stock (name)
- NetBuy_Today
- NetBuy_15Days
- Price
- Change (%)
- Volume

## Daily Usage

For daily data collection:
1. Open the WantGoo page
2. Select "近15日"
3. Wait for data to load
4. Run the console script
5. CSV downloads automatically

**Time required**: ~30 seconds per day

## Why This Approach?

The WantGoo API endpoint `/stock/toppopular?n=10` returns **HTTP 400** errors when accessed programmatically, even with valid cookies. This means:

- ❌ Fully automated scraping doesn't work
- ❌ Playwright/Puppeteer can't trigger the AJAX call
- ✅ Manual browser + console script works perfectly

This is the most reliable solution given the website's anti-automation measures.
