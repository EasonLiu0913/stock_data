'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const {
  fetchTwt49uSafeOnce,
  isNoMatchingDataStat,
  normalizeResponsePayload,
} = require('../scripts/crawl_twse_twt49u_safe');

test('recognizes only TWSE no-matching-records status as a valid empty result', () => {
  assert.equal(isNoMatchingDataStat('很抱歉，沒有符合條件的資料!'), true);
  assert.equal(isNoMatchingDataStat('系統忙碌中'), false);
});

test('normalizes a TWSE no-data response into a deterministic valid empty snapshot', () => {
  const result = normalizeResponsePayload(
    { stat: '很抱歉，沒有符合條件的資料!' },
    '20251111',
  );
  assert.equal(result.stat, 'OK');
  assert.equal(result.noData, true);
  assert.equal(result.sourceStat, '很抱歉，沒有符合條件的資料!');
  assert.equal(result.strDate, '20251111');
  assert.deepEqual(result.data, []);
  assert.ok(result.fields.includes('開盤競價基準'));
});

test('does not normalize unrelated TWSE errors', () => {
  const payload = { stat: '系統忙碌中' };
  assert.equal(normalizeResponsePayload(payload, '20251111'), payload);
});

test('safe fetch accepts and validates the normalized empty response', async () => {
  const result = await fetchTwt49uSafeOnce('20251111', async () => ({
    ok: true,
    json: async () => ({ stat: '很抱歉，沒有符合條件的資料!' }),
  }));
  assert.equal(result.noData, true);
  assert.deepEqual(result.data, []);
});

test('safe fetch still rejects unrelated TWSE failure statuses', async () => {
  await assert.rejects(
    fetchTwt49uSafeOnce('20251111', async () => ({
      ok: true,
      json: async () => ({ stat: '系統忙碌中' }),
    })),
    /stat is not OK|stat 系統忙碌中/,
  );
});
