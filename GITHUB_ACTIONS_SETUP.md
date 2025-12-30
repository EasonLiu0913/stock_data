# GitHub Actions Setup for Stock Data Scraper

This guide will help you set up automated daily stock data scraping using GitHub Actions.

## 📋 Prerequisites

1. A GitHub account
2. This repository pushed to GitHub
3. GitHub Actions enabled (free for public repos, 2000 minutes/month for private repos)

## 🚀 Setup Steps

### Step 1: Initialize Git Repository (if not already done)

```bash
cd /Users/eason/Documents/stock
git init
git add .
git commit -m "Initial commit: Stock data scraper"
```

### Step 2: Create GitHub Repository

1. Go to https://github.com/new
2. Create a new repository (e.g., `stock-data-scraper`)
3. **Important**: Choose **Public** (for unlimited Actions minutes) or **Private** (2000 minutes/month)
4. Don't initialize with README (we already have files)

### Step 3: Push to GitHub

```bash
# Replace YOUR_USERNAME and YOUR_REPO with your actual values
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO.git
git branch -M main
git push -u origin main
```

### Step 4: Enable GitHub Actions

1. Go to your repository on GitHub
2. Click on **Actions** tab
3. GitHub Actions should be enabled by default
4. You'll see the workflow "Daily Stock Data Scraper"

### Step 5: Configure Permissions (Important!)

1. Go to **Settings** → **Actions** → **General**
2. Scroll to **Workflow permissions**
3. Select **Read and write permissions**
4. Check **Allow GitHub Actions to create and approve pull requests**
5. Click **Save**

## ⏰ Schedule

The workflow runs:
- **Daily at 9:00 AM Taiwan Time** (1:00 AM UTC)
- Can also be triggered **manually** from the Actions tab

## 🧪 Test the Workflow

### Manual Trigger (Recommended for first test)

1. Go to **Actions** tab on GitHub
2. Click **Daily Stock Data Scraper** workflow
3. Click **Run workflow** → **Run workflow**
4. Wait a few minutes and check the results

## 📁 How It Works

1. **Checkout code** - Gets the latest code
2. **Setup Node.js** - Installs Node.js 22
3. **Install dependencies** - Installs Playwright and Chromium
4. **Run scrapers** - Executes both scripts
5. **Commit & push** - Saves data back to the repository

## 📊 Viewing Results

### Check Workflow Status
- Go to **Actions** tab
- Click on the latest run
- View logs for each step

### Access Data
The scraped data will be committed to:
- `data_fubon/` - Fubon broker data
- `data_twse/` - TWSE warrant data

You can:
- View files directly on GitHub
- Pull changes to your local machine: `git pull`
- Clone the repo on any device to access the data

## 🔧 Customization

### Change Schedule Time

Edit `.github/workflows/daily-scraper.yml`:

```yaml
schedule:
  # Format: 'minute hour day month day-of-week'
  # Example: 2:30 PM Taiwan Time = 6:30 AM UTC
  - cron: '30 6 * * *'
```

**Time Conversion**: Taiwan is UTC+8, so subtract 8 hours:
- 9:00 AM Taiwan = 1:00 AM UTC → `'0 1 * * *'`
- 2:00 PM Taiwan = 6:00 AM UTC → `'0 6 * * *'`

### Run Multiple Times Per Day

```yaml
schedule:
  - cron: '0 1 * * *'   # 9:00 AM Taiwan
  - cron: '0 6 * * *'   # 2:00 PM Taiwan
  - cron: '0 10 * * *'  # 6:00 PM Taiwan
```

## 🔒 Security Notes

### Sensitive Data
If your scrapers need credentials:

1. Go to **Settings** → **Secrets and variables** → **Actions**
2. Click **New repository secret**
3. Add secrets (e.g., `FUBON_USERNAME`, `FUBON_PASSWORD`)
4. Use in workflow: `${{ secrets.FUBON_USERNAME }}`

### Private Repository
If you want to keep data private:
- Use a **private repository**
- You get 2000 free minutes/month
- Each run takes ~2-5 minutes
- That's enough for daily runs (30 days × 5 min = 150 min/month)

## 📈 Monitoring

### Email Notifications
GitHub will email you if a workflow fails.

### Disable Notifications
1. Go to **Settings** → **Notifications**
2. Uncheck **Actions** if you don't want emails

## 🛑 Pause/Stop

### Disable Workflow
1. Go to **Actions** tab
2. Click **Daily Stock Data Scraper**
3. Click **⋯** → **Disable workflow**

### Re-enable
Same steps, but click **Enable workflow**

## 💰 Cost

- **Public repository**: FREE (unlimited minutes)
- **Private repository**: FREE up to 2000 minutes/month
- Estimated usage: ~150 minutes/month (well within free tier)

## 🆚 Comparison: GitHub Actions vs Local launchd

| Feature | GitHub Actions | Local launchd |
|---------|---------------|---------------|
| Requires computer on | ❌ No | ✅ Yes |
| Cost | Free | Free |
| Reliability | High (99.9% uptime) | Depends on your computer |
| Data storage | GitHub repo | Local disk |
| Access from anywhere | ✅ Yes | ❌ No |
| Setup complexity | Medium | Low |

## 🔄 Syncing Data to Local Machine

To get the latest data on your local machine:

```bash
cd /Users/eason/Documents/stock
git pull
```

Or set up automatic sync with a local launchd job that just pulls data!

## ❓ Troubleshooting

### Workflow doesn't run
- Check if Actions are enabled
- Check workflow permissions (Step 5)
- Check cron syntax

### Scraper fails
- View logs in Actions tab
- Check if scripts work locally first
- Ensure all dependencies are in `package.json`

### Data not committed
- Check workflow permissions
- View the "Commit and push data" step logs

## 📚 Next Steps

1. Test manual trigger first
2. Wait for first scheduled run (tomorrow 9 AM)
3. Set up `git pull` automation on your local machine (optional)
4. Monitor for a few days to ensure stability
