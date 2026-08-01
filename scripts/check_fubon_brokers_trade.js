#!/usr/bin/env node

/**
 * 驗證 data_fubon_brokers_trade/YYYYMMDD 是否包含所有設定中的券商分點 CSV，
 * 並確認 _crawl-status.json 不再有 pendingRetries。
 * 經過兩輪明確確認的零交易分點，允許使用只有 header 的 CSV。
 */

const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.join(__dirname, '..');
const BRANCHES_FILE = path.join(ROOT_DIR, 'config', 'broker_branches.json');
const NAMES_FILE = path.join(ROOT_DIR, 'config', 'broker_names.json');
const OUTPUT_ROOT = path.join(ROOT_DIR, 'data_fubon_brokers_trade');
const EXPECTED_HEADER =
    'BrokerName,BrokerID,BranchName,BranchID,Type,StockName,Amount,BuyAmount,SellAmount';

function retryKey(brokerId, branchId) {
    return `${brokerId}:${branchId}`;
}

function getTargetDate(argv) {
    const date = argv.find(arg => /^\d{8}$/.test(arg));
    if (!date) throw new Error('請指定日期，格式為 YYYYMMDD，例如 20260722');
    return date;
}

function expectedFiles(targetDate) {
    const branches = JSON.parse(fs.readFileSync(BRANCHES_FILE, 'utf8'));
    const names = JSON.parse(fs.readFileSync(NAMES_FILE, 'utf8'));
    const files = [];
    for (const [brokerId, branchIds] of Object.entries(branches)) {
        const brokerName = names[brokerId] || brokerId;
        for (const branchId of branchIds) {
            const branchName = names[branchId] || branchId;
            files.push({
                brokerId,
                branchId,
                brokerName,
                branchName,
                filename: `${brokerName}_${branchName}_${targetDate}.csv`
            });
        }
    }
    return files;
}

function readNonEmptyLines(filePath) {
    return fs.readFileSync(filePath, 'utf8')
        .replace(/^\uFEFF/, '')
        .split(/\r?\n/)
        .filter(line => line.trim() !== '');
}

function loadCrawlStatus(outputDir) {
    const statusPath = path.join(outputDir, '_crawl-status.json');
    if (!fs.existsSync(statusPath)) {
        return {
            statusPath,
            pendingRetries: [],
            validNoData: [],
            error: '找不到 _crawl-status.json'
        };
    }
    try {
        const status = JSON.parse(fs.readFileSync(statusPath, 'utf8'));
        const pendingRetries = Array.isArray(status.pendingRetries)
            ? status.pendingRetries
            : Array.isArray(status.failures)
                ? status.failures
                : [];
        const validNoData = Array.isArray(status.validNoData) ? status.validNoData : [];
        return { statusPath, pendingRetries, validNoData, status, error: null };
    } catch (error) {
        return {
            statusPath,
            pendingRetries: [],
            validNoData: [],
            error: `狀態檔 JSON 無法解析：${error.message}`
        };
    }
}

function validateCsvLines(lines, allowHeaderOnly) {
    if (lines.length === 0 || lines[0] !== EXPECTED_HEADER) {
        return `CSV header 不符：${lines[0] || '(empty)'}`;
    }
    if (lines.length < 2 && !allowHeaderOnly) {
        return 'CSV 只有 header，且未被狀態檔標記為合法無交易';
    }
    return null;
}

function main() {
    const targetDate = getTargetDate(process.argv.slice(2));
    const outputDir = path.join(OUTPUT_ROOT, targetDate);
    const expected = expectedFiles(targetDate);
    if (!fs.existsSync(outputDir)) {
        throw new Error(`找不到日期資料夾：${path.relative(ROOT_DIR, outputDir)}`);
    }

    const crawlState = loadCrawlStatus(outputDir);
    const validNoDataKeys = new Set(
        crawlState.validNoData
            .filter(item => item?.brokerId && item?.branchId)
            .map(item => retryKey(item.brokerId, item.branchId))
    );
    const actualCsvFiles = fs.readdirSync(outputDir).filter(filename => filename.endsWith('.csv'));
    const expectedNames = new Set(expected.map(item => item.filename));
    const missing = [];
    const invalid = [];
    let completedDataCount = 0;
    let validNoDataCount = 0;

    for (const item of expected) {
        const filePath = path.join(outputDir, item.filename);
        if (!fs.existsSync(filePath)) {
            missing.push({ brokerId: item.brokerId, branchId: item.branchId, filename: item.filename });
            continue;
        }

        const stats = fs.statSync(filePath);
        if (!stats.isFile()) {
            invalid.push({ filename: item.filename, reason: '不是一般檔案' });
            continue;
        }

        const lines = readNonEmptyLines(filePath);
        const key = retryKey(item.brokerId, item.branchId);
        const allowHeaderOnly = validNoDataKeys.has(key);
        const validationError = validateCsvLines(lines, allowHeaderOnly);
        if (validationError) {
            invalid.push({ filename: item.filename, reason: validationError });
            continue;
        }

        if (lines.length > 1) completedDataCount += 1;
        else validNoDataCount += 1;
    }

    const unexpected = actualCsvFiles.filter(filename => !expectedNames.has(filename));
    const validCount = expected.length - missing.length - invalid.length;

    console.log(`📅 日期：${targetDate}`);
    console.log(`📋 預期分點：${expected.length}`);
    console.log(`📁 實際 CSV：${actualCsvFiles.length}`);
    console.log(`✅ 有效：${validCount}`);
    console.log(`   ├─ 有交易資料：${completedDataCount}`);
    console.log(`   └─ 合法無交易：${validNoDataCount}`);
    console.log(`❌ 缺少：${missing.length}；格式錯誤：${invalid.length}`);
    console.log(`🔁 待重試：${crawlState.pendingRetries.length}`);
    if (unexpected.length > 0) console.log(`ℹ️ 額外 CSV：${unexpected.length}（不影響完整性）`);

    if (missing.length > 0) {
        console.error('\n缺少檔案（最多顯示 30 筆）：');
        missing.slice(0, 30).forEach(item =>
            console.error(`  ${item.brokerId}/${item.branchId}: ${item.filename}`)
        );
    }
    if (invalid.length > 0) {
        console.error('\n格式錯誤（最多顯示 30 筆）：');
        invalid.slice(0, 30).forEach(item =>
            console.error(`  ${item.filename}: ${item.reason}`)
        );
    }
    if (crawlState.error) {
        console.error(`\n狀態檔錯誤：${crawlState.error}`);
    }
    if (crawlState.pendingRetries.length > 0) {
        console.error('\n待重試分點（最多顯示 30 筆）：');
        crawlState.pendingRetries.slice(0, 30).forEach(item =>
            console.error(
                `  ${item.brokerId}/${item.branchId} ${item.brokerName || ''}/${item.branchName || ''}: ` +
                `${item.reason || 'unknown'} - ${item.error || ''}`
            )
        );
    }

    if (
        missing.length > 0
        || invalid.length > 0
        || crawlState.pendingRetries.length > 0
        || crawlState.error
    ) {
        process.exitCode = 2;
    } else {
        console.log('✅ data_fubon_brokers_trade 完整性檢查通過，包含已確認的合法無交易分點');
    }
}

if (require.main === module) {
    try {
        main();
    } catch (error) {
        console.error(`❌ ${error.message}`);
        process.exitCode = 1;
    }
}

module.exports = {
    EXPECTED_HEADER,
    loadCrawlStatus,
    retryKey,
    validateCsvLines
};
