'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const {
  parseRocDateTime,
  eventIdentityFromListingRow,
  detailIdentityFromRequestKey,
  textFeatures,
  classifyTaxonomy,
  parseListingPayload,
  parseDetailPayload,
  summarizeVersions,
} = require('../scripts/build_institutional_accumulation_catalyst_five_window_event_intelligence');

test('ROC timestamp parsing is deterministic and does not imply PIT time', () => {
  assert.equal(parseRocDateTime('115/09/23', '20:05:53'), '2026-09-23T20:05:53+08:00');
  assert.throws(() => parseRocDateTime('115/02/30', '20:05:53'), /invalid_roc_datetime_value/);
});

test('listing identity comes only from official detail parameters', () => {
  const row = ['1102','亞泥','115/09/22','18:51:16','購置土地',{apiName:'t05st01_detail',parameters:{companyId:'1102',marketKind:'sii',enterDate:'1150922',serialNumber:'1'}}];
  assert.equal(eventIdentityFromListingRow(row, '1102'), '1102|sii|1150922|1');
  assert.throws(() => eventIdentityFromListingRow([...row.slice(0,5), {apiName:'x'}], '1102'), /listing_detail_parameters_missing/);
});

test('detail request identity must be exact and unambiguous', () => {
  assert.equal(detailIdentityFromRequestKey('1216|1150109|1|sii'), '1216|sii|1150109|1');
  assert.throws(() => detailIdentityFromRequestKey('1216|1150109|1'), /invalid_detail_request_key/);
});

test('title revision summary preserves first and last collection semantics', () => {
  const versions = summarizeVersions([
    {title:'A', collected_at:'2026-09-10T01:00:00.000Z', window:1},
    {title:'A', collected_at:'2026-09-11T01:00:00.000Z', window:2},
    {title:'B', collected_at:'2026-09-12T01:00:00.000Z', window:3},
  ], 'title');
  assert.equal(versions.length, 2);
  assert.deepEqual(versions[0].windows, [1,2]);
  assert.equal(versions[0].first_seen_at, '2026-09-10T01:00:00.000Z');
  assert.equal(versions[0].last_seen_at, '2026-09-11T01:00:00.000Z');
});

test('taxonomy and features are outcome-blind text rules', () => {
  assert.deepEqual(classifyTaxonomy('公告第二季法人說明會召開資訊'), ['investor_conference']);
  const f = textFeatures('預期產能增加20%，客戶訂單與ASP展望改善');
  assert.equal(f.has_numeric_content, true);
  assert.equal(f.has_percentage, true);
  assert.equal(f.mentions_capacity_or_production, true);
  assert.equal(f.mentions_order_or_customer, true);
  assert.equal(f.mentions_price_or_asp, true);
  assert.equal(f.mentions_guidance_or_outlook, true);
  for (const forbidden of ['return','price_change','d1','d3','d5','score','rank']) assert.equal(Object.hasOwn(f, forbidden), false);
});

test('listing parser records collection time separately from source reported time', () => {
  const payload = {code:200,message:'查詢成功',result:{companyAbbreviation:'亞泥',data:[
    ['1102','亞泥','115/09/22','18:51:16','購置土地',{apiName:'t05st01_detail',parameters:{companyId:'1102',marketKind:'sii',enterDate:'1150922',serialNumber:'1'}}]
  ]}};
  const rows = parseListingPayload(payload,{collected_at:'2026-09-23T12:05:25.823Z',immutable_snapshot_id:'x'},'1102',5);
  assert.equal(rows[0].collected_at, '2026-09-23T12:05:25.823Z');
  assert.equal(rows[0].source_reported_at, '2026-09-22T18:51:16+08:00');
});

test('detail parser joins through exact source_request_key identity', () => {
  const payload={code:200,message:'查詢成功',result:{data:[['1','115/01/15','18:29:04','A','B','C','停工改善','第26款','115/01/15','預計可能影響生產']]}}
  const d=parseDetailPayload(payload,{source_request_key:'1102|1150115|1|sii',collected_at:'2026-09-23T12:05:53.200Z',immutable_snapshot_id:'x',response_sha256:'0'.repeat(64)});
  assert.equal(d.event_identity,'1102|sii|1150115|1');
  assert.equal(d.semantic.subject,'停工改善');
  assert.match(d.semantic_sha256,/^[a-f0-9]{64}$/);
});

test('malformed listing/detail payloads fail closed', () => {
  assert.throws(() => parseListingPayload({result:{data:[['1102']] }},{},'1102',1), /invalid_listing_row/);
  assert.throws(() => parseDetailPayload({result:{data:[]}},{source_request_key:'1102|1150115|1|sii'}), /detail_data_invalid/);
});
