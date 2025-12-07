// ========================================
// WantGoo Stock Data Extractor
// ========================================
// Instructions:
// 1. Open https://www.wantgoo.com/stock/major-investors/net-buy-sell-rank?market=Listed
// 2. Select "近15日" (Last 15 days) from the dropdown
// 3. Wait for the table to load with data
// 4. Open browser console (F12 → Console tab)
// 5. Paste this entire script and press Enter
// 6. The CSV file will automatically download
// ========================================

(async function () {
    console.log('🚀 Starting WantGoo data extraction...');

    const selectElement1 = document.getElementById('markets');
    selectElement1.value = 'Listed';
    await selectElement1.dispatchEvent(new Event('change'));

    setTimeout(() => {
        const selectElement2 = document.getElementById('selectOrderByDays');
        selectElement2.value = '15';
        selectElement2.dispatchEvent(new Event('change'));
    }, 599);

    setTimeout(() => {
        // Find the table
        const table = document.querySelector('table#netBuyRank');

        if (!table) {
            console.error('❌ Table #netBuyRank not found!');
            return;
        }

        console.log('✅ Found table #netBuyRank');

        // Extract rows
        const rows = Array.from(table.querySelectorAll('tbody tr'));
        console.log(`📊 Total rows in table: ${rows.length}`);

        // Filter out empty rows
        const validRows = rows.filter(tr => {
            const cells = Array.from(tr.querySelectorAll('td'));
            const hasContent = cells.some(td => td.innerText.trim() !== '');
            return hasContent && cells.length > 0;
        });

        console.log(`✅ Valid rows with data: ${validRows.length}`);

        if (validRows.length === 0) {
            console.error('❌ No data found in table. Make sure the data has loaded!');
            return;
        }

        // Extract top 10 rows
        const top50 = validRows.slice(0, 50);
        const data = top50.map(tr => {
            const cols = Array.from(tr.querySelectorAll('td'));
            return cols.map(td => td.innerText.trim());
        });

        console.log(`📋 Extracted top ${data.length} stocks`);

        // Define headers
        const headers = ['Rank', 'Stock', 'NetBuy_Today', 'NetBuy_15Days', 'Price', 'Change', 'Volume'];

        // Convert to CSV
        const csvRows = [
            headers.join(','),
            ...data.map(row => {
                // Take first 7 columns and escape commas
                const cleanRow = row.slice(0, 7).map(cell => {
                    // Escape cells that contain commas
                    if (cell.includes(',')) {
                        return `"${cell}"`;
                    }
                    return cell;
                });
                return cleanRow.join(',');
            })
        ];

        const csvContent = csvRows.join('\n');

        // Create filename with today's date
        const today = new Date();
        const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');
        const filename = `stock_data_${dateStr}.csv`;

        // Create download link
        const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);

        link.setAttribute('href', url);
        link.setAttribute('download', filename);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        console.log(`✅ Downloaded: ${filename}`);
        console.log('\n📊 Preview of extracted data:');
        console.table(data.map((row, i) => ({
            Rank: row[0],
            Stock: row[1],
            NetBuy_Today: row[2],
            NetBuy_15Days: row[3],
            Price: row[4],
            Change: row[5],
            Volume: row[6]
        })));

        console.log('\n✅ Done! Check your Downloads folder for the CSV file.');
    }, 1000);
})();
