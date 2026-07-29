'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const {
    CSV_HEADER,
    buildRetryItem,
    hasCsvDataRows,
    normalizePendingRetries,
    retryKey
} = require('../scripts/scraper_json_driven');

function withTempDir(callback) {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'fubon-retry-'));
    return Promise.resolve(callback(directory)).finally(() => {
        fs.rmSync(directory, { recursive: true, force: true });
    });
}

test('header-only CSV is not considered completed', async () => {
    await withTempDir(async directory => {
        const file = path.join(directory, 'branch.csv');
        fs.writeFileSync(file, `${CSV_HEADER}\n`, 'utf8');
        assert.equal(hasCsvDataRows(file), false);

        fs.appendFileSync(file, '券商,1,分點,2,Buy,台積電,"1","2","1"\n', 'utf8');
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
