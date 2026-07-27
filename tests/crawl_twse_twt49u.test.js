'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const {
  buildRequestUrl,
  fetchTwseTwt49uOnce,
  normalizeDateInput,
  refreshFilesJson,
  rocDateToCompact,
  validatePayload,
} = require('../scripts/crawl_twse_twt49u');

function payload(overrides = {}) {
  return {
    stat: 'OK',
    title: '115年07月27日 至 115年07月27日 除權除息計算結果表',
    fields: ['資料日期', '股票代號', '股票名稱', '漲停價格', '跌停價格', '開盤競價基準'],
    data: [['115年07月27日', '1530', '亞崴', '35.00', '28.70', '31.85']],
    ...overrides,
  };
}

test('normalizeDateInput accepts supported formats and rejects invalid calendar dates', () => {
  assert.equal(normalizeDateInput('20260727'), '20260727');
  assert.equal(normalizeDateInput('2026-07-27'), '20260727');
  assert.equal(normalizeDateInput('2026/07/27'), '20260727');
  assert.throws(() => normalizeDateInput('20260230'), /Invalid calendar date/);
});

test('rocDateToCompact converts TWSE ROC dates', () => {
  assert.equal(rocDateToCompact('115年07月27日'), '20260727');
  assert.equal(rocDateToCompact('115/7/27'), '20260727');
});

test('buildRequestUrl fixes start and end to the requested date', () => {
  const url = new URL(buildRequestUrl('20260727', 1785147591948));
  assert.equal(url.origin + url.pathname, 'https://www.twse.com.tw/rwd/zh/exRight/TWT49U');
  assert.equal(url.searchParams.get('startDate'), '20260727');
  assert.equal(url.searchParams.get('endDate'), '20260727');
  assert.equal(url.searchParams.get('response'), 'json');
  assert.equal(url.searchParams.get('_'), '1785147591948');
});

test('validatePayload accepts matching rows and allows a valid empty trading-date result', () => {
  assert.doesNotThrow(() => validatePayload(payload(), '20260727'));
  assert.doesNotThrow(() => validatePayload(payload({ data: [] }), '20260727'));
});

test('validatePayload rejects wrong dates and missing replay fields', () => {
  assert.throws(
    () => validatePayload(payload({ data: [['115年07月28日', '1530']] }), '20260727'),
    /returned row date 20260728/,
  );
  assert.throws(
    () => validatePayload(payload({ fields: ['資料日期', '股票代號'], data: [] }), '20260727'),
    /missing required field: 漲停價格/,
  );
});

test('fetchTwseTwt49uOnce uses the TWSE endpoint and validates its response', async () => {
  let requestedUrl = '';
  const result = await fetchTwseTwt49uOnce('20260727', async (url) => {
    requestedUrl = url;
    return {
      ok: true,
      json: async () => payload(),
    };
  });

  assert.equal(new URL(requestedUrl).searchParams.get('startDate'), '20260727');
  assert.equal(result.data.length, 1);
});

test('refreshFilesJson stores sorted date-formatted archive filenames only', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'twt49u-test-'));
  try {
    fs.writeFileSync(path.join(directory, '20260728_twt49u.json'), '{}');
    fs.writeFileSync(path.join(directory, '20260727_twt49u.json'), '{}');
    fs.writeFileSync(path.join(directory, 'result.json'), '{}');

    const outputPath = refreshFilesJson(directory);
    assert.deepEqual(JSON.parse(fs.readFileSync(outputPath, 'utf8')), [
      '20260727_twt49u.json',
      '20260728_twt49u.json',
    ]);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});
