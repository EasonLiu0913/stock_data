'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {
  buildOpenDataCsv,
  crawlDate,
  normalizePayloadDate,
  validateCsv,
} = require('../scripts/crawl_twse_margin_balance');

const METRIC_FIELDS = [
  '融資買進', '融資賣出', '融資現金償還', '融資前日餘額', '融資今日餘額', '融資限額',
  '融券買進', '融券賣出', '融券現券償還', '融券前日餘額', '融券今日餘額', '融券限額',
  '資券互抵', '註記',
];
const METRIC_VALUES = ['1', '2', '0', '10', '9', '100', '3', '4', '0', '20', '19', '100', '5', ''];

test('normalizePayloadDate supports western and ROC dates', () => {
  assert.equal(normalizePayloadDate('2026年07月31日'), '20260731');
  assert.equal(normalizePayloadDate('115年07月31日'), '20260731');
});

test('buildOpenDataCsv preserves a name when historical payload provides one', () => {
  const payload = {
    stat: 'OK',
    date: '115年07月31日',
    tables: [{
      fields: ['代號', '名稱', ...METRIC_FIELDS],
      data: [['2330', '台積電', ...METRIC_VALUES]],
    }],
  };
  const csv = buildOpenDataCsv(payload, '20260731');
  assert.match(csv, /^股票代號,股票名稱,/);
  assert.match(csv, /2330,台積電,1,2/);
  assert.equal(validateCsv(csv), 1);
});

test('buildOpenDataCsv supports the official STOCK report without a name column', () => {
  const payload = {
    stat: 'OK',
    date: '115年07月31日',
    tables: [{
      fields: ['代號', ...METRIC_FIELDS],
      data: [
        ['合計', ...METRIC_VALUES],
        ['2330', ...METRIC_VALUES],
      ],
    }],
  };
  const csv = buildOpenDataCsv(payload, '20260731');
  assert.match(csv, /\n2330,,1,2,0,10,9,/);
  assert.doesNotMatch(csv, /合計/);
  assert.equal(validateCsv(csv), 1);
});

test('crawlDate retries and writes the official no-name format atomically', async () => {
  const outputDir = fs.mkdtempSync(path.join(os.tmpdir(), 'margin-backfill-'));
  let calls = 0;
  let requestedUrl = '';
  const fetchImpl = async url => {
    calls += 1;
    requestedUrl = String(url);
    if (calls === 1) throw new Error('temporary');
    return {
      ok: true,
      status: 200,
      statusText: 'OK',
      json: async () => ({
        stat: 'OK',
        date: '115年07月31日',
        tables: [{
          fields: ['代號', ...METRIC_FIELDS],
          data: [['2330', ...METRIC_VALUES]],
        }],
      }),
    };
  };
  const result = await crawlDate({
    date: '20260731',
    outputDir,
    fetchImpl,
    maxRetries: 1,
    retryCooldownMs: 0,
    sleepImpl: async () => {},
    logger: { log() {}, warn() {} },
  });
  assert.equal(result.status, 'created');
  assert.equal(calls, 2);
  assert.match(requestedUrl, /selectType=STOCK/);
  assert.ok(fs.existsSync(path.join(outputDir, '20260731_twse_margin_balance.csv')));
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(outputDir, 'files.json'), 'utf8')), ['20260731_twse_margin_balance.csv']);
});
