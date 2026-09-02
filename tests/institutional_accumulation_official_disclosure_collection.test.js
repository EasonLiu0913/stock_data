#!/usr/bin/env node
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { plan, unresolvedIdentities, CORRECTED_API_CONTRACT_VERSION, ROW_SHAPE_PREFLIGHT_VERSION } = require('../scripts/plan_institutional_accumulation_official_disclosure_collection');
const { API_ENDPOINT, REQUEST_BODY, analyzeListingPayload, rowShapeDiagnostics, findDetailDescriptors, legacyEvidence } = require('../scripts/preflight_institutional_accumulation_mops_material_information');

function reconstruction() {
  const stocks = ['1102','1103','1104','1109','1201','1203','1215','1216','1217'];
  const rows = [];
  for (let i = 0; i < 33; i++) rows.push({ stock: stocks[i % stocks.length], t0: `202608${String(14 + (i % 12)).padStart(2, '0')}`, state: 'source_missing' });
  return { decisions: rows };
}

assert.equal(API_ENDPOINT, 'https://mops.twse.com.tw/mops/api/t05st01');
assert.deepEqual(REQUEST_BODY, { companyId: '1102', year: '115', month: 'all', firstDay: '', lastDay: '' });

const descriptor = { apiName: 't05st01_detail', parameters: { enterDate: '1150115', serialNumber: '1', companyId: '1102', marketKind: 'sii' } };
let analysis = analyzeListingPayload({ code: 200, message: '查詢成功', result: { companyId: '1102', data: [{ title: 'x', action: descriptor }] } });
assert.equal(analysis.listing_contract_passed, true);
assert.equal(analysis.row_shape.row_type, 'object');
assert.equal(analysis.detail_descriptor_count, 1);

const arrayRows = [
  ['115/01/15', 'title-a', descriptor],
  ['115/02/15', 'title-b', { apiName: 't05st01_detail', parameters: { enterDate: '1150215', serialNumber: '2', companyId: '1102', marketKind: 'sii' } }]
];
analysis = analyzeListingPayload({ code: 200, message: '查詢成功', result: { companyId: '1102', data: arrayRows } });
assert.equal(analysis.listing_contract_passed, true);
assert.equal(analysis.coherent_row_structure, true);
assert.equal(analysis.row_shape.row_type, 'array');
assert.deepEqual(analysis.row_shape.row_lengths, [3]);
assert.deepEqual(analysis.row_shape.column_type_sets, [['string'], ['string'], ['object']]);
assert.equal(analysis.detail_descriptor_count, 2);
assert.ok(analysis.detail_descriptor_locations[0].includes('[0][2]'));
assert.equal(findDetailDescriptors(arrayRows).length, 2);

assert.equal(rowShapeDiagnostics([['x', 1], ['y']]).coherent, false);
assert.equal(rowShapeDiagnostics([{ a: 1 }, { b: 2 }]).coherent, false);

analysis = analyzeListingPayload({ code: 200, message: '查詢成功', result: { companyId: '1102', data: [] } });
assert.equal(analysis.listing_contract_passed, true);
assert.equal(analysis.exact_empty_data_contract_observed, true);

analysis = analyzeListingPayload({ code: 200, message: '查詢成功', result: { companyId: '1102', data: [{ title: 'missing detail descriptor' }] } });
assert.equal(analysis.listing_contract_passed, false);
analysis = analyzeListingPayload({ code: 500, message: '失敗', result: { companyId: '1102', data: [] } });
assert.equal(analysis.listing_contract_passed, false);

const legacy = legacyEvidence({ decision: 'blocked', reason: 'listing_security_or_quality_block', attempt_count: 2, retryable: true, terminal_state: null, diagnostics: { requests: [{ kind: 'listing', status: 200, final_url: 'https://mops.twse.com.tw/mops/web/ajax_t05st01', bytes: 800, sha256: 'abc' }] } });
assert.equal(legacy.attempt_count, 2);
assert.equal(legacy.retryable, true);
assert.equal(legacy.requests[0].contract_version, 'mops-web-ajax-t05st01-form-v1');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'accum-official-'));
let p = plan({ reconstruction: reconstruction(), rawRoot: tmp });
assert.equal(p.unresolved_identity_count, 33);
assert.equal(p.wave_a.length, 1);
assert.equal(p.wave_b.length, 1);
assert.equal(p.wave_c.length, 0);
assert.equal(p.material_information_authorized, false);
assert.equal(p.wave_b[0].contract_version, CORRECTED_API_CONTRACT_VERSION);

const monthly = path.join(tmp, 'mops-monthly-revenue', '202607');
fs.mkdirSync(monthly, { recursive: true });
fs.writeFileSync(path.join(monthly, 'source-meta.json'), JSON.stringify({ quality_state: 'quality_passed' }));
const pref = path.join(tmp, 'mops-material-information');
fs.mkdirSync(pref, { recursive: true });
fs.writeFileSync(path.join(pref, 'preflight.json'), JSON.stringify({
  schema_version: 2,
  decision: 'corrected_api_contract_blocked',
  contracts: {
    legacy: { attempt_count: 2, retryable: true, terminal_state: null },
    corrected_api: { contract_version: CORRECTED_API_CONTRACT_VERSION, attempt_count: 1, listing_contract_passed: false, detail_contract: { status: 'unproven' } }
  }
}));
p = plan({ reconstruction: reconstruction(), rawRoot: tmp });
assert.equal(p.wave_a.length, 0);
assert.equal(p.wave_b.length, 1);
assert.equal(p.wave_c.length, 0);
assert.equal(p.legacy_preflight_attempt_count, 2);

const rawDir = path.join(pref, 'corrected-api-preflight');
fs.mkdirSync(rawDir, { recursive: true });
fs.writeFileSync(path.join(rawDir, 'source.json'), JSON.stringify({ code: 200, result: { companyId: '1102', data: arrayRows } }));
fs.writeFileSync(path.join(rawDir, 'source-meta.json'), JSON.stringify({ methodology: ROW_SHAPE_PREFLIGHT_VERSION, listing_contract_passed: true }));
fs.writeFileSync(path.join(pref, 'preflight.json'), JSON.stringify({
  schema_version: 3,
  methodology: ROW_SHAPE_PREFLIGHT_VERSION,
  decision: 'listing_contract_passed_detail_contract_unproven',
  contracts: {
    legacy: { attempt_count: 2, retryable: true, terminal_state: null },
    corrected_api: { contract_version: CORRECTED_API_CONTRACT_VERSION, attempt_count: 1, listing_contract_passed: true, detail_contract: { status: 'unproven' } }
  }
}));
p = plan({ reconstruction: reconstruction(), rawRoot: tmp });
assert.equal(p.wave_a.length, 0);
assert.equal(p.wave_b.length, 0);
assert.equal(p.wave_c.length, 0);
assert.equal(p.material_information_authorized, false);
assert.equal(p.corrected_api_preflight_needed, false);
assert.equal(p.corrected_api_state.listing_contract_passed, true);

fs.writeFileSync(path.join(pref, 'preflight.json'), JSON.stringify({
  schema_version: 4,
  methodology: 'institutional-accumulation-material-information-detail-contract-resolution-v1',
  decision: 'listing_contract_passed_detail_contract_unproven',
  contracts: {
    legacy: { attempt_count: 2, retryable: true, terminal_state: null },
    corrected_api: { contract_version: CORRECTED_API_CONTRACT_VERSION, attempt_count: 1, listing_contract_passed: true, detail_contract: { status: 'unproven', request_executed: false } }
  }
}));
p = plan({ reconstruction: reconstruction(), rawRoot: tmp });
assert.equal(p.wave_a.length, 0);
assert.equal(p.wave_b.length, 0);
assert.equal(p.wave_c.length, 0);
assert.equal(p.material_information_authorized, false);
assert.equal(p.corrected_api_preflight_needed, false);
assert.equal(p.corrected_api_state.methodology, 'institutional-accumulation-material-information-detail-contract-resolution-v1');
assert.equal(p.corrected_api_state.detail_contract_status, 'unproven');

assert.throws(() => unresolvedIdentities({ decisions: [{ stock: '1102', t0: '20260814', state: 'source_missing' }] }), /exactly 33/);
console.log('institutional accumulation official disclosure collection tests passed');
