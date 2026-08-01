'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const {
    CSV_HEADER,
    FINALIZE_NO_DATA_AFTER_ATTEMPTS,
    buildRetryItem,
    buildValidNoDataItem,
    hasCsvDataRows,
    hasCsvHeader,
    normalizePendingRetries,
    normalizeValidNoData,
    retryKey,
    shouldFinalizeNoData
} = require('../scripts/scraper_json_driven');
const { validateCsvLines } = require('../scripts/check_fubon_brokers_trade');

function withTempDir(callback) {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'fubon-retry-'));
    return Promise.resolve(callback(directory)).finally(() => {
        fs.rmSync(directory, { recursive: true, force: true });
    });
}

test('header-only CSV has a valid header but no data rows', async () => {
    await withTempDir(async directory => {
        const file = path.join(directory, 'branch.csv');
        fs.writeFileSync(file, `${CSV_HEADER}\n`, 'utf8');
        assert.equal(hasCsvHeader(file), true);
        assert.equal(hasCsvDataRows(file), false);

        fs.appendFileSync(file, '券商,1,分點,2,Buy,台積電,"1","2","1"\n', 'utf8');
        assert.equal(hasCsvHeader(file), true);
        assert.equal(hasCsvDataRows(file), true);
    });
});

test('legacy failures are loaded into the persistent pending retry queue', () => {
    const queue = normalizePendingRetries({
        failures: [
            { brokerId: '9200', branchId: '9201', error: 'timeout' }
        ]
    });
    assert.equal(queue.size, 1);
    assert.equal(queue.get(retryKey('9200', '9201')).error, 'timeout');
});

test('retry item preserves first seen time and accumulates attempts', () => {
    const task = {
        brokerId: '9200',
        brokerName: '券商',
        branchId: '9201',
        branchName: '分點',
        filename: '券商_分點_20260729.csv',
        url: 'https://example.test'
    };
    const previous = {
        attempts: 3,
        firstSeenAt: '2026-07-29T10:00:00.000Z'
    };
    const item = buildRetryItem(task, previous, 'no_data_yet', '無此券商分點交易資料', 3);

    assert.equal(item.reason, 'no_data_yet');
    assert.equal(item.attempts, 6);
    assert.equal(item.firstSeenAt, previous.firstSeenAt);
    assert.ok(item.lastAttemptAt);
});

test('explicit no-data is finalized only after two retry rounds', () => {
    const firstRound = { reason: 'no_data_yet', attempts: FINALIZE_NO_DATA_AFTER_ATTEMPTS - 3 };
    const secondRound = { reason: 'no_data_yet', attempts: FINALIZE_NO_DATA_AFTER_ATTEMPTS };
    const timeout = { reason: 'request_error', attempts: FINALIZE_NO_DATA_AFTER_ATTEMPTS };

    assert.equal(shouldFinalizeNoData(firstRound), false);
    assert.equal(shouldFinalizeNoData(secondRound), true);
    assert.equal(shouldFinalizeNoData(timeout), false);
});

test('confirmed no-data branches are persisted separately from failures', () => {
    const task = {
        brokerId: '7000',
        brokerName: '兆豐證券',
        branchId: '7009',
        branchName: '兆豐-景美',
        filename: '兆豐證券_兆豐-景美_20260731.csv',
        url: 'https://example.test'
    };
    const retryItem = {
        reason: 'no_data_yet',
        error: '無此券商分點交易資料',
        attempts: 6,
        firstSeenAt: '2026-07-31T10:00:00.000Z',
        lastAttemptAt: '2026-07-31T12:00:00.000Z'
    };
    const item = buildValidNoDataItem(task, retryItem);
    const map = normalizeValidNoData({ validNoData: [item] });

    assert.equal(item.reason, 'valid_no_data');
    assert.equal(item.sourceReason, 'no_data_yet');
    assert.equal(map.size, 1);
    assert.equal(map.get(retryKey('7000', '7009')).attempts, 6);
});

test('checker accepts header-only CSV only when status confirms valid no-data', () => {
    const lines = [CSV_HEADER];
    assert.match(validateCsvLines(lines, false), /未被狀態檔標記/);
    assert.equal(validateCsvLines(lines, true), null);
    assert.equal(validateCsvLines([CSV_HEADER, 'row'], false), null);
});
