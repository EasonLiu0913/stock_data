# Cookie Setup Instructions

Follow these steps to enable the scraper to bypass bot detection:

## Step 1: Extract Cookies from Browser

1. Open your browser and navigate to:
   ```
   https://www.wantgoo.com/stock/major-investors/net-buy-sell-rank?market=Listed&orderByDays=15
   ```

2. Press `F12` (or `Cmd+Option+I` on Mac) to open Developer Tools

3. Click on the **Console** tab

4. Copy and paste the entire content of `extract_cookies.js` into the console

5. Press `Enter` to run the script

6. The cookies will be automatically copied to your clipboard
   - You should see: ✅ Cookies copied to clipboard!

## Step 2: Save Cookies to File

1. Create a new file in `/Users/eason/Documents/stock/cookies.json`

2. Paste the clipboard content (Cmd+V) into the file

3. Save the file

## Step 3: Run the Scraper

```bash
cd /Users/eason/Documents/stock
export PATH=$HOME/.nvm/versions/node/v22.11.0/bin:$PATH
node scraper.js
```

The scraper will now:
- Load cookies from `cookies.json`
- Navigate to WantGoo with authentication
- Extract the top 10 stocks
- Save to `stock_data_YYYYMMDD.csv`

## Troubleshooting

**If you see "No cookies.json found":**
- Make sure you completed Steps 1-2
- Check that `cookies.json` is in `/Users/eason/Documents/stock/`

**If the scraper still gets blocked:**
- Your cookies may have expired
- Re-run Steps 1-2 to get fresh cookies
- Make sure you're logged into WantGoo in your browser

**If you see "0 rows extracted":**
- Wait a few seconds and try again
- The website might be temporarily unavailable
- Check if the URL is accessible in your browser

## Cookie Expiration

Cookies typically expire after a few days or weeks. If the scraper stops working:
1. Re-run the cookie extraction (Steps 1-2)
2. The scraper will automatically use the new cookies
