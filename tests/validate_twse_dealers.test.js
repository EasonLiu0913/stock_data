'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { validateDealerPayload } = require('../scripts/validate_twse_dealers');

function payload({ date = '20260827', rowCount = 1000, includeSentinels = true } = {}) {
  const rows = [];
  if (includeSentinels) {
    rows.push(['2330', '台積電', '0', '0', '0', '0', '0', '0', '0', '0', '1000']);
    rows.push(['2317', '鴻海', '0', '0', '0', '0', '0', '0', '0', '0', '-2000']);
    rows.push(['2454', '聯發科', '0', '0', '0', '0', '0', '0', '0', '0', '0']);
  }
  while (rows.length < rowCount) {
    const code = String(3000 + rows.length);
    rows.push([code, `股票${code}`, '0', '0', '0', '0', '0', '0', '0', '0', String(rows.length)]);
  }
  return {
    stat: 'OK',
    date,
    fields: ['證券代號', '證券名稱', '買進股數', '賣出股數', '買賣超股數', '買進股數', '賣出股數', '買賣超股數', '買進股數', '賣出股數', '買賣超股數'],
    groups: [],
    data: rows,
  };
}

test('accepts a semantically complete dealer payload', () => {
  const result = validateDealerPayload(payload(), '20260827');
  assert.equal(result.valid, true);
  assert.equal(result.row_count, 1000);
  assert.equal(result.sentinels['2330'], true);
});

test('rejects unexpectedly small payloads', () => {
  const result = validateDealerPayload(payload({ rowCount: 50 }), '20260827');
  assert.equal(result.valid, false);
  assert.match(result.errors.join('\n'), /row count too small/);
});

test('rejects payloads missing sentinel stocks', () => {
  const result = validateDealerPayload(payload({ includeSentinels: false }), '20260827');
  assert.equal(result.valid, false);
  assert.match(result.errors.join('\n'), /missing sentinel 2330/);
});

test('rejects response-date mismatch', () => {
  const result = validateDealerPayload(payload({ date: '20260826' }), '20260827');
  assert.equal(result.valid, false);
  assert.match(result.errors.join('\n'), /date mismatch/);
});
