#!/usr/bin/env node
'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'data_research/institutional-flow/official-disclosure-raw/mops-material-information/preflight.json');
const RAW_DIR = path.join(ROOT, 'data_research/institutional-flow/official-disclosure-raw/mops-material-information/corrected-api-preflight');
const SOURCE = path.join(RAW_DIR, 'source.json');
const SOURCE_META = path.join(RAW_DIR, 'source-meta.json');
const API_ENDPOINT = 'https://mops.twse.com.tw/mops/api/t05st01';
const API_CONTRACT_VERSION = 'mops-api-t05st01-json-v1';
const PARSER_IDENTITY = 'institutional-accumulation-material-information-row-shape-v1';
const LEGACY_ENDPOINT = 'https://mops.twse.com.tw/mops/web/ajax_t05st01';
const LEGACY_CONTRACT_VERSION = 'mops-web-ajax-t05st01-form-v1';
const REQUEST_BODY = Object.freeze({ companyId: '1102', year: '115', month: 'all', firstDay: '', lastDay: '' });

function sleep(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }
function jitter() { return 2000 + Math.floor(Math.random() * 3001); }
function sha(buffer) { return crypto.createHash('sha256').update(buffer).digest('hex'); }
function read(file) { try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return null; } }
function writeJson(file, value) { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, JSON.stringify(value, null, 2) + '\n'); }
function valueType(value) { return value === null ? 'null' : Array.isArray(value) ? 'array' : typeof value === 'object' ? 'object' : typeof value; }

function successfulMessage(message) {
  return /查詢成功|成功|success/i.test(String(message || ''));
}

function findDetailDescriptors(value) {
  const found = [];
  const seen = new Set();
  function visit(node, jsonPath) {
    if (!node || typeof node !== 'object' || seen.has(node)) return;
    seen.add(node);
    if (!Array.isArray(node) && node.apiName === 't05st01_detail') {
      const p = node.parameters;
      if (p && ['enterDate', 'serialNumber', 'companyId', 'marketKind'].every(k => Object.prototype.hasOwnProperty.call(p, k))) {
        found.push({
          path: jsonPath,
          apiName: node.apiName,
          parameters: {
            enterDate: String(p.enterDate ?? ''),
            serialNumber: String(p.serialNumber ?? ''),
            companyId: String(p.companyId ?? ''),
            marketKind: String(p.marketKind ?? '')
          }
        });
      }
    }
    if (Array.isArray(node)) node.forEach((child, index) => visit(child, `${jsonPath}[${index}]`));
    else Object.entries(node).forEach(([key, child]) => visit(child, `${jsonPath}.${key}`));
  }
  visit(value, '$');
  return found;
}

function rowShapeDiagnostics(rows) {
  if (!Array.isArray(rows)) return { coherent: false, reason: 'result_data_not_array', row_type: null, row_type_counts: {}, row_lengths: [], column_type_sets: [], object_key_signatures: [] };
  if (rows.length === 0) return { coherent: true, reason: 'empty_array_observed', row_type: 'empty', row_type_counts: {}, row_lengths: [], column_type_sets: [], object_key_signatures: [] };
  const types = rows.map(valueType);
  const rowTypeCounts = Object.fromEntries([...new Set(types)].map(t => [t, types.filter(x => x === t).length]));
  if (new Set(types).size !== 1) return { coherent: false, reason: 'mixed_top_level_row_types', row_type: null, row_type_counts: rowTypeCounts, row_lengths: [], column_type_sets: [], object_key_signatures: [] };
  const rowType = types[0];
  if (rowType === 'array') {
    const lengths = [...new Set(rows.map(row => row.length))].sort((a, b) => a - b);
    const maxLength = Math.max(...rows.map(row => row.length));
    const columnTypeSets = [];
    for (let i = 0; i < maxLength; i++) columnTypeSets.push([...new Set(rows.map(row => valueType(row[i])))].sort());
    const coherent = lengths.length === 1 && columnTypeSets.every(typesForColumn => typesForColumn.length === 1);
    return { coherent, reason: coherent ? 'uniform_array_rows_and_cell_types' : 'inconsistent_array_row_length_or_cell_types', row_type: rowType, row_type_counts: rowTypeCounts, row_lengths: lengths, column_type_sets: columnTypeSets, object_key_signatures: [] };
  }
  if (rowType === 'object') {
    const signatures = [...new Set(rows.map(row => Object.keys(row).sort().join('|')))];
    return { coherent: signatures.length === 1, reason: signatures.length === 1 ? 'uniform_object_key_shape' : 'inconsistent_object_key_shape', row_type: rowType, row_type_counts: rowTypeCounts, row_lengths: [], column_type_sets: [], object_key_signatures: signatures };
  }
  return { coherent: false, reason: `unsupported_top_level_row_type_${rowType}`, row_type: rowType, row_type_counts: rowTypeCounts, row_lengths: [], column_type_sets: [], object_key_signatures: [] };
}

function analyzeListingPayload(payload) {
  const code = payload?.code;
  const message = payload?.message;
  const result = payload?.result;
  const rows = Array.isArray(result?.data) ? result.data : null;
  const descriptors = rows ? findDetailDescriptors(rows) : [];
  const shape = rowShapeDiagnostics(rows);
  const applicationSuccess = String(code) === '200' && successfulMessage(message);
  const companyMatches = String(result?.companyId ?? '') === REQUEST_BODY.companyId;
  const listingPassed = applicationSuccess && companyMatches && rows !== null && shape.coherent && (rows.length === 0 || descriptors.length > 0);
  return {
    application_code: code ?? null,
    application_message: message ?? null,
    application_success: applicationSuccess,
    company_id_matches: companyMatches,
    result_data_is_array: rows !== null,
    row_count: rows?.length ?? null,
    coherent_row_structure: shape.coherent,
    row_shape: shape,
    detail_descriptor_count: descriptors.length,
    detail_descriptor_locations: descriptors.map(d => d.path),
    sample_detail_descriptor: descriptors[0] ? { apiName: descriptors[0].apiName, parameters: descriptors[0].parameters } : null,
    listing_contract_passed: listingPassed,
    exact_empty_data_contract_observed: applicationSuccess && companyMatches && rows !== null && rows.length === 0,
    one_response_requested_period_observed: applicationSuccess && companyMatches && rows !== null,
    pagination_mechanism_observed: false,
    pagination_note: 'No pagination field or end-condition is assumed. The corrected listing request asks for month=all and this preflight records only the single response actually observed.'
  };
}

function legacyEvidence(existing) {
  if (existing?.contracts?.legacy) return existing.contracts.legacy;
  const requests = Array.isArray(existing?.diagnostics?.requests) ? existing.diagnostics.requests : [];
  return {
    contract_version: LEGACY_CONTRACT_VERSION,
    endpoint: LEGACY_ENDPOINT,
    method: 'POST',
    attempt_count: Number(existing?.attempt_count || 0),
    retryable: existing?.retryable === true,
    terminal_state: existing?.terminal_state ?? null,
    historical_decision: existing?.decision ?? null,
    historical_reason: existing?.reason ?? null,
    requests: requests.map(r => ({ ...r, contract_version: LEGACY_CONTRACT_VERSION }))
  };
}

async function requestJson(url, options = {}) {
  await sleep(jitter());
  const response = await fetch(url, {
    redirect: 'follow',
    ...options,
    headers: {
      'user-agent': 'Mozilla/5.0 (compatible; stock-data-accumulation-material-api-preflight/3.0)',
      accept: 'application/json, text/plain, */*',
      ...(options.headers || {})
    }
  });
  const bytes = Buffer.from(await response.arrayBuffer());
  const text = new TextDecoder('utf-8').decode(bytes);
  let json = null;
  let parseError = null;
  try { json = JSON.parse(text); } catch (error) { parseError = error.message; }
  return { status: response.status, url: response.url, bytes, text, json, parseError, sha256: sha(bytes) };
}

async function main() {
  const existing = read(OUT);
  if (fs.existsSync(SOURCE) || fs.existsSync(SOURCE_META)) throw new Error('Corrected row-shape preflight raw artifacts already exist; refusing a second listing request.');
  const legacy = legacyEvidence(existing);
  if (legacy.attempt_count !== 2 || legacy.retryable !== true || legacy.terminal_state !== null) {
    throw new Error(`Legacy preflight baseline changed: ${JSON.stringify({ attempt_count: legacy.attempt_count, retryable: legacy.retryable, terminal_state: legacy.terminal_state })}`);
  }

  const startedAt = new Date().toISOString();
  const listing = await requestJson(API_ENDPOINT, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(REQUEST_BODY)
  });
  fs.mkdirSync(RAW_DIR, { recursive: true });
  fs.writeFileSync(SOURCE, listing.bytes);

  const analysis = listing.json ? analyzeListingPayload(listing.json) : {
    application_code: null, application_message: null, application_success: false, company_id_matches: false,
    result_data_is_array: false, row_count: null, coherent_row_structure: false,
    row_shape: rowShapeDiagnostics(null), detail_descriptor_count: 0, detail_descriptor_locations: [], sample_detail_descriptor: null,
    listing_contract_passed: false, exact_empty_data_contract_observed: false, one_response_requested_period_observed: false,
    pagination_mechanism_observed: false, pagination_note: 'Response was not parseable JSON; no pagination or completeness claim is made.'
  };

  let decision;
  let reason;
  if (listing.status !== 200 || listing.parseError || !analysis.application_success || !analysis.company_id_matches || !analysis.result_data_is_array) {
    decision = 'corrected_api_contract_blocked';
    reason = listing.parseError ? 'corrected_api_malformed_json' : 'corrected_api_security_or_application_quality_block';
  } else if (!analysis.listing_contract_passed) {
    decision = 'corrected_api_contract_blocked';
    reason = 'corrected_api_listing_schema_or_detail_descriptor_unverified';
  } else {
    decision = 'listing_contract_passed_detail_contract_unproven';
    reason = 'corrected_api_listing_contract_verified_detail_method_url_body_not_proven';
  }

  const collectedAt = new Date().toISOString();
  const sourceMeta = {
    schema_version: 1,
    methodology: 'institutional-accumulation-material-information-row-shape-detail-contract-preflight-v1',
    parser_identity: PARSER_IDENTITY,
    endpoint: API_ENDPOINT,
    method: 'POST',
    request_body: REQUEST_BODY,
    http_status: listing.status,
    application_code: analysis.application_code,
    application_message: analysis.application_message,
    response_bytes: listing.bytes.length,
    response_sha256: listing.sha256,
    collection_timestamp: collectedAt,
    parseable_json: listing.json !== null,
    parse_error: listing.parseError,
    row_count: analysis.row_count,
    coherent_row_structure: analysis.coherent_row_structure,
    row_shape: analysis.row_shape,
    detail_descriptor_count: analysis.detail_descriptor_count,
    detail_descriptor_locations: analysis.detail_descriptor_locations,
    sample_detail_descriptor: analysis.sample_detail_descriptor,
    listing_contract_passed: analysis.listing_contract_passed,
    pagination_mechanism_observed: false,
    pagination_note: analysis.pagination_note,
    point_in_time_disclaimer: 'Current collection time and current API visibility are audit metadata only and do not prove this value/version was visible at an earlier T0.'
  };
  writeJson(SOURCE_META, sourceMeta);

  const corrected = {
    contract_version: API_CONTRACT_VERSION,
    endpoint: API_ENDPOINT,
    method: 'POST',
    request_body: REQUEST_BODY,
    attempt_count: 1,
    request_cap_this_round: 3,
    requests_used_this_round: 1,
    listing_request: { status: listing.status, final_url: listing.url, bytes: listing.bytes.length, sha256: listing.sha256, parseable_json: listing.json !== null, parse_error: listing.parseError },
    ...analysis,
    raw_source_path: path.relative(ROOT, SOURCE).replaceAll('\\', '/'),
    raw_source_meta_path: path.relative(ROOT, SOURCE_META).replaceAll('\\', '/'),
    detail_contract: {
      status: 'unproven',
      request_executed: false,
      rationale: 'No detail HTTP method, URL, or body is guessed from apiName alone. No separate official static/frontend contract request was needed to establish listing row shape.'
    }
  };

  const result = {
    schema_version: 3,
    methodology: 'institutional-accumulation-material-information-row-shape-detail-contract-preflight-v1',
    outcome_blind: true,
    started_at: startedAt,
    completed_at: collectedAt,
    decision,
    reason,
    retryable: false,
    terminal_state: null,
    contracts: { legacy, corrected_api: corrected },
    diagnostics: { stock: REQUEST_BODY.companyId, roc_year: REQUEST_BODY.year, request_cap: 3, total_network_requests_this_round: 1, collection_time_is_pit_proof: false }
  };
  writeJson(OUT, result);
  console.log(JSON.stringify(result, null, 2));
  if (decision === 'corrected_api_contract_blocked') process.exitCode = 2;
}

if (require.main === module) main().catch(error => { console.error(error.stack || error.message); process.exitCode = 1; });
module.exports = { API_ENDPOINT, API_CONTRACT_VERSION, PARSER_IDENTITY, LEGACY_ENDPOINT, LEGACY_CONTRACT_VERSION, REQUEST_BODY, successfulMessage, findDetailDescriptors, rowShapeDiagnostics, analyzeListingPayload, legacyEvidence };
