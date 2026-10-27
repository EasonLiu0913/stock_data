'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const sha256 = (bytes) => crypto.createHash('sha256').update(bytes).digest('hex');
function check(receipt, raw, normalized, date) {
  if (!receipt || receipt.schemaVersion !== 1) throw Error('receipt missing');
  if (receipt.trust !== 'capture_time') throw Error('capture-time provenance missing');
  if (!receipt.capture || receipt.capture.repository !== 'EasonLiu0913/stock_data' ||
      !Number.isSafeInteger(receipt.capture.runId) || receipt.capture.runId <= 0 ||
      !/^[a-f0-9]{40}$/.test(receipt.capture.commitSha || '') ||
      receipt.capture.workflow !== 'crawl-twse-mi-index.yml') throw Error('capture run identity missing');
  if (!/^https:\/\//.test(receipt.url || '')) throw Error('URL missing');
  if (receipt.httpStatus !== 200) throw Error('HTTP status invalid');
  if (!Number.isFinite(Date.parse(receipt.capturedAt))) throw Error('capture time missing');
  if (receipt.sourceDate !== date) throw Error('date mismatch');
  if (!/^[a-f0-9]{64}$/.test(receipt.rawResponseSha256 || '') || !/^[a-f0-9]{64}$/.test(receipt.normalizedFileSha256 || '')) throw Error('SHA-256 missing');
  if (sha256(raw) !== receipt.rawResponseSha256) throw Error('raw SHA-256 mismatch');
  if (sha256(normalized) !== receipt.normalizedFileSha256) throw Error('normalized SHA-256 mismatch');
  return true;
}
test('research-only proposed receipt contract rejects missing and substituted evidence', () => {
  const raw = Buffer.from('{"date":"20260724","tables":[1]}');
  const normalized = Buffer.from(JSON.stringify(JSON.parse(raw.toString()), null, 2));
  const receipt = {schemaVersion:1,trust:'capture_time',url:'https://www.twse.com.tw/rwd/zh/afterTrading/MI_INDEX?date=20260724',httpStatus:200,capture:{repository:'EasonLiu0913/stock_data',runId:12345,commitSha:'a'.repeat(40),workflow:'crawl-twse-mi-index.yml'},capturedAt:'2026-07-24T07:00:00Z',sourceDate:'20260724',rawResponseSha256:sha256(raw),normalizedFileSha256:sha256(normalized)};
  assert.equal(check(receipt,raw,normalized,'20260724'),true);
  assert.throws(()=>check(null,raw,normalized,'20260724'),/receipt missing/);
  assert.throws(()=>check({...receipt,capture:null},raw,normalized,'20260724'),/capture run identity missing/);
  assert.throws(()=>check({...receipt,capture:{...receipt.capture,runId:0}},raw,normalized,'20260724'),/capture run identity missing/);
  assert.throws(()=>check({...receipt,capture:{...receipt.capture,commitSha:'bad'}},raw,normalized,'20260724'),/capture run identity missing/);
  assert.throws(()=>check({...receipt,trust:'post_hoc'},raw,normalized,'20260724'),/capture-time provenance/);
  assert.throws(()=>check(receipt,raw,Buffer.from('{}'),'20260724'),/normalized SHA-256 mismatch/);
  assert.throws(()=>check(receipt,Buffer.from('{}'),normalized,'20260724'),/raw SHA-256 mismatch/);
  assert.throws(()=>check({...receipt,sourceDate:'20260723'},raw,normalized,'20260724'),/date mismatch/);
  assert.throws(()=>check({...receipt,httpStatus:503},raw,normalized,'20260724'),/HTTP status/);
});
