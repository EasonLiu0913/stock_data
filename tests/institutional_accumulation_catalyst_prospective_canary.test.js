'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const {
  ALLOWED_STOCKS,
  boundedCooldownMs,
  detailDescriptors,
  parseJsonResponse,
  validateListingBody,
  validateDetailBody,
  makeSnapshot,
  collectStock,
} = require('../scripts/collect_institutional_accumulation_catalyst_prospective_canary');

function response(body, status = 200) {
  const bytes = Buffer.from(JSON.stringify(body));
  return {
    status,
    url: 'https://mops.twse.com.tw/mock',
    async arrayBuffer() { return bytes; },
  };
}

function listingBody(stock) {
  return {
    code: 200,
    message: '查詢成功',
    result: {
      companyId: stock,
      data: [[{
        apiName: 't05st01_detail',
        parameters: { enterDate: '1150910', serialNumber: '1', companyId: stock, marketKind: 'sii' },
      }]],
    },
  };
}

function detailBody(stock) {
  return {
    code: 200,
    message: '查詢成功',
    result: {
      companyId: stock,
      titles: ['序號','發言日期','發言時間','發言人','發言人職稱','發言人電話','主旨','符合條款','事實發生日','說明'].map(main => ({ main })),
      data: [['1','115/09/10','12:34:56','A','B','C','D','E','115/09/10','F']],
    },
  };
}

test('canary stock set is exactly preregistered three stocks and cooldown is bounded', () => {
  assert.deepStrictEqual([...ALLOWED_STOCKS].sort(), ['1102','1104','1216']);
  assert.equal(boundedCooldownMs(() => 0), 20000);
  assert.equal(boundedCooldownMs(() => 0.999999), 59999);
});

test('listing and detail validation preserve official descriptor identity', () => {
  const descriptors = validateListingBody(listingBody('1102'), '1102');
  assert.equal(descriptors.length, 1);
  assert.deepStrictEqual(descriptors[0], { enterDate: '1150910', serialNumber: '1', companyId: '1102', marketKind: 'sii' });
  const detail = validateDetailBody(detailBody('1102'), descriptors[0]);
  assert.equal(detail.row[0], '1');
  assert.equal(detail.sourceReportedAt, '2026-09-10T04:34:56.000Z');
});

test('degraded, malformed, and application-failure responses fail before snapshot creation', () => {
  const degraded = { status: 200 };
  assert.throws(() => parseJsonResponse(degraded, Buffer.from('Access denied')), /degraded/);
  assert.throws(() => parseJsonResponse({ status: 200 }, Buffer.from('x'.repeat(120))), /malformed_json/);
  const bad = Buffer.from(JSON.stringify({ code: 500, message: 'error', padding: 'x'.repeat(150) }));
  assert.throws(() => parseJsonResponse({ status: 200 }, bad), /application_contract_failure/);
});

test('snapshot adapter keeps pit_known_at equal to collected_at and immutable raw hash contract', () => {
  const bytes = Buffer.from(JSON.stringify(listingBody('1102')));
  const snapshot = makeSnapshot({
    kind: 'prospective_material_information_listing',
    stock: '1102',
    requestKey: '1102|115|all',
    bytes,
    collectedAt: '2026-09-10T12:00:00.000Z',
  });
  assert.equal(snapshot.pit_known_at, snapshot.collected_at);
  assert.equal(snapshot.methodology_identity, 'institutional-accumulation-catalyst-prospective-live-capture-canary-v1');
  assert.match(snapshot.response_sha256, /^[a-f0-9]{64}$/);
  assert.match(snapshot.immutable_snapshot_id, /^[a-f0-9]{64}$/);
});

test('zero-network fake fetch produces at most one listing and one detail snapshot for one stock', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'prospective-canary-'));
  let calls = 0;
  const fetchImpl = async () => {
    calls += 1;
    return calls === 1 ? response(listingBody('1102')) : response(detailBody('1102'));
  };
  let n = 0;
  const result = await collectStock(root, '1102', {
    fetchImpl,
    random: () => 0,
    now: () => `2026-09-10T12:00:0${n++}.000Z`,
  });
  assert.equal(result.request_count, 2);
  assert.equal(result.snapshot_count, 2);
  assert.equal(calls, 2);
  for (const item of result.snapshots) {
    assert.equal(item.status, 'created');
    assert.ok(fs.existsSync(path.join(root, ...item.relative_path.split('/'))));
  }
});

test('stock outside preregistration fails before any request', async () => {
  let calls = 0;
  await assert.rejects(() => collectStock('/tmp', '2330', { fetchImpl: async () => { calls += 1; } }), /outside_preregistered/);
  assert.equal(calls, 0);
});
