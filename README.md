# WantGoo Stock Scraper

Automated scraper to extract the top 10 stocks from WantGoo's "Major Investors Net Buy/Sell Rank" for the last 15 days.

## Quick Start

### 1. Extract Cookies (One-time setup)

Open your browser console on WantGoo and run the cookie extraction script:

```bash
# See detailed instructions in COOKIE_SETUP.md
```

**TL;DR:**
1. Open https://www.wantgoo.com/stock/major-investors/net-buy-sell-rank?market=Listed&orderByDays=15
2. Press F12 → Console tab
3. Paste content of `extract_cookies.js` and press Enter
4. Save clipboard to `cookies.json`

### 2. Run the Scraper

```bash
export PATH=$HOME/.nvm/versions/node/v22.11.0/bin:$PATH
node scraper.js
```

### 3. Output

The scraper creates `stock_data_YYYYMMDD.csv` with 7 columns:
- Rank
- Stock (name)
- NetBuy_Today
- NetBuy_15Days
- Price
- Change (%)
- Volume

## Files

- `scraper.js` - Main scraper script
- `extract_cookies.js` - Browser console script to extract cookies
- `COOKIE_SETUP.md` - Detailed setup instructions
- `cookies.json` - Your browser cookies (create this file)
- `package.json` - Node.js dependencies

## How It Works

1. Loads cookies from `cookies.json` to bypass bot detection
2. Navigates to WantGoo with `orderByDays=15` parameter
3. Waits for `table#netBuyRank` to load
4. Extracts top 10 rows from the table
5. Saves to CSV with timestamp

## Troubleshooting

**"No cookies.json found"**
- Run the cookie extraction process (see COOKIE_SETUP.md)

**"No data extracted"**
- Cookies may have expired - re-extract them
- Website might be temporarily unavailable

**Bot detection / verification page**
- Make sure cookies.json contains valid, recent cookies
- Ensure you're logged into WantGoo in your browser

## Daily Automation

To run daily, add to crontab:

```bash
# Run every day at 9 AM
0 9 * * * cd /Users/eason/Documents/stock && /Users/eason/.nvm/versions/node/v22.11.0/bin/node scraper.js
```

Note: You may need to refresh cookies periodically (every few weeks).
