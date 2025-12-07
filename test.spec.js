const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

test('open wantgoo with cookies and extract data', async ({ context, page }) => {
    // Load cookies
    const cookiesPath = path.join(__dirname, 'cookies.json');
    if (fs.existsSync(cookiesPath)) {
        const cookies = JSON.parse(fs.readFileSync(cookiesPath, 'utf8'));
        await context.addCookies(cookies);
        console.log('✅ Loaded', cookies.length, 'cookies');
    }

    await page.goto('https://www.wantgoo.com/stock/major-investors/net-buy-sell-rank?market=Listed&orderByDays=15', {
        waitUntil: 'networkidle'
    });

    // Wait longer for AJAX data to load
    console.log('Waiting 10 seconds for data to load...');
    await page.waitForTimeout(10000);

    // Scroll to the table (sometimes triggers lazy loading)
    await page.locator('table#netBuyRank').scrollIntoViewIfNeeded();
    await page.waitForTimeout(2000);

    // Check page title to confirm we're on the right page
    const title = await page.title();
    console.log('Page title:', title);

    // Check if we're on a verification/login page
    const bodyText = await page.locator('body').textContent();
    if (bodyText.includes('驗證') || bodyText.includes('登入') || bodyText.includes('verification')) {
        console.log('⚠️  Looks like a verification/login page!');
    }

    // Take screenshot
    await page.screenshot({ path: 'test_screenshot.png', fullPage: true });
    console.log('📸 Screenshot saved to test_screenshot.png');

    // Check if table exists and has data
    const tableExists = await page.locator('table#netBuyRank').count() > 0;
    console.log('Table exists:', tableExists);

    if (tableExists) {
        const rowCount = await page.locator('table#netBuyRank tbody tr').count();
        console.log('Row count:', rowCount);

        // Try to wait for a row with actual content
        try {
            await page.waitForFunction(() => {
                const table = document.querySelector('table#netBuyRank');
                if (!table) return false;
                const firstCell = table.querySelector('tbody tr td');
                return firstCell && firstCell.innerText.trim() !== '';
            }, { timeout: 5000 });
            console.log('✅ Found row with content!');
        } catch (e) {
            console.log('❌ Timeout waiting for row content');
        }

        // Get first row data
        const firstRow = await page.locator('table#netBuyRank tbody tr').first();
        const cells = await firstRow.locator('td').allTextContents();
        console.log('First row data:', cells);

        // Get all rows
        const allRows = await page.locator('table#netBuyRank tbody tr').all();
        console.log('Total rows found:', allRows.length);
    }

    // Keep browser open to inspect
    await page.waitForTimeout(3000);

    await page.pause();
});
