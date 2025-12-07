const { chromium } = require('playwright');

(async () => {
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
    });
    const page = await context.newPage();

    await page.goto('https://fubon-ebrokerdj.fbs.com.tw/z/zg/zgb/zgb0.djhtm?a=1030&b=1030', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('select[name="Y1"]', { timeout: 15000 });

    // Find all buttons and inputs
    const elements = await page.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll('button, input[type="button"], input[type="submit"], a'));
        return buttons.map(el => ({
            tag: el.tagName,
            type: el.type,
            value: el.value,
            text: el.innerText?.substring(0, 50),
            onclick: el.getAttribute('onclick'),
            href: el.getAttribute('href')?.substring(0, 100)
        })).filter(el =>
            el.text?.includes('查詢') ||
            el.text?.includes('送出') ||
            el.text?.includes('確定') ||
            el.value?.includes('查詢') ||
            el.value?.includes('送出') ||
            el.onclick?.includes('submit') ||
            el.onclick?.includes('query')
        );
    });

    console.log('Found potential query buttons:');
    console.log(JSON.stringify(elements, null, 2));

    // Also check for forms
    const forms = await page.evaluate(() => {
        return Array.from(document.querySelectorAll('form')).map(form => ({
            action: form.action,
            method: form.method,
            onsubmit: form.getAttribute('onsubmit')
        }));
    });

    console.log('\nFound forms:');
    console.log(JSON.stringify(forms, null, 2));

    await browser.close();
})();
