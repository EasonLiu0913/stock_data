'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
    migratePayloadToRetryQueue,
    resolveTargetDates
} = require('../scripts/crawl_fubon_broker_details_resumable');

test('unavailable and failed stocks become retryable before the final round', () => {
    const payload = {
        complete: true,
        generatedAt: '2026-07-29T10:00:00.000Z',
        stockUniverse: { expectedStockCount: 3 },
        stocks: { '2330': { stockCode: '2330' } },
        unavailableStocks: [{ code: '2317', reason: '該日期無分點資料' }],
        failedStocks: [{ code: '2454', error: 'timeout' }]
    };

    const result = migratePayloadToRetryQueue(payload, '2026-07-29T12:00:00.000Z');
    assert.equal(result.pendingCount, 2);
    assert.equal(payload.complete, false);
    assert.equal(payload.unavailableStocks.length, 0);
    assert.equal(payload.failedStocks.length, 2);
    assert.equal(payload.pendingStocks.length, 2);
    assert.equal(payload.pendingStocks.find(item => item.code === '2317').kind, 'unavailable');
});

test('final round accepts stable unavailable stocks as accounted for', () => {
    const payload = {
        complete: false,
        stockUniverse: { expectedStockCount: 2 },
        stocks: { '2330': { stockCode: '2330' } },
        unavailableStocks: [],
        failedStocks: [{
            code: '2317',
            reason: '該日期無分點資料',
            kind: 'unavailable',
            attempts: 4
        }],
        pendingStocks: [{
            code: '2317',
            reason: '該日期無分點資料',
            kind: 'unavailable',
            attempts: 4
        }]
    };

    const result = migratePayloadToRetryQueue(
        payload,
        '2026-07-29T12:00:00.000Z',
        { finalizeUnavailable: true }
    );
    assert.equal(result.pendingCount, 0);
    assert.equal(payload.complete, true);
    assert.equal(payload.failedStockCount, 0);
    assert.equal(payload.failedStocks.length, 0);
    assert.equal(payload.pendingStocks.length, 0);
    assert.equal(payload.unavailableStockCount, 1);
    assert.equal(payload.unavailableStocks[0].status, 'unavailable');
    assert.equal(payload.unavailableStocks[0].attempts, 5);
});

test('final round keeps technical failures pending', () => {
    const payload = {
        complete: false,
        stockUniverse: { expectedStockCount: 2 },
        stocks: { '2330': { stockCode: '2330' } },
        unavailableStocks: [],
        failedStocks: [{ code: '2454', error: 'timeout', kind: 'failed', attempts: 2 }],
        pendingStocks: []
    };

    const result = migratePayloadToRetryQueue(
        payload,
        '2026-07-29T12:00:00.000Z',
        { finalizeUnavailable: true }
    );
    assert.equal(result.pendingCount, 1);
    assert.equal(payload.complete, false);
    assert.equal(payload.failedStocks[0].code, '2454');
    assert.equal(payload.unavailableStocks.length, 0);
});

test('successful stock is removed from a previous pending queue', () => {
    const payload = {
        complete: false,
        stockUniverse: { expectedStockCount: 1 },
        stocks: { '2330': { stockCode: '2330' } },
        pendingStocks: [{ code: '2330', kind: 'unavailable', attempts: 3 }],
        unavailableStocks: [],
        failedStocks: []
    };

    const result = migratePayloadToRetryQueue(payload, '2026-07-29T12:00:00.000Z');
    assert.equal(result.pendingCount, 0);
    assert.equal(payload.complete, true);
    assert.equal(payload.failedStocks.length, 0);
});

test('date arguments are resolved for a range', () => {
    assert.deepEqual(
        resolveTargetDates(['--start', '2026-07-27', '--end', '2026-07-29']),
        ['2026-07-27', '2026-07-28', '2026-07-29']
    );
});
