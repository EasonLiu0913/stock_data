#!/usr/bin/env node
'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'data_research/institutional-flow/official-disclosure-raw/mops-material-information/preflight.json');
const API_ENDPOINT = 'https://mops.twse.com.tw/mops/api/t05st01';
const API_CONTRACT_VERSION = 'mops-api-t05st01-json-v1';
const LEGACY_ENDPOINT = 'https://mops.twse.com.tw/mops/web/ajax_t05st01';
const LEGACY_CONTRACT_VERSION = 'mops-web-ajax-t05st01-form-v1';
const REQUEST_BODY = Object.freeze({ companyId: '1102', year: '115', month: 'all', firstDay: '', lastDay: '' });

function sleep(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }
function jitter() { return 2000 + Math.floor(Math.random() * 3001); }
function sha(buffer) { return crypto.createHash('sha256').update(buffer).digest('hex'); }
function read(file) { try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return null; } }
function write(value) { fs.mkdirSync(path.dirname(OUT), { recursive: true }); fs.writeFileSync(OUT, JSON.stringify(value, null, 2) + '\n'); }

function successfulMessage(message) {
  return /查詢成功|成功|success/i.test(String(message || ''));
}

function findDetailDescriptor(value) {
  const seen = new Set();
  function visit(node) {
    if (!node || typeof node !== 'object' || seen.has(node)) return null;
    seen.add(node);
    if (!Array.isArray(node) && node.apiName === 't05st01_detail') {
      const p = node.parameters;
      if (p && ['enterDate', 'serialNumber', 'companyId', 'marketKind'].every(k => Object.prototype.hasOwnProperty.call(p, k))) {
        return {
          apiName: node.apiName,
          parameters: {
            enterDate: String(p.enterDate ?? ''),
            serialNumber: String(p.serialNumber ?? ''),
            companyId: String(p.companyId ?? ''),
            marketKind: String(p.marketKind ?? '')
          }
        };
      }
    }
    for (const child of Object.values(node)) {
      const found = visit(child);
      if (found) return found;
    }
    return null;
  }
  return visit(value);
}

function analyzeListingPayload(payload) {
  const code = payload?.code;
  const message = payload?.message;
  const result = payload?.result;
  const rows = Array.isArray(result?.data) ? result.data : null;
  const descriptor = rows ? findDetailDescriptor(rows) : null;
  const applicationSuccess = String(code) === '200' && successfulMessage(message);
  const companyMatches = String(result?.companyId ?? '') === REQUEST_BODY.companyId;
  const coherentRows = rows !== null && rows.every(row => row && typeof row === 'object' && !Array.isArray(row));
  const rowStructurePass = rows !== null && coherentRows && (rows.length === 0 || Boolean(descriptor));
  return {
    application_code: code ?? null,
    application_message: message ?? null,
    application_success: applicationSuccess,
    company_id_matches: companyMatches,
    result_data_is_array: rows !== null,
    row_count: rows?.length ?? null,
    coherent_row_structure: rows !== null ? coherentRows : false,
    sample_detail_descriptor: descriptor,
    listing_contract_passed: applicationSuccess && companyMatches && rows !== null && rowStructurePass,
    exact_empty_data_contract_observed: applicationSuccess && companyMatches && rows !== null && rows.length === 0,
    one_response_requested_period_observed: applicationSuccess && companyMatches && rows !== null,
    pagination_mechanism_observed: false,
    pagination_note: 'No pagination field or end-condition is assumed. The corrected listing request asks for month=all and this preflight records only the single-response contract actually observed.'
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
      'user-agent': 'Mozilla/5.0 (compatible; stock-data-accumulation-material-api-preflight/2.0)',
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
  if (existing?.contracts?.corrected_api?.attempt_count >= 1) {
    console.log(JSON.stringify({ ok: true, skipped: true, reason: 'corrected_api_preflight_already_executed_once' }, null, 2));
    return;
  }

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

  const analysis = listing.json ? analyzeListingPayload(listing.json) : {
    application_code: null,
    application_message: null,
    application_success: false,
    company_id_matches: false,
    result_data_is_array: false,
    row_count: null,
    coherent_row_structure: false,
    sample_detail_descriptor: null,
    listing_contract_passed: false,
    exact_empty_data_contract_observed: false,
    one_response_requested_period_observed: false,
    pagination_mechanism_observed: false,
    pagination_note: 'Response was not parseable JSON; no pagination or completeness claim is made.'
  };

  let decision;
  let reason;
  if (listing.status !== 200 || listing.parseError || !analysis.application_success || !analysis.company_id_matches || !analysis.result_data_is_array) {
    decision = 'corrected_api_contract_blocked';
    reason = listing.parseError ? 'corrected_api_malformed_json' : 'corrected_api_security_or_application_quality_block';
  } else if (!analysis.listing_contract_passed) {
    decision = 'corrected_api_contract_blocked';
    reason = 'corrected_api_listing_schema_or_detail_descriptor_unverified';
  } else if (analysis.exact_empty_data_contract_observed) {
    decision = 'listing_contract_passed_empty_data_contract_observed_detail_contract_unproven';
    reason = 'corrected_api_listing_successful_empty_array';
  } else {
    decision = 'listing_contract_passed_detail_contract_unproven';
    reason = 'corrected_api_listing_contract_verified_detail_method_url_body_not_proven';
  }

  const corrected = {
    contract_version: API_CONTRACT_VERSION,
    endpoint: API_ENDPOINT,
    method: 'POST',
    request_body: REQUEST_BODY,
    attempt_count: 1,
    request_cap_this_round: 3,
    requests_used_this_round: 1,
    listing_request: {
      status: listing.status,
      final_url: listing.url,
      bytes: listing.bytes.length,
      sha256: listing.sha256,
      parseable_json: listing.json !== null,
      parse_error: listing.parseError
    },
    ...analysis,
    detail_contract: {
      status: 'unproven',
      request_executed: false,
      rationale: 'Listing metadata identifies apiName=t05st01_detail when present, but this round does not guess detail HTTP method, URL, or body without deterministic official frontend/network evidence.'
    }
  };

  const result = {
    schema_version: 2,
    methodology: 'institutional-accumulation-material-information-final-preflight-v1',
    outcome_blind: true,
    started_at: startedAt,
    completed_at: new Date().toISOString(),
    decision,
    reason,
    retryable: false,
    terminal_state: null,
    contracts: { legacy, corrected_api: corrected },
    diagnostics: {
      stock: REQUEST_BODY.companyId,
      roc_year: REQUEST_BODY.year,
      request_cap: 3,
      total_network_requests_this_round: 1,
      collection_time_is_pit_proof: false
    }
  };

  write(result);
  console.log(JSON.stringify(result, null, 2));
  if (decision === 'corrected_api_contract_blocked') process.exitCode = 2;
}

if (require.main === module) main().catch(error => { console.error(error.stack || error.message); process.exitCode = 1; });
module.exports = { API_ENDPOINT, API_CONTRACT_VERSION, LEGACY_ENDPOINT, LEGACY_CONTRACT_VERSION, REQUEST_BODY, successfulMessage, findDetailDescriptor, analyzeListingPayload, legacyEvidence };
