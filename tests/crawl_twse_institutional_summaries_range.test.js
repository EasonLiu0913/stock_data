'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const investmentTrust = require('../scripts/crawl_twse_investment_trust');
const {
  crawlRange,
  enumerateDates,
  loadNonTradingDaysForRange,
  randomDelay,
  validateRange,
} = require('../scripts/crawl_twse_institutional_summaries_range');

function trustPayload() {
  return {
    stat: 'OK',
    date: '20260727',
    title: '115年07月27日 投信買賣超彙總表',
    fields: [
      '',
      '證券代號',
      '證券名稱',
      '買進股數',
      '賣出股數',
      '買賣超股數',
    ],
    data: [[' ', '2885', '元大金', '100', '40', '60']],
  };
}

function withTemporaryDirectory(callback) {
  const directory = fs.mkdtempSync(
    path.join(os.tmpdir(), 'twse-institutional-range-test-'),
  );
  return Promise.resolve(callback(directory)).finally(() => {
    fs.rmSync(directory, { recursive: true, force: true });
  });
}

function stubDataset(endpointId, status, calls) {
  return {
    endpointId,
    label: endpointId,
    crawler: {
      async crawlDate(options) {
        calls.push(`${endpointId}:${options.targetDate}`);
        if (status === 'created') {
          await options.beforeFetch({
            endpointId,
            targetDate: options.targetDate,
          });
        }
        return { status };
      },
      refreshFilesJson() {},
    },
  };
}

test('enumerateDates includes both boundaries across month changes', () => {
  assert.deepEqual(
    enumerateDates('20260730', '20260802'),
    ['20260730', '20260731', '20260801', '20260802'],
  );
});

test('validateRange checks real dates, ordering, future dates, and max days', () => {
  assert.deepEqual(
    validateRange({
      start: '20260727',
      end: '20260729',
      today: '20260729',
      maxDays: 3,
    }).dates,
    ['20260727', '20260728', '20260729'],
  );
  assert.throws(
    () => validateRange({
      start: '20260230',
      end: '20260301',
      today: '20260729',
    }),
    /Invalid calendar date/,
  );
  assert.throws(
    () => validateRange({
      start: '20260729',
      end: '20260727',
      today: '20260729',
    }),
    /is after end date/,
  );
  assert.throws(
    () => validateRange({
      start: '20260729',
      end: '20260730',
      today: '20260729',
    }),
    /after Taipei today/,
  );
  assert.throws(
    () => validateRange({
      start: '20260727',
      end: '20260729',
      today: '20260729',
      maxDays: 2,
    }),
    /exceeding --max-days/,
  );
});

test('randomDelay validates bounds and includes configured endpoints', () => {
  assert.equal(randomDelay(3000, 5000, () => 0), 3000);
  assert.equal(randomDelay(3000, 5000, () => 0.999999), 5000);
  assert.throws(() => randomDelay(5000, 3000), /Invalid delay range/);
  assert.throws(() => randomDelay(0, 300001), /exceeds safety limit/);
});

test('range calendar remains optional when requested years are uncovered', async () => {
  await withTemporaryDirectory(async (directory) => {
    const file = path.join(directory, 'non_trading_days.json');
    fs.writeFileSync(
      file,
      JSON.stringify({ 2026: ['2026/07/10'] }),
      'utf8',
    );

    assert.deepEqual(
      [...loadNonTradingDaysForRange('20250101', '20261231', file)],
      ['2026/07/10'],
    );
  });
});

test('crawlRange skips weekends and holidays and delays only between requests', async () => {
  const calls = [];
  const delays = [];
  const datasets = [
    stubDataset('TWT38U', 'created', calls),
    stubDataset('TWT44U', 'skipped-existing', calls),
    stubDataset('TWT43U', 'created', calls),
  ];

  const summary = await crawlRange({
    dates: ['20260724', '20260725', '20260726', '20260727'],
    nonTradingDays: new Set(['2026/07/24']),
    datasets,
    minDelayMs: 3000,
    maxDelayMs: 5000,
    randomFn: () => 0,
    sleepImpl: async (milliseconds) => delays.push(milliseconds),
    logger: { log() {}, error() {} },
  });

  assert.deepEqual(calls, [
    'TWT38U:20260727',
    'TWT44U:20260727',
    'TWT43U:20260727',
  ]);
  assert.deepEqual(delays, [3000]);
  assert.equal(summary.created, 2);
  assert.equal(summary.existing, 1);
  assert.equal(summary.skippedNonTradingDates, 3);
  assert.equal(summary.networkRequests, 2);
});

test('crawlRange records a failed dataset and continues the range', async () => {
  const calls = [];
  const datasets = [
    {
      endpointId: 'TWT38U',
      label: '外資及陸資',
      crawler: {
        async crawlDate(options) {
          calls.push(`fail:${options.targetDate}`);
          throw new Error('simulated failure');
        },
        refreshFilesJson() {},
      },
    },
    stubDataset('TWT44U', 'skipped-existing', calls),
  ];

  const summary = await crawlRange({
    dates: ['20260727', '20260728'],
    nonTradingDays: new Set(),
    datasets,
    minDelayMs: 0,
    maxDelayMs: 0,
    sleepImpl: async () => {},
    logger: { log() {}, error() {} },
  });

  assert.equal(summary.failures.length, 2);
  assert.equal(summary.existing, 2);
  assert.deepEqual(calls, [
    'fail:20260727',
    'TWT44U:20260727',
    'fail:20260728',
    'TWT44U:20260728',
  ]);
});

test('beforeFetch runs for a missing file but not for a valid existing file', async () => {
  await withTemporaryDirectory(async (directory) => {
    let beforeFetchCalls = 0;
    const options = {
      targetDate: '20260727',
      outputDir: directory,
      nonTradingDays: new Set(),
      beforeFetch: async () => {
        beforeFetchCalls += 1;
      },
      fetchImpl: async () => ({
        ok: true,
        status: 200,
        statusText: 'OK',
        json: async () => trustPayload(),
      }),
      maxRetries: 0,
      retryCooldownMs: 0,
      minRows: 1,
    };

    const created = await investmentTrust.crawlDate(options);
    const existing = await investmentTrust.crawlDate(options);

    assert.equal(created.status, 'created');
    assert.equal(existing.status, 'skipped-existing');
    assert.equal(beforeFetchCalls, 1);
  });
});
