const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

(async () => {
    const targets = [
        { url: 'https://fubon-ebrokerdj.fbs.com.tw/z/zg/zg_F_0_1.djhtm', name: '上市主力買超1日排行' },
        { url: 'https://fubon-ebrokerdj.fbs.com.tw/z/zg/zg_F_0_2.djhtm', name: '上市主力買超2日排行' },
        { url: 'https://fubon-ebrokerdj.fbs.com.tw/z/zg/zg_F_0_3.djhtm', name: '上市主力買超3日排行' },
        { url: 'https://fubon-ebrokerdj.fbs.com.tw/z/zg/zg_F_0_4.djhtm', name: '上市主力買超4日排行' },
        { url: 'https://fubon-ebrokerdj.fbs.com.tw/z/zg/zg_F_0_5.djhtm', name: '上市主力買超5日排行' },
        { url: 'https://fubon-ebrokerdj.fbs.com.tw/z/zg/zg_F_0_10.djhtm', name: '上市主力買超10日排行' },
        { url: 'https://fubon-ebrokerdj.fbs.com.tw/z/zg/zg_F_0_20.djhtm', name: '上市主力買超20日排行' },
        { url: 'https://fubon-ebrokerdj.fbs.com.tw/z/zg/zg_F_0_30.djhtm', name: '上市主力買超30日排行' }
    ];

    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();

    try {
        for (const target of targets) {
            console.log(`Navigating to ${target.url}...`);
            await page.goto(target.url, { waitUntil: 'domcontentloaded' });

            const data = await page.evaluate(() => {
                // Find all tables
                const tables = Array.from(document.querySelectorAll('table'));

                // Find the one that has "名次" and "股票名稱" in the first row/header
                const targetTable = tables.find(table => {
                    return table.innerText.includes('名次') && table.innerText.includes('股票名稱');
                });

                if (!targetTable) return [];

                // Get all rows
                const rows = Array.from(targetTable.querySelectorAll('tr'));

                // Filter for data rows. 
                // Data rows usually have a rank (number) in the first column.
                const dataRows = rows.filter(row => {
                    const cells = row.querySelectorAll('td');
                    if (cells.length < 5) return false;

                    // Check if first cell is a number (Rank)
                    const firstCellText = cells[0].innerText.trim();
                    return /^\d+$/.test(firstCellText);
                });

                return dataRows.map(row => {
                    const cells = Array.from(row.querySelectorAll('td'));
                    // Extract text from each cell
                    return cells.map(cell => cell.innerText.trim());
                });
            });

            const pageDate = await page.evaluate(() => {
                // Find text containing "日期："
                const bodyText = document.body.innerText;
                const match = bodyText.match(/日期：(\d{2}\/\d{2})/);
                if (match) {
                    return match[1];
                }
                return null;
            });

            console.log(`Extracted ${data.length} rows for ${target.name}. Date: ${pageDate}`);

            if (data.length > 0) {
                // Define headers based on the page: Rank, Name, Price, Change, ChangePercent, Buy, Sell, NetBuy
                // Note: The actual columns might need adjustment based on the exact table content.
                // Based on inspection: 名次, 股票名稱, 收盤價, 漲跌, 漲跌幅, 買進, 賣出, 買超
                const headers = ['Rank', 'Stock', 'Price', 'Change', 'ChangePercent', 'Buy', 'Sell', 'NetBuy'];

                const csvContent = [
                    headers.join(','),
                    ...data.map(row => {
                        // Ensure we have the right number of columns, or just join what we have
                        // Clean up data (remove commas in numbers if any)
                        return row.map(cell => {
                            // Remove commas from numbers like "33,766" -> "33766" for CSV safety, 
                            // or wrap in quotes. Let's wrap in quotes if it contains comma.
                            if (cell.includes(',')) return `"${cell}"`;
                            return cell;
                        }).join(',');
                    })
                ].join('\n');

                let dateStr;
                if (pageDate) {
                    // Convert MM/DD to YYYYMMDD
                    // Assume current year
                    const currentYear = new Date().getFullYear();
                    const [month, day] = pageDate.split('/');
                    dateStr = `${currentYear}${month}${day}`;
                } else {
                    // Fallback to current date if not found
                    dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
                }

                const dirPath = path.join(__dirname, '../data_fubon');
                if (!fs.existsSync(dirPath)) {
                    fs.mkdirSync(dirPath);
                }
                const filename = `fubon_${dateStr}_${target.name}.csv`;
                const filePath = path.join(dirPath, filename);

                fs.writeFileSync(filePath, csvContent, 'utf8');
                console.log(`✅ Successfully saved data to ${filename}`);
            } else {
                console.log(`❌ No data extracted for ${target.name}.`);
            }

            // Small pause between requests
            await page.waitForTimeout(1000);
        }

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await browser.close();
    }
})();
