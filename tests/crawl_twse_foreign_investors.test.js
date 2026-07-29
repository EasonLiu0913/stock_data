'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const {
  buildRequestUrl,
  crawlDate,
  loadNonTradingDays,
  normalizeDateInput,
  rocDateToCompact,
  validatePayload,
} = require('../scripts/crawl_twse_foreign_investors');

function payload(overrides = {}) {
  return {
    stat: 'OK',
    date: '20260727',
    title: '115年07月27日 外資及陸資買賣超彙總表',
    fields: [
      '',
      '證券代號',
      '證券名稱',
      '買進股數',
      '賣出股數',
      '買賣超股數',
      '買進股數',
      '賣出股數',
      '買賣超股數',
      '買進股數',
      '賣出股數',
      '買賣超股數',
    ],
    groups: [
      { start: 0, span: 3, title: '' },
      { start: 3, span: 3, title: '外資及陸資(不含外資自營商)' },
      { start: 6, span: 3, title: '外資自營商' },
      { start: 9, span: 3, title: '外資及陸資' },
    ],
    data: [[
      ' ',
      '2330',
      '台積電',
      '1,000',
      '400',
      '600',
      '0',
      '0',
      '0',
      '1,000',
      '400',
      '600',
    ]],
    ...overrides,
  };
}

function withTemporaryDirectory(callback) {
  const directory = fs.mkdtempSync(
    path.join(os.tmpdir(), 'twse-foreign-investors-test-'),
  );
  return Promise.resolve(callback(directory)).finally(() => {
    fs.rmSync(directory, { recursive: true, force: true });
  });
}

test('normalizeDateInput validates supported formats and calendar dates', () => {
  assert.equal(normalizeDateInput('20260727'), '20260727');
  assert.equal(normalizeDateInput('2026-07-27'), '20260727');
  assert.equal(normalizeDateInput('2026/07/27'), '20260727');
  assert.throws(() => normalizeDateInput('20260230'), /Invalid calendar date/);
});

test('rocDateToCompact converts the ROC date in the TWSE title', () => {
  assert.equal(rocDateToCompact('115年07月27日'), '20260727');
});

test('buildRequestUrl uses the TWT38U endpoint and requested date', () => {
  const url = new URL(buildRequestUrl('20260727', 1785293947873));
  assert.equal(
    url.origin + url.pathname,
    'https://www.twse.com.tw/rwd/zh/fund/TWT38U',
  );
  assert.equal(url.searchParams.get('date'), '20260727');
  assert.equal(url.searchParams.get('response'), 'json');
  assert.equal(url.searchParams.get('_'), '1785293947873');
});

test('loadNonTradingDays fails closed when the requested year is missing', async () => {
  await withTemporaryDirectory(async (directory) => {
    const file = path.join(directory, 'non_trading_days.json');
    fs.writeFileSync(file, JSON.stringify({ 2026: ['2026/07/10'] }), 'utf8');

    assert.deepEqual(
      [...loadNonTradingDays(file, '2026')],
      ['2026/07/10'],
    );
    assert.throws(
      () => loadNonTradingDays(file, '2027'),
      /does not cover year 2027/,
    );
  });
});

test('validatePayload accepts a complete matching TWT38U response', () => {
  assert.doesNotThrow(
    () => validatePayload(payload(), '20260727', { minRows: 1 }),
  );
});

test('validatePayload rejects mismatched payload and title dates', () => {
  assert.throws(
    () => validatePayload(
      payload({ date: '20260728' }),
      '20260727',
      { minRows: 1 },
    ),
    /payload date 20260728/,
  );
  assert.throws(
    () => validatePayload(
      payload({ title: '115年07月28日 外資及陸資買賣超彙總表' }),
      '20260727',
      { minRows: 1 },
    ),
    /title date 20260728/,
  );
});

test('validatePayload rejects missing groups, empty data, and malformed rows', () => {
  assert.throws(
    () => validatePayload(payload({ groups: [] }), '20260727', { minRows: 1 }),
    /missing required group/,
  );
  assert.throws(
    () => validatePayload(payload({ data: [] }), '20260727', { minRows: 1 }),
    /too few rows/,
  );
  assert.throws(
    () => validatePayload(
      payload({ data: [[' ', '2330', '台積電']] }),
      '20260727',
      { minRows: 1 },
    ),
    /invalid row/,
  );
});

test('crawlDate skips a configured non-trading day without fetching', async () => {
  let fetchCalls = 0;
  const result = await crawlDate({
    targetDate: '20260710',
    outputDir: path.join(os.tmpdir(), 'unused-twt38u-output'),
    nonTradingDays: new Set(['2026/07/10']),
    fetchImpl: async () => {
      fetchCalls += 1;
      throw new Error('fetch should not run');
    },
    minRows: 1,
  });

  assert.equal(result.status, 'skipped-non-trading');
  assert.equal(fetchCalls, 0);
});

test('crawlDate skips a valid existing file without fetching', async () => {
  await withTemporaryDirectory(async (directory) => {
    const file = path.join(
      directory,
      '20260727_twse_foreign_investors.json',
    );
    fs.writeFileSync(file, `${JSON.stringify(payload(), null, 2)}\n`, 'utf8');
    let fetchCalls = 0;

    const result = await crawlDate({
      targetDate: '20260727',
      outputDir: directory,
      nonTradingDays: new Set(),
      fetchImpl: async () => {
        fetchCalls += 1;
        throw new Error('fetch should not run');
      },
      minRows: 1,
    });

    assert.equal(result.status, 'skipped-existing');
    assert.equal(fetchCalls, 0);
    assert.deepEqual(
      JSON.parse(fs.readFileSync(path.join(directory, 'files.json'), 'utf8')),
      ['20260727_twse_foreign_investors.json'],
    );
  });
});

test('crawlDate saves and verifies a matching response atomically', async () => {
  await withTemporaryDirectory(async (directory) => {
    const result = await crawlDate({
      targetDate: '20260727',
      outputDir: directory,
      nonTradingDays: new Set(),
      fetchImpl: async () => ({
        ok: true,
        status: 200,
        statusText: 'OK',
        json: async () => payload(),
      }),
      maxRetries: 0,
      retryCooldownMs: 0,
      minRows: 1,
    });

    assert.equal(result.status, 'created');
    assert.equal(result.rows, 1);
    assert.equal(
      JSON.parse(fs.readFileSync(result.outputPath, 'utf8')).date,
      '20260727',
    );
    assert.equal(
      fs.readdirSync(directory).some((file) => file.includes('.tmp-')),
      false,
    );
  });
});

test('crawlDate refuses to write a response for the wrong date', async () => {
  await withTemporaryDirectory(async (directory) => {
    await assert.rejects(
      () => crawlDate({
        targetDate: '20260727',
        outputDir: directory,
        nonTradingDays: new Set(),
        fetchImpl: async () => ({
          ok: true,
          status: 200,
          statusText: 'OK',
          json: async () => payload({ date: '20260728' }),
        }),
        maxRetries: 0,
        retryCooldownMs: 0,
        minRows: 1,
      }),
      /payload date 20260728/,
    );
    assert.equal(
      fs.existsSync(
        path.join(directory, '20260727_twse_foreign_investors.json'),
      ),
      false,
    );
  });
});
