#!/usr/bin/env node

/**
 * 驗證 data_fubon_brokers_trade/YYYYMMDD 是否包含所有設定中的券商分點 CSV。
 *
 * 用法：
 *   node scripts/check_fubon_brokers_trade.js 20260722
 */

const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.join(__dirname, '..');
const BRANCHES_FILE = path.join(ROOT_DIR, 'config', 'broker_branches.json');
const NAMES_FILE = path.join(ROOT_DIR, 'config', 'broker_names.json');
const OUTPUT_ROOT = path.join(ROOT_DIR, 'data_fubon_brokers_trade');
const EXPECTED_HEADER =
    'BrokerName,BrokerID,BranchName,BranchID,Type,StockName,Amount,BuyAmount,SellAmount';

function getTargetDate(argv) {
    const date = argv.find(arg => /^\d{8}$/.test(arg));
    if (!date) {
        throw new Error('請指定日期，格式為 YYYYMMDD，例如 20260722');
    }
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

function firstLine(filePath) {
    const descriptor = fs.openSync(filePath, 'r');
    try {
        const buffer = Buffer.alloc(1024);
        const bytesRead = fs.readSync(descriptor, buffer, 0, buffer.length, 0);
        return buffer
            .subarray(0, bytesRead)
            .toString('utf8')
            .split(/\r?\n/, 1)[0]
            .replace(/^\uFEFF/, '');
    } finally {
        fs.closeSync(descriptor);
    }
}

function main() {
    const targetDate = getTargetDate(process.argv.slice(2));
    const outputDir = path.join(OUTPUT_ROOT, targetDate);
    const expected = expectedFiles(targetDate);

    if (!fs.existsSync(outputDir)) {
        throw new Error(`找不到日期資料夾：${path.relative(ROOT_DIR, outputDir)}`);
    }

    const actualCsvFiles = fs
        .readdirSync(outputDir)
        .filter(filename => filename.endsWith('.csv'));
    const expectedNames = new Set(expected.map(item => item.filename));
    const missing = [];
    const invalid = [];

    for (const item of expected) {
        const filePath = path.join(outputDir, item.filename);
        if (!fs.existsSync(filePath)) {
            missing.push({
                brokerId: item.brokerId,
                branchId: item.branchId,
                filename: item.filename
            });
            continue;
        }

        const stats = fs.statSync(filePath);
        if (!stats.isFile() || stats.size < EXPECTED_HEADER.length) {
            invalid.push({ filename: item.filename, reason: '檔案為空或不是一般檔案' });
            continue;
        }
        const header = firstLine(filePath);
        if (header !== EXPECTED_HEADER) {
            invalid.push({
                filename: item.filename,
                reason: `CSV header 不符：${header}`
            });
        }
    }

    const unexpected = actualCsvFiles.filter(filename => !expectedNames.has(filename));
    console.log(`📅 日期：${targetDate}`);
    console.log(`📋 預期分點：${expected.length}`);
    console.log(`📁 實際 CSV：${actualCsvFiles.length}`);
    console.log(`✅ 有效：${expected.length - missing.length - invalid.length}`);
    console.log(`❌ 缺少：${missing.length}；格式錯誤：${invalid.length}`);
    if (unexpected.length > 0) {
        console.log(`ℹ️ 額外 CSV：${unexpected.length}（不影響完整性）`);
    }

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
    if (missing.length > 0 || invalid.length > 0) {
        process.exitCode = 2;
    } else {
        console.log('✅ data_fubon_brokers_trade 完整性檢查通過');
    }
}

try {
    main();
} catch (error) {
    console.error(`❌ ${error.message}`);
    process.exitCode = 1;
}
