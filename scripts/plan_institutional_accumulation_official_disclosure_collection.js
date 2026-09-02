#!/usr/bin/env node
'use strict';
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const RECONSTRUCTION = path.join(ROOT, 'data_research/institutional-flow/institutional-accumulation-official-disclosure-artifact-reconstruction-v1.json');
const RAW_ROOT = path.join(ROOT, 'data_research/institutional-flow/official-disclosure-raw');
const MONTHLY_MONTH = '202607';
const MATERIAL_YEAR = '115';
const MAX_ATTEMPTS = 3;
const CORRECTED_API_CONTRACT_VERSION = 'mops-api-t05st01-json-v1';
const ROW_SHAPE_PREFLIGHT_VERSION = 'institutional-accumulation-material-information-row-shape-detail-contract-preflight-v1';

function readJson(file, fallback = null) { try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return fallback; } }
function qualityPassed(meta) { return meta && meta.quality_state === 'quality_passed'; }
function retryable(meta) { return !meta || (meta.quality_state !== 'quality_passed' && Number(meta.attempt_count || 0) < MAX_ATTEMPTS && meta.terminal_state !== 'manual_review'); }
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

function legacyState(preflight) {
  if (preflight?.contracts?.legacy) return preflight.contracts.legacy;
  return {
    attempt_count: Number(preflight?.attempt_count || (preflight?.decision === 'blocked' ? 1 : 0)),
    retryable: preflight?.retryable === true,
    terminal_state: preflight?.terminal_state ?? null,
    historical_reason: preflight?.reason ?? null
  };
}

function correctedApiState(preflight) {
  const corrected = preflight?.contracts?.corrected_api;
  if (!corrected) return null;
  return {
    contract_version: corrected.contract_version || null,
    attempt_count: Number(corrected.attempt_count || 0),
    listing_contract_passed: corrected.listing_contract_passed === true,
    detail_contract_status: corrected.detail_contract?.status || 'unproven',
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

function plan({ reconstruction = readJson(RECONSTRUCTION), rawRoot = RAW_ROOT } = {}) {
  if (!reconstruction) throw new Error(`Missing reconstruction artifact: ${RECONSTRUCTION}`);
  const identities = unresolvedIdentities(reconstruction);
  const stocks = uniqueStocks(identities);
  const monthlyMeta = readJson(monthlyMetaPath(rawRoot));
  const preflight = readJson(preflightPath(rawRoot));
  const legacy = legacyState(preflight);
  const corrected = correctedApiState(preflight);

  const waveA = qualityPassed(monthlyMeta) ? [] : retryable(monthlyMeta) ? [{
    key: `mops-monthly-revenue|market=sii|revenue_month=${MONTHLY_MONTH}`,
    market: 'sii',
    revenue_month: MONTHLY_MONTH,
    attempt_count: Number(monthlyMeta?.attempt_count || 0)
  }] : [];

  const needed = rowShapePreflightNeeded(rawRoot, preflight);
  const waveB = needed ? [{
    key: `mops-material-information-row-shape-preflight|stock=${stocks[0]}|roc_year=${MATERIAL_YEAR}|contract=${CORRECTED_API_CONTRACT_VERSION}`,
    stock: stocks[0],
    roc_year: MATERIAL_YEAR,
    contract_version: CORRECTED_API_CONTRACT_VERSION
  }] : [];

  return {
    methodology: ROW_SHAPE_PREFLIGHT_VERSION,
    outcome_blind: true,
    unresolved_identity_count: identities.length,
    unique_stocks: stocks,
    wave_a: waveA,
    wave_b: waveB,
    wave_c: [],
    material_information_authorized: false,
    collection_round_preregistered: false,
    legacy_preflight_attempt_count: legacy.attempt_count,
    legacy_preflight_retryable: legacy.retryable,
    legacy_preflight_terminal_state: legacy.terminal_state,
    corrected_api_state: corrected,
    corrected_api_preflight_needed: needed
  };
}

if (require.main === module) console.log(JSON.stringify(plan(), null, 2));
module.exports = { MAX_ATTEMPTS, MONTHLY_MONTH, MATERIAL_YEAR, CORRECTED_API_CONTRACT_VERSION, ROW_SHAPE_PREFLIGHT_VERSION, plan, qualityPassed, retryable, unresolvedIdentities, uniqueStocks, legacyState, correctedApiState, rowShapePreflightNeeded };
