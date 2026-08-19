'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const {
  crawlDate,
  validatePayload,
} = require('../scripts/crawl_twse_dealers');

function payload(overrides = {}) {
  return {
    stat: 'OK',
    date: '20260819',
    title: '115年08月19日 自營商買賣超彙總表',
    fields: [
      '證券代號',
      '證券名稱',
      '買進股數(自行買賣)',
      '賣出股數(自行買賣)',
      '買賣超股數(自行買賣)',
      '買進股數(避險)',
      '賣出股數(避險)',
      '買賣超股數(避險)',
      '買進股數(合計)',
      '賣出股數(合計)',
      '買賣超股數(合計)',
    ],
    groups: [
      { start: 2, span: 3, title: '自營商(自行買賣)' },
      { start: 5, span: 3, title: '自營商(避險)' },
      { start: 8, span: 3, title: '自營商' },
    ],
    data: [[
      '2330',
      '台積電',
      '1,000',
      '400',
      '600',
      '300',
      '100',
      '200',
      '1,300',
      '500',
      '800',
    ]],
    ...overrides,
  };
}

function withTemporaryDirectory(callback) {
  const directory = fs.mkdtempSync(
    path.join(os.tmpdir(), 'twse-dealers-test-'),
  );
  return Promise.resolve(callback(directory)).finally(() => {
    fs.rmSync(directory, { recursive: true, force: true });
  });
}

test('validatePayload accepts a complete matching TWT43U response', () => {
  assert.doesNotThrow(
    () => validatePayload(payload(), '20260819', { minRows: 1 }),
  );
});

test('crawlDate replaces an empty existing dealer file and fetches again', async () => {
  await withTemporaryDirectory(async (directory) => {
    const file = path.join(directory, '20260819_twse_dealers.json');
    fs.writeFileSync(file, '', 'utf8');
    let fetchCalls = 0;

    const result = await crawlDate({
      targetDate: '20260819',
      outputDir: directory,
      nonTradingDays: new Set(),
      fetchImpl: async () => {
        fetchCalls += 1;
        return {
          ok: true,
          status: 200,
          statusText: 'OK',
          json: async () => payload(),
        };
      },
      maxRetries: 0,
      retryCooldownMs: 0,
      minRows: 1,
    });

    assert.equal(fetchCalls, 1);
    assert.equal(result.status, 'created');
    assert.equal(result.replaced_invalid_existing, true);
    assert.equal(JSON.parse(fs.readFileSync(file, 'utf8')).date, '20260819');
    assert.equal(
      fs.readdirSync(directory).some((name) => name.includes('invalid-backup')),
      false,
    );
  });
});

test('crawlDate preserves the invalid file when the replacement fetch fails', async () => {
  await withTemporaryDirectory(async (directory) => {
    const file = path.join(directory, '20260819_twse_dealers.json');
    fs.writeFileSync(file, '', 'utf8');

    await assert.rejects(
      () => crawlDate({
        targetDate: '20260819',
        outputDir: directory,
        nonTradingDays: new Set(),
        fetchImpl: async () => ({
          ok: false,
          status: 404,
          statusText: 'Not Found',
          json: async () => ({}),
        }),
        maxRetries: 0,
        retryCooldownMs: 0,
        minRows: 1,
      }),
      /TWSE request failed: 404/,
    );

    assert.equal(fs.existsSync(file), true);
    assert.equal(fs.readFileSync(file, 'utf8'), '');
    assert.equal(
      fs.readdirSync(directory).some((name) => name.includes('invalid-backup')),
      false,
    );
  });
});
