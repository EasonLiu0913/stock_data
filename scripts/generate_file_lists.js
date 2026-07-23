const fs = require('fs');
const path = require('path');

const directories = [
    { path: 'data_fubon', output: 'data_fubon/files.json' },
    {
        path: 'data_fubon_broker_details',
        output: 'data_fubon_broker_details/files.json',
        filter: file => /^fubon_\d{8}_券商分點進出明細\.json$/.test(file)
    },
    { path: 'data_twse', output: 'data_twse/files.json' },
    {
        path: 'data_twse_foreign_investors',
        output: 'data_twse_foreign_investors/files.json',
        filter: file => /^\d{8}_twse_foreign_investors\.json$/.test(file)
    },
    {
        path: 'data_twse_dealers',
        output: 'data_twse_dealers/files.json',
        filter: file => /^\d{8}_twse_dealers\.json$/.test(file)
    },
    {
        path: 'data_twse_institutional_investors',
        output: 'data_twse_institutional_investors/files.json',
        filter: file => /^\d{8}_twse_institutional_investors\.json$/.test(file)
    },
    {
        path: 'data_twse_mi_index',
        output: 'data_twse_mi_index/files.json',
        filter: file => /^\d{8}_twse_mi_index\.json$/.test(file)
    },
    {
        path: 'data_taifex_major_institutional_traders_futures_options',
        output: 'data_taifex_major_institutional_traders_futures_options/files.json',
        filter: file => /^\d{8}_taifex_major_institutional_traders_futures_options\.csv$/.test(file)
    },
    {
        path: 'data_twse_margin_balance',
        output: 'data_twse_margin_balance/files.json',
        filter: file => /^\d{8}_twse_margin_balance\.csv$/.test(file)
    },
    {
        path: 'data_twse_margin_maintenance',
        output: 'data_twse_margin_maintenance/files.json',
        filter: file => /^\d{8}_twse_margin_maintenance\.json$/.test(file)
    },
    {
        path: 'data_tpex_margin_balance',
        output: 'data_tpex_margin_balance/files.json',
        filter: file => /^\d{8}_tpex_margin_balance\.json$/.test(file)
    },
    {
        path: 'data_tpex_etf_list',
        output: 'data_tpex_etf_list/files.json',
        filter: file => /^\d{6}_tpex_etf_list\.json$/.test(file)
    },
    {
        path: 'data_tpex_daily_quotes',
        output: 'data_tpex_daily_quotes/files.json',
        filter: file => /^\d{8}_tpex_daily_quotes\.json$/.test(file)
    },
    {
        path: 'data_macromicro_twse_margin_maintenance',
        output: 'data_macromicro_twse_margin_maintenance/files.json',
        filter: file => /^\d{8}_macromicro_twse_margin_maintenance\.json$/.test(file)
    }
];

directories.forEach(dir => {
    const dirPath = path.join(__dirname, '..', dir.path);
    const outputPath = path.join(__dirname, '..', dir.output);
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });

    if (fs.existsSync(dirPath)) {
        const files = fs.readdirSync(dirPath)
            .filter(file => file.endsWith('.csv') || file.endsWith('.json'))
            .filter(file => !dir.filter || dir.filter(file));
        fs.writeFileSync(outputPath, JSON.stringify(files, null, 2));
        console.log(`✅ Generated ${dir.output} with ${files.length} files`);
    } else {
        console.log(`⚠️ Directory ${dir.path} does not exist`);
        // Write empty array if dir doesn't exist
        fs.writeFileSync(outputPath, JSON.stringify([], null, 2));
    }
});
