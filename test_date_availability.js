const { chromium } = require('playwright');

(async () => {
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
    });
    const page = await context.newPage();

    await page.goto('https://fubon-ebrokerdj.fbs.com.tw/z/zg/zgb/zgb0.djhtm?a=1030&b=1030', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('select[name="Y1"]', { timeout: 15000 });

    // Check available dates in December
    const availableDays = await page.evaluate(() => {
        const daySelect = document.querySelector('select[name="D1"]');
        const options = Array.from(daySelect.querySelectorAll('option'));
        return options.map(opt => opt.value);
    });

    console.log('Available days in December 2025:', availableDays);

    // Try to set 12/4
    console.log('\nTrying to set date to 2025/12/4...');
    await page.selectOption('select[name="Y1"]', '2025');
    await page.selectOption('select[name="M1"]', '12');

    const option4 = await page.$('select[name="D1"] option[value="4"]');
    if (option4) {
        console.log('Day 4 is available!');
        await page.selectOption('select[name="D1"]', '4');
        await page.selectOption('select[name="Y2"]', '2025');
        await page.selectOption('select[name="M2"]', '12');
        await page.selectOption('select[name="D2"]', '4');

        const queryButton = await page.$('input[type="button"][value="查詢"]');
        if (queryButton) {
            await queryButton.click();
            await page.waitForTimeout(3000);
        }

        const actualDate = await page.evaluate(() => {
            const y = document.querySelector('select[name="Y1"]').value;
            const m = document.querySelector('select[name="M1"]').value;
            const d = document.querySelector('select[name="D1"]').value;
            return `${y}/${m}/${d}`;
        });

        console.log('Actual date after query:', actualDate);
    } else {
        console.log('Day 4 is NOT available in the dropdown');
    }

    await browser.close();
})();
