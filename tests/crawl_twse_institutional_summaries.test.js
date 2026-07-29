'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const investmentTrust = require('../scripts/crawl_twse_investment_trust');
const dealers = require('../scripts/crawl_twse_dealers');

function trustPayload(overrides = {}) {
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
    data: [[
      ' ',
      '2885',
      '元大金',
      '6,591,404',
      '85,000',
      '6,506,404',
    ]],
    ...overrides,
  };
}

function dealerPayload(overrides = {}) {
  return {
    stat: 'OK',
    date: '20260727',
    title: '115年07月27日 自營商買賣超彙總表',
    fields: [
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
      { start: 0, span: 1, title: '' },
      { start: 1, span: 1, title: '' },
      { start: 2, span: 3, title: '自營商(自行買賣)' },
      { start: 5, span: 3, title: '自營商(避險)' },
      { start: 8, span: 3, title: '自營商' },
    ],
    data: [[
      '00632R',
      '元大台灣50反1',
      '2,492,000',
      '1,350,000',
      '1,142,000',
      '82,229,413',
      '17,510,939',
      '64,718,474',
      '84,721,413',
      '18,860,939',
      '65,860,474',
    ]],
    ...overrides,
  };
}

function withTemporaryDirectory(callback) {
  const directory = fs.mkdtempSync(
    path.join(os.tmpdir(), 'twse-institutional-summary-test-'),
  );
  return Promise.resolve(callback(directory)).finally(() => {
    fs.rmSync(directory, { recursive: true, force: true });
  });
}

test('TWT44U request URL contains the selected date and cache buster', () => {
  const url = new URL(
    investmentTrust.buildRequestUrl('20260727', 1785294633147),
  );
  assert.equal(
    url.origin + url.pathname,
    'https://www.twse.com.tw/rwd/zh/fund/TWT44U',
  );
  assert.equal(url.searchParams.get('date'), '20260727');
  assert.equal(url.searchParams.get('response'), 'json');
  assert.equal(url.searchParams.get('_'), '1785294633147');
});

test('TWT43U request URL contains the selected date and cache buster', () => {
  const url = new URL(dealers.buildRequestUrl('20260727', 1785294766819));
  assert.equal(
    url.origin + url.pathname,
    'https://www.twse.com.tw/rwd/zh/fund/TWT43U',
  );
  assert.equal(url.searchParams.get('date'), '20260727');
  assert.equal(url.searchParams.get('response'), 'json');
  assert.equal(url.searchParams.get('_'), '1785294766819');
});

test('TWT44U accepts its six-column payload without a groups field', () => {
  assert.doesNotThrow(
    () => investmentTrust.validatePayload(
      trustPayload(),
      '20260727',
      { minRows: 1 },
    ),
  );
});

test('TWT43U requires self-trading, hedging, and total groups', () => {
  assert.doesNotThrow(
    () => dealers.validatePayload(
      dealerPayload(),
      '20260727',
      { minRows: 1 },
    ),
  );
  assert.throws(
    () => dealers.validatePayload(
      dealerPayload({ groups: [] }),
      '20260727',
      { minRows: 1 },
    ),
    /missing required group/,
  );
});

test('both reports reject inconsistent buy, sell, and net values', () => {
  const invalidTrustRow = [...trustPayload().data[0]];
  invalidTrustRow[5] = '1';
  assert.throws(
    () => investmentTrust.validatePayload(
      trustPayload({ data: [invalidTrustRow] }),
      '20260727',
      { minRows: 1 },
    ),
    /inconsistent buy\/sell\/net/,
  );

  const invalidDealerRow = [...dealerPayload().data[0]];
  invalidDealerRow[10] = '1';
  assert.throws(
    () => dealers.validatePayload(
      dealerPayload({ data: [invalidDealerRow] }),
      '20260727',
      { minRows: 1 },
    ),
    /inconsistent buy\/sell\/net/,
  );
});

test('TWT44U skips a valid existing file before any request', async () => {
  await withTemporaryDirectory(async (directory) => {
    const outputPath = path.join(
      directory,
      '20260727_twse_investment_trust.json',
    );
    fs.writeFileSync(
      outputPath,
      `${JSON.stringify(trustPayload(), null, 2)}\n`,
      'utf8',
    );
    let fetchCalls = 0;

    const result = await investmentTrust.crawlDate({
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
      ['20260727_twse_investment_trust.json'],
    );
  });
});

test('TWT43U skips weekends before any request', async () => {
  let fetchCalls = 0;
  const result = await dealers.crawlDate({
    targetDate: '20260725',
    outputDir: path.join(os.tmpdir(), 'unused-twt43u-output'),
    nonTradingDays: new Set(),
    fetchImpl: async () => {
      fetchCalls += 1;
      throw new Error('fetch should not run');
    },
    minRows: 1,
  });

  assert.equal(result.status, 'skipped-non-trading');
  assert.equal(fetchCalls, 0);
});

test('TWT43U writes only a matching, validated response', async () => {
  await withTemporaryDirectory(async (directory) => {
    const result = await dealers.crawlDate({
      targetDate: '20260727',
      outputDir: directory,
      nonTradingDays: new Set(),
      fetchImpl: async () => ({
        ok: true,
        status: 200,
        statusText: 'OK',
        json: async () => dealerPayload(),
      }),
      maxRetries: 0,
      retryCooldownMs: 0,
      minRows: 1,
    });

    assert.equal(result.status, 'created');
    assert.equal(result.rows, 1);
    assert.equal(
      path.basename(result.outputPath),
      '20260727_twse_dealers.json',
    );
    assert.equal(
      fs.readdirSync(directory).some((file) => file.includes('.tmp-')),
      false,
    );
  });
});
