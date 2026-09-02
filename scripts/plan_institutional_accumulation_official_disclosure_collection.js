#!/usr/bin/env node
'use strict';
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const RECONSTRUCTION = path.join(ROOT, 'data_research/institutional-flow/institutional-accumulation-official-disclosure-artifact-reconstruction-v1.json');
const RAW_ROOT = path.join(ROOT, 'data_research/institutional-flow/official-disclosure-raw');
const MONTHLY_MONTH = '202607';
const MATERIAL_YEAR = '115';
const MATERIAL_STOCKS = Object.freeze(['1102','1103','1104','1109','1201','1203','1215','1216','1217']);
const MAX_ATTEMPTS = 3;
const CORRECTED_API_CONTRACT_VERSION = 'mops-api-t05st01-json-v1';
const ROW_SHAPE_PREFLIGHT_VERSION = 'institutional-accumulation-material-information-row-shape-detail-contract-preflight-v1';
const WAVE_C_METHODOLOGY = 'institutional-accumulation-material-information-wave-c-physical-batch-collection-v1';

function readJson(file, fallback = null) { try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return fallback; } }
function qualityPassed(meta) { return meta && meta.quality_state === 'quality_passed'; }
function attempts(meta) { return Number(meta?.attempt_count || 0); }
function retryable(meta) { return !qualityPassed(meta) && attempts(meta) < MAX_ATTEMPTS && meta?.terminal_state !== 'manual_review' && meta?.terminal_state !== 'source_empty'; }
function unresolvedIdentities(reconstruction) {
  const rows = (reconstruction?.decisions || []).filter(r => r.state === 'source_missing').map(r => ({ stock: String(r.stock), t0: String(r.t0) }));
  if (rows.length !== 33) throw new Error(`Expected exactly 33 source_missing identities, got ${rows.length}`);
  return rows.sort((a, b) => a.t0.localeCompare(b.t0) || a.stock.localeCompare(b.stock));
}
function uniqueStocks(rows) { return [...new Set(rows.map(r => r.stock))].sort(); }
function monthlyMetaPath(root = RAW_ROOT) { return path.join(root, 'mops-monthly-revenue', MONTHLY_MONTH, 'source-meta.json'); }
function preflightPath(root = RAW_ROOT) { return path.join(root, 'mops-material-information', 'preflight.json'); }
function correctedRawPath(root = RAW_ROOT) { return path.join(root, 'mops-material-information', 'corrected-api-preflight', 'source.json'); }
function correctedRawMetaPath(root = RAW_ROOT) { return path.join(root, 'mops-material-information', 'corrected-api-preflight', 'source-meta.json'); }
function listingDir(root, stock, year = MATERIAL_YEAR) { return path.join(root, 'mops-material-information', 'listings', year, stock); }
function listingMetaPath(root, stock, year = MATERIAL_YEAR) { return path.join(listingDir(root, stock, year), 'source-meta.json'); }
function listingSourcePath(root, stock, year = MATERIAL_YEAR) { return path.join(listingDir(root, stock, year), 'source.json'); }
function listingAttemptMetaPath(root, stock, year = MATERIAL_YEAR) { return path.join(listingDir(root, stock, year), 'attempt-meta.json'); }
function detailKey(p) { return `${p.companyId}|${p.enterDate}|${p.serialNumber}|${p.marketKind}`; }
function detailDir(root, p, year = MATERIAL_YEAR) { return path.join(root, 'mops-material-information', 'details', year, p.companyId, `${p.enterDate}_${p.serialNumber}`); }
function detailMetaPath(root, p, year = MATERIAL_YEAR) { return path.join(detailDir(root, p, year), 'source-meta.json'); }
function detailAttemptMetaPath(root, p, year = MATERIAL_YEAR) { return path.join(detailDir(root, p, year), 'attempt-meta.json'); }

function legacyState(preflight) {
  if (preflight?.contracts?.legacy) return preflight.contracts.legacy;
  return { attempt_count: Number(preflight?.attempt_count || 0), retryable: preflight?.retryable === true, terminal_state: preflight?.terminal_state ?? null };
}
function correctedApiState(preflight) {
  const corrected = preflight?.contracts?.corrected_api;
  if (!corrected) return null;
  return {
    contract_version: corrected.contract_version || null,
    attempt_count: Number(corrected.attempt_count || 0),
    listing_contract_passed: corrected.listing_contract_passed === true,
    detail_contract_status: corrected.detail_contract?.status || 'unproven',
    descriptor_mapping_verified: corrected.detail_contract?.descriptor_mapping_verified === true,
    decision: preflight?.decision || null,
    reason: preflight?.reason || null,
    methodology: preflight?.methodology || null
  };
}
function rowShapePreflightNeeded(root, preflight) {
  const raw = readJson(correctedRawPath(root));
  const meta = readJson(correctedRawMetaPath(root));
  const durableListingPassed = preflight?.contracts?.corrected_api?.listing_contract_passed === true;
  return !(raw && meta && meta.methodology === ROW_SHAPE_PREFLIGHT_VERSION && durableListingPassed);
}
function waveCAuthorized(preflight, monthlyMeta, identities) {
  const c = preflight?.contracts?.corrected_api;
  return identities.length === 33 && qualityPassed(monthlyMeta) && preflight?.decision === 'listing_and_detail_contract_passed' && c?.listing_contract_passed === true && c?.detail_contract?.status === 'passed' && c?.detail_contract?.descriptor_mapping_verified === true && Number(preflight?.contracts?.legacy?.attempt_count) === 2;
}
function descriptorRows(raw, stock) {
  const rows = Array.isArray(raw?.result?.data) ? raw.result.data : [];
  const out = [];
  function visit(v) {
    if (!v || typeof v !== 'object') return;
    if (!Array.isArray(v) && v.apiName === 't05st01_detail' && v.parameters) {
      const p = Object.fromEntries(['enterDate','serialNumber','companyId','marketKind'].map(k => [k, String(v.parameters[k] ?? '')]));
      if (p.companyId === stock && p.enterDate && p.serialNumber && p.marketKind) out.push(p);
    }
    if (Array.isArray(v)) v.forEach(visit); else Object.values(v).forEach(visit);
  }
  visit(rows);
  const seen = new Set();
  return out.filter(p => !seen.has(detailKey(p)) && seen.add(detailKey(p))).sort((a,b) => a.enterDate.localeCompare(b.enterDate) || a.serialNumber.localeCompare(b.serialNumber));
}
function latestMeta(root, canonicalPath, attemptPath) { return readJson(canonicalPath) || readJson(attemptPath); }

function plan({ reconstruction = readJson(RECONSTRUCTION), rawRoot = RAW_ROOT } = {}) {
  if (!reconstruction) throw new Error(`Missing reconstruction artifact: ${RECONSTRUCTION}`);
  const identities = unresolvedIdentities(reconstruction);
  const stocks = uniqueStocks(identities);
  if (JSON.stringify(stocks) !== JSON.stringify(MATERIAL_STOCKS)) throw new Error(`Frozen stock set mismatch: ${JSON.stringify(stocks)}`);
  const monthlyMeta = readJson(monthlyMetaPath(rawRoot));
  const preflight = readJson(preflightPath(rawRoot));
  const legacy = legacyState(preflight);
  const corrected = correctedApiState(preflight);
  const waveA = qualityPassed(monthlyMeta) ? [] : retryable(monthlyMeta) ? [{ key:`mops-monthly-revenue|market=sii|revenue_month=${MONTHLY_MONTH}`, market:'sii', revenue_month:MONTHLY_MONTH, attempt_count:attempts(monthlyMeta) }] : [];
  const needed = rowShapePreflightNeeded(rawRoot, preflight);
  const waveB = needed ? [{ key:`mops-material-information-row-shape-preflight|stock=${stocks[0]}|roc_year=${MATERIAL_YEAR}|contract=${CORRECTED_API_CONTRACT_VERSION}`, stock:stocks[0], roc_year:MATERIAL_YEAR, contract_version:CORRECTED_API_CONTRACT_VERSION }] : [];
  const authorized = waveCAuthorized(preflight, monthlyMeta, identities) && waveA.length === 0 && waveB.length === 0;
  const listingQueue = [];
  const detailQueue = [];
  const manualReview = [];
  if (authorized) {
    for (const stock of MATERIAL_STOCKS) {
      const canonical = readJson(listingMetaPath(rawRoot, stock));
      const latest = latestMeta(rawRoot, listingMetaPath(rawRoot, stock), listingAttemptMetaPath(rawRoot, stock));
      if (!qualityPassed(canonical)) {
        if (retryable(latest)) listingQueue.push({ key:`mops-material-information-listing|stock=${stock}|roc_year=${MATERIAL_YEAR}`, kind:'listing', stock, roc_year:MATERIAL_YEAR, attempt_count:attempts(latest) });
        else manualReview.push({ kind:'listing', stock, roc_year:MATERIAL_YEAR, attempt_count:attempts(latest), terminal_state:latest?.terminal_state || 'manual_review' });
        continue;
      }
      const raw = readJson(listingSourcePath(rawRoot, stock));
      if (!raw) throw new Error(`Quality-passed listing meta without source.json for ${stock}`);
      for (const p of descriptorRows(raw, stock)) {
        const canonicalDetail = readJson(detailMetaPath(rawRoot, p));
        const latestDetail = latestMeta(rawRoot, detailMetaPath(rawRoot, p), detailAttemptMetaPath(rawRoot, p));
        if (qualityPassed(canonicalDetail)) continue;
        if (retryable(latestDetail)) detailQueue.push({ key:`mops-material-information-detail|stock=${p.companyId}|enterDate=${p.enterDate}|serial=${p.serialNumber}|market=${p.marketKind}`, kind:'detail', stock:p.companyId, roc_year:MATERIAL_YEAR, enterDate:p.enterDate, serialNumber:p.serialNumber, marketKind:p.marketKind, attempt_count:attempts(latestDetail) });
        else manualReview.push({ kind:'detail', ...p, attempt_count:attempts(latestDetail), terminal_state:latestDetail?.terminal_state || 'manual_review' });
      }
    }
  }
  const waveC = [...listingQueue, ...detailQueue];
  return {
    methodology: WAVE_C_METHODOLOGY,
    outcome_blind: true,
    unresolved_identity_count: identities.length,
    unique_stocks: stocks,
    wave_a: waveA,
    wave_b: waveB,
    wave_c: waveC,
    wave_c_listing: listingQueue,
    wave_c_detail: detailQueue,
    manual_review: manualReview,
    material_information_authorized: authorized,
    collection_round_preregistered: true,
    legacy_preflight_attempt_count: legacy.attempt_count,
    legacy_preflight_retryable: legacy.retryable,
    legacy_preflight_terminal_state: legacy.terminal_state,
    corrected_api_state: corrected,
    corrected_api_preflight_needed: needed
  };
}

if (require.main === module) console.log(JSON.stringify(plan(), null, 2));
module.exports = { MAX_ATTEMPTS, MONTHLY_MONTH, MATERIAL_YEAR, MATERIAL_STOCKS, CORRECTED_API_CONTRACT_VERSION, ROW_SHAPE_PREFLIGHT_VERSION, WAVE_C_METHODOLOGY, plan, qualityPassed, retryable, unresolvedIdentities, uniqueStocks, legacyState, correctedApiState, rowShapePreflightNeeded, waveCAuthorized, descriptorRows, detailKey };
