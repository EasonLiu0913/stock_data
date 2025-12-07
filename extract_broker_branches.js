const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

(async () => {
    const browser = await chromium.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    const context = await browser.newContext({
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
    });
    const page = await context.newPage();

    const outputFile = path.join(__dirname, 'broker_branches.json');
    const nameMapFile = path.join(__dirname, 'broker_names.json');
    const result = {};
    const nameMap = {};

    try {
        const baseUrl = 'https://fubon-ebrokerdj.fbs.com.tw/z/zg/zgb/zgb0.djhtm';
        console.log(`Navigating to ${baseUrl}...`);
        await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });

        // 1. Get All Brokers
        const brokers = await page.evaluate(() => {
            const sel = document.querySelector('select[name="sel_Broker"]');
            if (!sel) return [];
            return Array.from(sel.options).map(opt => ({
                name: opt.text,
                id: opt.value
            })).filter(b => b.id);
        });

        console.log(`Found ${brokers.length} brokers.`);

        // Store broker names
        brokers.forEach(b => {
            nameMap[b.id] = b.name;
        });

        for (let i = 0; i < brokers.length; i++) {
            const broker = brokers[i];
            console.log(`[${i + 1}/${brokers.length}] Fetching branches for: ${broker.name} (${broker.id})`);

            // Navigate to broker page to load its branches
            await page.goto(`${baseUrl}?a=${broker.id}&b=${broker.id}`, { waitUntil: 'domcontentloaded' });

            // 2. Get Branches for this Broker
            const branches = await page.evaluate(() => {
                const sel = document.querySelector('select[name="sel_BrokerBranch"]');
                if (!sel) return [];
                return Array.from(sel.options).map(opt => ({
                    name: opt.text,
                    id: opt.value
                })).filter(b => b.id);
            });

            result[broker.id] = branches.map(b => b.id);

            // Store branch names
            branches.forEach(b => {
                nameMap[b.id] = b.name;
            });

            // Optional: Add a small delay to be polite
            // await page.waitForTimeout(100); 
        }

        fs.writeFileSync(outputFile, JSON.stringify(result, null, 2), 'utf8');
        fs.writeFileSync(nameMapFile, JSON.stringify(nameMap, null, 2), 'utf8');
        console.log(`✅ Broker-Branch map saved to ${outputFile}`);
        console.log(`✅ Broker-Name map saved to ${nameMapFile}`);

    } catch (error) {
        console.error('An error occurred:', error);
    } finally {
        await browser.close();
    }
})();
