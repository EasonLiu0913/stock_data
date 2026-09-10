'use strict';

const {
  buildProspectiveSnapshot,
  validateProspectiveSnapshot,
  writeSnapshotAppendOnly,
} = require('./institutional_accumulation_catalyst_prospective_pit_capture_contract');

const LIST_ENDPOINT = 'https://mops.twse.com.tw/mops/api/t05st01';
const DETAIL_ENDPOINT = 'https://mops.twse.com.tw/mops/api/t05st01_detail';
const ALLOWED_STOCKS = new Set(['1102', '1104', '1216']);
const ROC_YEAR = '115';
const PARSER_VERSION = 'institutional-accumulation-catalyst-prospective-canary-parser-v1';
const METHODOLOGY_ID = 'institutional-accumulation-catalyst-prospective-live-capture-canary-v1';
const EXPECTED_DETAIL_TITLES = ['序號','發言日期','發言時間','發言人','發言人職稱','發言人電話','主旨','符合條款','事實發生日','說明'];

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function boundedCooldownMs(random = Math.random) {
  return 20000 + Math.floor(random() * 40001);
}

function successful(message) {
  return /查詢成功|成功|success/i.test(String(message || ''));
}

function detailDescriptors(value) {
  const out = [];
  function visit(v) {
    if (!v || typeof v !== 'object') return;
    if (!Array.isArray(v) && v.apiName === 't05st01_detail' && v.parameters) {
      const p = Object.fromEntries(['enterDate','serialNumber','companyId','marketKind'].map(k => [k, String(v.parameters[k] ?? '')]));
      if (p.enterDate && p.serialNumber && p.companyId && p.marketKind) out.push(p);
    }
    if (Array.isArray(v)) v.forEach(visit); else Object.values(v).forEach(visit);
  }
  visit(value);
  const seen = new Set();
  return out.filter(p => {
    const key = `${p.companyId}|${p.enterDate}|${p.serialNumber}|${p.marketKind}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function looksDegraded(bytes) {
  const text = bytes.toString('utf8');
  return bytes.length < 100 || /access denied|captcha|security|驗證碼|forbidden|拒絕/i.test(text);
}

function parseJsonResponse(response, bytes) {
  if (response.status !== 200) throw new Error(`transport_http_${response.status}`);
  if (looksDegraded(bytes)) throw new Error('suspected_soft_block_or_degraded_response');
  let body;
  try { body = JSON.parse(bytes.toString('utf8')); }
  catch { throw new Error('malformed_json'); }
  if (String(body?.code) !== '200' || !successful(body?.message)) throw new Error('application_contract_failure');
  return body;
}

function validateListingBody(body, stock) {
  if (String(body?.result?.companyId ?? '') !== stock) throw new Error('listing_company_identity_mismatch');
  const rows = body?.result?.data;
  if (!Array.isArray(rows)) throw new Error('listing_schema_invalid');
  const descriptors = detailDescriptors(rows).filter(p => p.companyId === stock);
  if (rows.length > 0 && descriptors.length === 0) throw new Error('listing_descriptor_schema_invalid');
  return descriptors;
}

function validateDetailBody(body, descriptor) {
  if (String(body?.result?.companyId ?? '') !== descriptor.companyId) throw new Error('detail_company_identity_mismatch');
  const rows = body?.result?.data;
  const titles = Array.isArray(body?.result?.titles) ? body.result.titles.map(x => x?.main) : [];
  if (!Array.isArray(rows)) throw new Error('detail_schema_invalid');
  if (JSON.stringify(titles) !== JSON.stringify(EXPECTED_DETAIL_TITLES)) throw new Error('detail_titles_invalid');
  if (rows.length === 0) return { row: null, sourceReportedAt: null };
  const row = rows[0];
  if (!Array.isArray(row) || row.length !== 10 || !row.every(v => typeof v === 'string')) throw new Error('detail_row_shape_invalid');
  if (String(row[0]).trim() !== descriptor.serialNumber) throw new Error('detail_sequence_mismatch');
  if (String(row[1] || '').replaceAll('/', '') !== descriptor.enterDate) throw new Error('detail_date_mismatch');
  return { row, sourceReportedAt: rocDateTimeToIso(row[1], row[2]) };
}

function rocDateTimeToIso(rocDate, time) {
  const m = String(rocDate || '').match(/^(\d{3})\/(\d{2})\/(\d{2})$/);
  const t = String(time || '').match(/^(\d{2}):(\d{2}):(\d{2})$/);
  if (!m || !t) return null;
  const year = Number(m[1]) + 1911;
  const iso = new Date(`${year}-${m[2]}-${m[3]}T${t[1]}:${t[2]}:${t[3]}+08:00`);
  return Number.isNaN(iso.getTime()) ? null : iso.toISOString();
}

async function requestOnce(endpoint, payload, fetchImpl = fetch, random = Math.random, sleepImpl = sleep) {
  await sleepImpl(boundedCooldownMs(random));
  const response = await fetchImpl(endpoint, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'accept': 'application/json, text/plain, */*',
      'user-agent': 'Mozilla/5.0 (compatible; stock-data-prospective-catalyst-canary/1.0)',
    },
    body: JSON.stringify(payload),
  });
  const bytes = Buffer.from(await response.arrayBuffer());
  const body = parseJsonResponse(response, bytes);
  return { response, bytes, body };
}

function makeSnapshot({kind, stock, requestKey, bytes, collectedAt, sourceReportedAt = null}) {
  const snapshot = buildProspectiveSnapshot({
    source_provider: 'MOPS',
    source_interface: kind,
    source_request_key: requestKey,
    collected_at: collectedAt,
    source_reported_at: sourceReportedAt,
    source_timestamp_precision: sourceReportedAt ? 'official_timestamp' : 'collection_timestamp_only',
    parser_version: PARSER_VERSION,
    methodology_identity: METHODOLOGY_ID,
    raw_response: bytes,
  });
  validateProspectiveSnapshot(snapshot);
  if (snapshot.pit_known_at !== snapshot.collected_at) throw new Error('pit_known_at_contract_violation');
  return snapshot;
}

async function collectStock(root, stock, options = {}) {
  stock = String(stock);
  if (!ALLOWED_STOCKS.has(stock)) throw new Error('stock_outside_preregistered_canary');
  const fetchImpl = options.fetchImpl || fetch;
  const random = options.random || Math.random;
  const now = options.now || (() => new Date().toISOString());
  const sleepImpl = options.sleepImpl || sleep;
  let requestCount = 0;
  const written = [];

  const listingPayload = { companyId: stock, year: ROC_YEAR, month: 'all', firstDay: '', lastDay: '' };
  const listing = await requestOnce(LIST_ENDPOINT, listingPayload, fetchImpl, random, sleepImpl);
  requestCount += 1;
  const descriptors = validateListingBody(listing.body, stock);
  const listingSnapshot = makeSnapshot({
    kind: 'prospective_material_information_listing',
    stock,
    requestKey: `${stock}|${ROC_YEAR}|all`,
    bytes: listing.bytes,
    collectedAt: now(),
  });
  written.push(writeSnapshotAppendOnly(root, listingSnapshot));

  if (descriptors.length > 0) {
    const d = descriptors[0];
    const detailPayload = { enterDate: d.enterDate, serialNumber: d.serialNumber, companyId: stock, marketKind: d.marketKind };
    const detail = await requestOnce(DETAIL_ENDPOINT, detailPayload, fetchImpl, random, sleepImpl);
    requestCount += 1;
    const validated = validateDetailBody(detail.body, d);
    const detailSnapshot = makeSnapshot({
      kind: 'prospective_material_information_detail',
      stock,
      requestKey: `${stock}|${d.enterDate}|${d.serialNumber}|${d.marketKind}`,
      bytes: detail.bytes,
      collectedAt: now(),
      sourceReportedAt: validated.sourceReportedAt,
    });
    written.push(writeSnapshotAppendOnly(root, detailSnapshot));
  }

  if (requestCount > 2) throw new Error('per_stock_request_cap_exceeded');
  return { stock, request_count: requestCount, snapshot_count: written.length, snapshots: written };
}

async function main() {
  const root = process.cwd();
  const stock = process.argv[2];
  const result = await collectStock(root, stock);
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

if (require.main === module) {
  main().catch(error => {
    console.error(error.stack || error.message);
    process.exitCode = 1;
  });
}

module.exports = {
  LIST_ENDPOINT,
  DETAIL_ENDPOINT,
  ALLOWED_STOCKS,
  ROC_YEAR,
  PARSER_VERSION,
  METHODOLOGY_ID,
  EXPECTED_DETAIL_TITLES,
  boundedCooldownMs,
  detailDescriptors,
  looksDegraded,
  parseJsonResponse,
  validateListingBody,
  validateDetailBody,
  rocDateTimeToIso,
  makeSnapshot,
  collectStock,
};
