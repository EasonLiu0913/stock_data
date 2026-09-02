#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const ROOT = path.resolve(__dirname, '..');
const RAW = path.join(ROOT, 'data_research/institutional-flow/official-disclosure-raw/mops-material-information');
const PREF = path.join(RAW, 'preflight.json');
const LIST_ENDPOINT = 'https://mops.twse.com.tw/mops/api/t05st01';
const DETAIL_ENDPOINT = 'https://mops.twse.com.tw/mops/api/t05st01_detail';
const STOCKS = new Set(['1102','1103','1104','1109','1201','1203','1215','1216','1217']);
const SUPERSEDED_RUN_IDS = new Set(['33611570077']);
const PARSER = 'institutional-accumulation-material-information-wave-c-v1';
const PIT = 'Source-reported spoke date/time may support official timestamp precision. Current collection time/API visibility does not prove historical T0 visibility or immutable historical value version.';
const VERSION_SAFETY = 'historical_timing_safe_value_version_unproven';
const EXPECTED_DETAIL_TITLES = ['序號','發言日期','發言時間','發言人','發言人職稱','發言人電話','主旨','符合條款','事實發生日','說明'];

function read(file) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return null; }
}
function write(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(value, null, 2) + '\n');
}
function sha256(bytes) { return crypto.createHash('sha256').update(bytes).digest('hex'); }
function sleep(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }
function successful(message) { return /查詢成功|成功|success/i.test(String(message || '')); }
function nextAttempt(dir) {
  const prev = read(path.join(dir, 'source-meta.json')) || read(path.join(dir, 'attempt-meta.json'));
  return Number(prev?.attempt_count || 0) + 1;
}
function detailKey(p) { return `${p.companyId}|${p.enterDate}|${p.serialNumber}|${p.marketKind}`; }
function descriptors(value) {
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
  return out.filter(p => !seen.has(detailKey(p)) && seen.add(detailKey(p)));
}
function gate() {
  const p = read(PREF);
  const c = p?.contracts?.corrected_api;
  if (p?.decision !== 'listing_and_detail_contract_passed' || c?.listing_contract_passed !== true || c?.detail_contract?.status !== 'passed' || c?.detail_contract?.descriptor_mapping_verified !== true) {
    throw new Error('Wave C blocked: durable listing+detail contract PASS missing.');
  }
  if (Number(p?.contracts?.legacy?.attempt_count) !== 2) throw new Error('Legacy attempt_count must remain exactly 2.');
  return p;
}
function guardSupersededRun() {
  const id = String(process.env.GITHUB_RUN_ID || '');
  if (SUPERSEDED_RUN_IDS.has(id)) {
    const e = new Error(`superseded_wave_c_run_blocked_before_network:${id}`);
    e.code = 'SUPERSEDED_BEFORE_NETWORK';
    throw e;
  }
}
function baseMeta({kind,key,stock,attempt,requestBody,status=null,url=null,bytes=Buffer.alloc(0),body=null,quality='retryable_failure',terminal=null,sourceDate=null,sourceTime=null,sourceSequence=null,rowCount=null,descriptorCount=null}) {
  return {
    schema_version: 1,
    methodology: 'institutional-accumulation-material-information-wave-c-physical-batch-collection-v1',
    source_provider: 'MOPS',
    source_interface: kind,
    source_url_or_request_key: key,
    stock_id: stock,
    historical_period_or_spoke_date: sourceDate || '115',
    source_reported_date: sourceDate,
    source_reported_time: sourceTime,
    source_timestamp_precision: sourceDate && sourceTime ? 'official_timestamp' : 'listing_only',
    source_sequence: sourceSequence,
    collected_at: new Date().toISOString(),
    http_status: status,
    final_url: url,
    response_bytes: bytes.length,
    response_sha256: sha256(bytes),
    parser_version: PARSER,
    quality_state: quality,
    terminal_state: terminal,
    attempt_count: attempt,
    request_body: requestBody,
    application_code: body?.code ?? null,
    application_message: body?.message ?? null,
    row_count: rowCount,
    detail_descriptor_count: descriptorCount,
    version_safety: VERSION_SAFETY,
    pit_known_at: null,
    pit_availability_rule: PIT
  };
}
function persistFailedAttempt(dir, meta, bytes = null) {
  write(path.join(dir, 'attempt-meta.json'), meta);
  const attemptsDir = path.join(dir, 'attempts');
  fs.mkdirSync(attemptsDir, { recursive: true });
  const stem = `attempt-${String(meta.attempt_count).padStart(2, '0')}`;
  if (bytes) fs.writeFileSync(path.join(attemptsDir, `${stem}-source.json`), bytes);
  write(path.join(attemptsDir, `${stem}-meta.json`), meta);
}
async function request(endpoint, payload) {
  guardSupersededRun();
  await sleep(2000 + Math.floor(Math.random() * 3001));
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'accept': 'application/json, text/plain, */*',
      'user-agent': 'Mozilla/5.0 (compatible; stock-data-accumulation-wave-c/1.0)'
    },
    body: JSON.stringify(payload)
  });
  const bytes = Buffer.from(await response.arrayBuffer());
  let body = null;
  let parseError = null;
  try { body = JSON.parse(bytes.toString('utf8')); } catch (e) { parseError = e.message; }
  return { response, bytes, body, parseError };
}
function classifyResponseFailure({response,bytes,body,parseError,company,rowsOk,shapeOk}) {
  const text = bytes.toString('utf8');
  if (response.status !== 200 || /access denied|captcha|security|驗證碼|forbidden|拒絕/i.test(text) || bytes.length < 100) return 'suspected_soft_block_or_transport_failure';
  if (parseError) return 'malformed_json';
  if (String(body?.code) !== '200' || !successful(body?.message) || String(body?.result?.companyId ?? '') !== company) return 'application_contract_failure';
  if (!rowsOk || !shapeOk) return 'schema_quality_failure';
  return null;
}
function transportMeta({kind,key,stock,attempt,payload,error}) {
  const meta = baseMeta({kind,key,stock,attempt,requestBody:payload,terminal:attempt >= 3 ? 'manual_review' : null});
  meta.failure_reason = 'transport_fetch_error';
  meta.transport_error_name = error?.name || null;
  meta.transport_error_message = String(error?.message || error);
  meta.request_started = true;
  return meta;
}

async function listing(stock, year) {
  const dir = path.join(RAW, 'listings', year, stock);
  const attempt = nextAttempt(dir);
  if (attempt > 3) throw new Error('manual_review_attempt_ceiling');
  const payload = { companyId: stock, year, month: 'all', firstDay: '', lastDay: '' };
  let result;
  try {
    result = await request(LIST_ENDPOINT, payload);
  } catch (error) {
    if (error?.code === 'SUPERSEDED_BEFORE_NETWORK') throw error;
    persistFailedAttempt(dir, transportMeta({kind:'historical_material_information_listing',key:`${stock}|${year}`,stock,attempt,payload,error}));
    throw error;
  }
  const { response, bytes, body, parseError } = result;
  const rows = body?.result?.data;
  const ds = Array.isArray(rows) ? descriptors(rows) : [];
  const failure = classifyResponseFailure({response,bytes,body,parseError,company:stock,rowsOk:Array.isArray(rows),shapeOk:Array.isArray(rows) && (rows.length === 0 || ds.length > 0)});
  const meta = baseMeta({kind:'historical_material_information_listing',key:`${stock}|${year}`,stock,attempt,requestBody:payload,status:response.status,url:response.url,bytes,body,quality:failure?'retryable_failure':'quality_passed',terminal:failure?(attempt>=3?'manual_review':null):(rows.length===0?'source_empty':null),rowCount:Array.isArray(rows)?rows.length:null,descriptorCount:ds.length});
  if (failure) {
    meta.failure_reason = failure;
    persistFailedAttempt(dir, meta, bytes);
    throw new Error(failure);
  }
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'source.json'), bytes);
  write(path.join(dir, 'source-meta.json'), meta);
  if (fs.existsSync(path.join(dir, 'attempt-meta.json'))) fs.rmSync(path.join(dir, 'attempt-meta.json'));
  console.log(JSON.stringify({ok:true,kind:'listing',stock,year,rows:rows.length,descriptors:ds.length,attempt}, null, 2));
}

async function detail(stock, year, enterDate, serialNumber, marketKind) {
  const dir = path.join(RAW, 'details', year, stock, `${enterDate}_${serialNumber}`);
  const attempt = nextAttempt(dir);
  if (attempt > 3) throw new Error('manual_review_attempt_ceiling');
  const payload = { enterDate, serialNumber, companyId: stock, marketKind };
  let result;
  try {
    result = await request(DETAIL_ENDPOINT, payload);
  } catch (error) {
    if (error?.code === 'SUPERSEDED_BEFORE_NETWORK') throw error;
    persistFailedAttempt(dir, transportMeta({kind:'historical_material_information_detail',key:`${stock}|${enterDate}|${serialNumber}|${marketKind}`,stock,attempt,payload,error}));
    throw error;
  }
  const { response, bytes, body, parseError } = result;
  const rows = body?.result?.data;
  const first = Array.isArray(rows) ? rows[0] : null;
  const titles = Array.isArray(body?.result?.titles) ? body.result.titles.map(x => x?.main) : [];
  const shapeOk = Array.isArray(rows) && (rows.length === 0 || (Array.isArray(first) && first.length === 10 && first.every(v => typeof v === 'string') && JSON.stringify(titles) === JSON.stringify(EXPECTED_DETAIL_TITLES)));
  const failure = classifyResponseFailure({response,bytes,body,parseError,company:stock,rowsOk:Array.isArray(rows),shapeOk});
  const sourceDate = first?.[1] || null;
  const sourceTime = first?.[2] || null;
  const seq = first?.[0] || serialNumber;
  const identityOk = rows?.length === 0 || (String(seq).trim() === serialNumber && String(sourceDate || '').replaceAll('/', '') === enterDate);
  const finalFailure = failure || (!identityOk ? 'descriptor_identity_mismatch' : null);
  const meta = baseMeta({kind:'historical_material_information_detail',key:`${stock}|${enterDate}|${serialNumber}|${marketKind}`,stock,attempt,requestBody:payload,status:response.status,url:response.url,bytes,body,quality:finalFailure?'retryable_failure':'quality_passed',terminal:finalFailure?(attempt>=3?'manual_review':null):(rows.length===0?'source_empty':null),sourceDate,sourceTime,sourceSequence:seq,rowCount:Array.isArray(rows)?rows.length:null});
  meta.titles = titles;
  meta.descriptor_identity_verified = !finalFailure && identityOk;
  if (finalFailure) {
    meta.failure_reason = finalFailure;
    persistFailedAttempt(dir, meta, bytes);
    throw new Error(finalFailure);
  }
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'source.json'), bytes);
  write(path.join(dir, 'source-meta.json'), meta);
  if (fs.existsSync(path.join(dir, 'attempt-meta.json'))) fs.rmSync(path.join(dir, 'attempt-meta.json'));
  console.log(JSON.stringify({ok:true,kind:'detail',stock,enterDate,serialNumber,marketKind,rows:rows.length,attempt}, null, 2));
}

async function main() {
  gate();
  const [kind, stock, year='115', a, b, c] = process.argv.slice(2);
  if (!STOCKS.has(String(stock))) throw new Error('Stock outside frozen preregistered set.');
  if (String(year) !== '115') throw new Error('Only ROC year 115 is authorized.');
  if (kind === 'listing') return listing(String(stock), String(year));
  if (kind === 'detail') {
    if (!/^\d{7}$/.test(String(a)) || !String(b) || !String(c)) throw new Error('detail requires enterDate serialNumber marketKind');
    return detail(String(stock), String(year), String(a), String(b), String(c));
  }
  throw new Error('Usage: listing STOCK 115 | detail STOCK 115 ENTERDATE SERIAL MARKETKIND');
}

if (require.main === module) main().catch(error => { console.error(error.stack || error.message); process.exitCode = 1; });
module.exports = { LIST_ENDPOINT, DETAIL_ENDPOINT, PARSER, PIT, VERSION_SAFETY, descriptors, successful, guardSupersededRun };
