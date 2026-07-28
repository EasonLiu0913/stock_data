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
        path: 'data_twse_twt49u',
        output: 'data_twse_twt49u/files.json',
        filter: file => /^\d{8}_twt49u\.json$/.test(file)
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
    },
    {
        path: 'data_market_news',
        output: 'data_market_news/files.json',
        recursive: true,
        filter: file => /^\d{8}\/market_news\.json$/.test(file)
    },
    {
        path: 'data_normalized',
        output: 'data_normalized/files.json',
        recursive: true,
        filter: file => /^(institutional_investors|broker_details)\/\d{8}\.json$/.test(file)
    },
    {
        path: 'data_external_market',
        output: 'data_external_market/files.json',
        recursive: true,
        filter: file => /^\d{8}\/external_market_indicators\.json$/.test(file)
    },
    {
        path: 'data_cnn_fear_and_greed',
        output: 'data_cnn_fear_and_greed/files.json',
        recursive: true,
        filter: file => /^\d{8}\/cnn_fear_and_greed\.json$/.test(file)
    },
    {
        path: 'data_market_risk',
        output: 'data_market_risk/files.json',
        recursive: true,
        filter: file => /^\d{8}\/market_risk_snapshot\.json$/.test(file)
    }
];

function listDataFiles(dirPath, recursive, basePath = dirPath) {
    if (!fs.existsSync(dirPath)) return [];
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });
    const files = [];
    for (const entry of entries) {
        const entryPath = path.join(dirPath, entry.name);
        if (entry.isDirectory()) {
            if (recursive) files.push(...listDataFiles(entryPath, recursive, basePath));
            continue;
        }
        if (!entry.isFile() || (!entry.name.endsWith('.csv') && !entry.name.endsWith('.json'))) continue;
        files.push(path.relative(basePath, entryPath).replaceAll(path.sep, '/'));
    }
    return files;
}

function parseOnly(argv) {
    const index = argv.indexOf('--only');
    if (index < 0) return null;
    const value = argv[index + 1] || '';
    const requested = value.split(',').map(item => item.trim()).filter(Boolean);
    if (!requested.length) throw new Error('--only requires a comma-separated directory or output list');
    return new Set(requested);
}

function selectDirectories(only) {
    if (!only) return directories;
    const known = new Set(directories.flatMap(item => [item.path, item.output]));
    const unknown = [...only].filter(item => !known.has(item));
    if (unknown.length) throw new Error(`Unknown file-list target(s): ${unknown.join(', ')}`);
    return directories.filter(item => only.has(item.path) || only.has(item.output));
}

function writeIfChanged(outputPath, files) {
    const content = JSON.stringify(files, null, 2);
    const previous = fs.existsSync(outputPath) ? fs.readFileSync(outputPath, 'utf8') : null;
    if (previous === content) return false;
    fs.writeFileSync(outputPath, content, 'utf8');
    return true;
}

const selectedDirectories = selectDirectories(parseOnly(process.argv.slice(2)));

selectedDirectories.forEach(dir => {
    const dirPath = path.join(__dirname, '..', dir.path);
    const outputPath = path.join(__dirname, '..', dir.output);
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });

    const files = fs.existsSync(dirPath)
        ? listDataFiles(dirPath, Boolean(dir.recursive)).filter(file => !dir.filter || dir.filter(file)).sort()
        : [];
    const changed = writeIfChanged(outputPath, files);
    console.log(`${changed ? '✅ Updated' : '➖ Unchanged'} ${dir.output} with ${files.length} files`);
});
