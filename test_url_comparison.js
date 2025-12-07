const { chromium } = require('playwright');

(async () => {
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
    });

    // Test 1: URL without parameters (like scraper does)
    console.log('=== TEST 1: Without URL parameters (using dropdown) ===');
    const page1 = await context.newPage();
    await page1.goto('https://fubon-ebrokerdj.fbs.com.tw/z/zg/zgb/zgb0.djhtm?a=1030&b=1030', { waitUntil: 'domcontentloaded' });
    await page1.waitForSelector('select[name="Y1"]', { timeout: 15000 });

    // Set date via dropdowns
    await page1.selectOption('select[name="Y1"]', '2025');
    await page1.selectOption('select[name="M1"]', '12');
    await page1.selectOption('select[name="D1"]', '1');
    await page1.selectOption('select[name="Y2"]', '2025');
    await page1.selectOption('select[name="M2"]', '12');
    await page1.selectOption('select[name="D2"]', '1');

    await page1.waitForTimeout(2000); // Wait for page to update

    const data1 = await page1.evaluate(() => {
        const results = [];
        const stockLinks = Array.from(document.querySelectorAll('a[href*="Link2Stk"]'));
        stockLinks.slice(0, 5).forEach(link => {
            const row = link.closest('tr');
            if (!row) return;
            const name = link.innerText.trim();
            const cells = Array.from(row.querySelectorAll('td'));
            if (cells.length >= 4) {
                const netAmt = cells[3].innerText.trim();
                results.push({ name, netAmt });
            }
        });
        return results;
    });

    console.log('First 5 stocks:');
    data1.forEach((d, i) => console.log(`${i+1}. ${d.name} - ${d.netAmt}`));

    await page1.close();

    // Test 2: URL with parameters (like user's URL)
    console.log('\n=== TEST 2: With URL parameters ===');
    const page2 = await context.newPage();
    await page2.goto('https://fubon-ebrokerdj.fbs.com.tw/z/zg/zgb/zgb0.djhtm?a=1030&b=1030&c=B&e=2025-12-1&f=2025-12-1', { waitUntil: 'domcontentloaded' });
    await page2.waitForSelector('select[name="Y1"]', { timeout: 15000 });
    await page2.waitForTimeout(2000);

    const data2 = await page2.evaluate(() => {
        const results = [];
        const stockLinks = Array.from(document.querySelectorAll('a[href*="Link2Stk"]'));
        stockLinks.slice(0, 5).forEach(link => {
            const row = link.closest('tr');
            if (!row) return;
            const name = link.innerText.trim();
            const cells = Array.from(row.querySelectorAll('td'));
            if (cells.length >= 4) {
                const netAmt = cells[3].innerText.trim();
                results.push({ name, netAmt });
            }
        });
        return results;
    });

    console.log('First 5 stocks:');
    data2.forEach((d, i) => console.log(`${i+1}. ${d.name} - ${d.netAmt}`));

    await page2.close();
    await browser.close();
})();
