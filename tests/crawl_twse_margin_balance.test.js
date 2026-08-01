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

test('normalizePayloadDate supports western and ROC dates', () => {
  assert.equal(normalizePayloadDate('2026年07月31日'), '20260731');
  assert.equal(normalizePayloadDate('115年07月31日'), '20260731');
});

test('buildOpenDataCsv converts historical TWSE table to canonical CSV', () => {
  const payload = {
    stat: 'OK',
    date: '115年07月31日',
    tables: [{
      fields: ['代號', '名稱', '買進', '賣出', '現金償還', '前日餘額', '今日餘額', '限額', '買進', '賣出', '現券償還', '前日餘額', '今日餘額', '限額', '資券互抵', '註記'],
      data: [
        ['2330', '台積電', '1', '2', '0', '10', '9', '100', '3', '4', '0', '20', '19', '100', '5', ''],
      ],
    }],
  };
  const csv = buildOpenDataCsv(payload, '20260731');
  assert.match(csv, /^股票代號,股票名稱,/);
  assert.match(csv, /2330,台積電,1,2/);
  assert.equal(validateCsv(csv), 1);
});

test('crawlDate retries and writes atomically', async () => {
  const outputDir = fs.mkdtempSync(path.join(os.tmpdir(), 'margin-backfill-'));
  let calls = 0;
  const fetchImpl = async () => {
    calls += 1;
    if (calls === 1) throw new Error('temporary');
    return {
      ok: true,
      status: 200,
      statusText: 'OK',
      json: async () => ({
        stat: 'OK',
        date: '115年07月31日',
        tables: [{
          fields: ['代號', '名稱', '買進', '賣出', '現金償還', '前日餘額', '今日餘額', '限額', '買進', '賣出', '現券償還', '前日餘額', '今日餘額', '限額', '資券互抵', '註記'],
          data: [['2330', '台積電', '1', '2', '0', '10', '9', '100', '3', '4', '0', '20', '19', '100', '5', '']],
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
  assert.ok(fs.existsSync(path.join(outputDir, '20260731_twse_margin_balance.csv')));
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(outputDir, 'files.json'), 'utf8')), ['20260731_twse_margin_balance.csv']);
});
