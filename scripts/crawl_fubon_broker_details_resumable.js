#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT_DIR = path.join(__dirname, '..');
const CRAWLER = path.join(__dirname, 'crawl_fubon_broker_details.js');
const DEFAULT_OUTPUT_DIR = path.join(ROOT_DIR, 'data_fubon_broker_details');
const DEFAULT_ROUNDS = 3;

function getArg(args, flag) {
    const index = args.indexOf(flag);
    return index >= 0 ? args[index + 1] : null;
}

function normalizeDate(value) {
    if (!value) return '';
    const match = String(value).match(/^(\d{4})[-/]?(\d{2})[-/]?(\d{2})$/);
    if (!match) return '';
    return `${match[1]}-${match[2]}-${match[3]}`;
}

function taipeiToday() {
    return new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Taipei',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    }).format(new Date());
}

function dateRange(start, end) {
    const dates = [];
    const cursor = new Date(`${start}T00:00:00Z`);
    const last = new Date(`${end}T00:00:00Z`);
    while (cursor <= last) {
        dates.push(cursor.toISOString().slice(0, 10));
        cursor.setUTCDate(cursor.getUTCDate() + 1);
    }
    return dates;
}

function resolveTargetDates(args) {
    const single = normalizeDate(getArg(args, '--date'));
    if (single) return [single];
    const start = normalizeDate(getArg(args, '--start'));
    let endValue = getArg(args, '--end');
    if (endValue === 'yesterday') {
        const date = new Date(`${taipeiToday()}T00:00:00Z`);
        date.setUTCDate(date.getUTCDate() - 1);
        endValue = date.toISOString().slice(0, 10);
    }
    const end = normalizeDate(endValue);
    if (start || end) return dateRange(start || end, end || start);
    return [taipeiToday()];
}

function outputPath(outputDir, isoDate) {
    return path.join(outputDir, `fubon_${isoDate.replaceAll('-', '')}_券商分點進出明細.json`);
}

function normalizePendingItem(item, kind, previous, now) {
    return {
        ...previous,
        ...item,
        status: 'pending',
        kind: item.kind || kind,
        attempts: Number(previous?.attempts || item.attempts || 0) + 1,
        firstSeenAt: previous?.firstSeenAt || item.firstSeenAt || now,
        lastAttemptAt: now
    };
}

function migratePayloadToRetryQueue(payload, now = new Date().toISOString()) {
    if (!payload || typeof payload !== 'object') return { changed: false, pendingCount: 0 };
    const pendingByCode = new Map();
    for (const item of payload.pendingStocks || []) {
        if (item?.code) pendingByCode.set(item.code, { ...item });
    }
    for (const item of payload.unavailableStocks || []) {
        if (!item?.code) continue;
        pendingByCode.set(
            item.code,
            normalizePendingItem(item, 'unavailable', pendingByCode.get(item.code), now)
        );
    }
    for (const item of payload.failedStocks || []) {
        if (!item?.code) continue;
        pendingByCode.set(
            item.code,
            normalizePendingItem(item, item.kind || 'failed', pendingByCode.get(item.code), now)
        );
    }

    // Successful stocks must never remain in the retry queue.
    for (const code of Object.keys(payload.stocks || {})) pendingByCode.delete(code);

    const pendingStocks = [...pendingByCode.values()].sort((a, b) =>
        a.code.localeCompare(b.code, 'en', { numeric: true })
    );
    const before = JSON.stringify({
        complete: payload.complete,
        unavailableStocks: payload.unavailableStocks,
        failedStocks: payload.failedStocks,
        pendingStocks: payload.pendingStocks
    });

    payload.pendingStocks = pendingStocks;
    payload.pendingStockCount = pendingStocks.length;
    // The legacy crawler retries failedStocks but treats unavailableStocks as completed.
    // Mirror every pending item into failedStocks and clear unavailableStocks.
    payload.failedStocks = pendingStocks.map(item => ({ ...item }));
    payload.failedStockCount = pendingStocks.length;
    payload.unavailableStocks = [];
    payload.unavailableStockCount = 0;
    payload.successfulStockCount = Object.keys(payload.stocks || {}).length;
    payload.complete = pendingStocks.length === 0
        && payload.successfulStockCount === payload.stockUniverse?.expectedStockCount;
    payload.generatedAt = now;

    const after = JSON.stringify({
        complete: payload.complete,
        unavailableStocks: payload.unavailableStocks,
        failedStocks: payload.failedStocks,
        pendingStocks: payload.pendingStocks
    });
    return { changed: before !== after, pendingCount: pendingStocks.length };
}

function migrateFile(filePath) {
    if (!fs.existsSync(filePath)) return { filePath, exists: false, pendingCount: 0 };
    const payload = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    const result = migratePayloadToRetryQueue(payload);
    if (result.changed) {
        const temporary = `${filePath}.tmp-${process.pid}`;
        fs.writeFileSync(temporary, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
        fs.renameSync(temporary, filePath);
    }
    return { filePath, exists: true, ...result };
}

function runCrawler(args) {
    return spawnSync(process.execPath, [CRAWLER, ...args], {
        cwd: ROOT_DIR,
        encoding: 'utf8',
        stdio: 'inherit'
    }).status ?? 1;
}

function removeFlag(args, flag) {
    return args.filter(value => value !== flag);
}

function main() {
    const args = process.argv.slice(2);
    if (args.includes('--check-only') || args.includes('--dry-run') || args.includes('--help') || args.includes('-h')) {
        process.exitCode = runCrawler(args);
        return;
    }

    const outputDir = path.resolve(getArg(args, '--output-dir') || DEFAULT_OUTPUT_DIR);
    const targetDates = resolveTargetDates(args);
    let roundArgs = [...args];
    let finalPending = 0;
    let lastStatus = 0;

    for (let round = 1; round <= DEFAULT_ROUNDS; round += 1) {
        console.log(`\n🔁 Fubon Broker Details retry round ${round}/${DEFAULT_ROUNDS}`);

        // Before every round, convert legacy unavailable entries to retryable failures.
        for (const date of targetDates) migrateFile(outputPath(outputDir, date));

        lastStatus = runCrawler(roundArgs);
        finalPending = 0;
        for (const date of targetDates) {
            const result = migrateFile(outputPath(outputDir, date));
            finalPending += result.pendingCount;
        }

        console.log(`🔁 Round ${round} remaining pending stocks: ${finalPending}`);
        if (finalPending === 0 && lastStatus === 0) break;

        // Force is only appropriate for the first round. Later rounds must preserve successes.
        roundArgs = removeFlag(roundArgs, '--force');
    }

    if (finalPending > 0 || lastStatus !== 0) {
        console.error(`❌ Fubon Broker Details still has ${finalPending} pending stocks after ${DEFAULT_ROUNDS} rounds.`);
        process.exitCode = 2;
    }
}

if (require.main === module) {
    try {
        main();
    } catch (error) {
        console.error(`❌ ${error.stack || error.message}`);
        process.exitCode = 1;
    }
}

module.exports = {
    migratePayloadToRetryQueue,
    normalizeDate,
    resolveTargetDates
};
