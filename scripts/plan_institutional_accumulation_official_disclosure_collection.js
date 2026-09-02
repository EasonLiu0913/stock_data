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

function readJson(file, fallback = null) { try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return fallback; } }
function qualityPassed(meta) { return meta && meta.quality_state === 'quality_passed'; }
function retryable(meta) { return !meta || (meta.quality_state !== 'quality_passed' && Number(meta.attempt_count || 0) < MAX_ATTEMPTS && meta.terminal_state !== 'manual_review'); }
function unresolvedIdentities(reconstruction) {
  const rows = (reconstruction?.decisions || []).filter(r => r.state === 'source_missing').map(r => ({stock:String(r.stock), t0:String(r.t0)}));
  if (rows.length !== 33) throw new Error(`Expected exactly 33 source_missing identities, got ${rows.length}`);
  return rows.sort((a,b)=>a.t0.localeCompare(b.t0)||a.stock.localeCompare(b.stock));
}
function uniqueStocks(rows) { return [...new Set(rows.map(r=>r.stock))].sort(); }
function monthlyMetaPath(root = RAW_ROOT) { return path.join(root, 'mops-monthly-revenue', MONTHLY_MONTH, 'source-meta.json'); }
function preflightPath(root = RAW_ROOT) { return path.join(root, 'mops-material-information', 'preflight.json'); }
function ambiguousPreflight(preflight) {
  return preflight?.decision === 'blocked' && /security_or_quality_block|soft_block|extraction_failure/.test(String(preflight?.reason || ''));
}
function preflightAttempts(preflight) {
  if (!preflight) return 0;
  const explicit = Number(preflight.attempt_count);
  if (Number.isFinite(explicit) && explicit >= 0) return explicit;
  return preflight.decision === 'blocked' ? 1 : 0;
}
function preflightRetryable(preflight) {
  return ambiguousPreflight(preflight) && preflight?.terminal_state !== 'manual_review' && preflightAttempts(preflight) < MAX_ATTEMPTS;
}
function plan({ reconstruction = readJson(RECONSTRUCTION), rawRoot = RAW_ROOT } = {}) {
  if (!reconstruction) throw new Error(`Missing reconstruction artifact: ${RECONSTRUCTION}`);
  const identities = unresolvedIdentities(reconstruction);
  const stocks = uniqueStocks(identities);
  const monthlyMeta = readJson(monthlyMetaPath(rawRoot));
  const preflight = readJson(preflightPath(rawRoot));
  const waveA = qualityPassed(monthlyMeta) ? [] : retryable(monthlyMeta) ? [{key:`mops-monthly-revenue|market=sii|revenue_month=${MONTHLY_MONTH}`, market:'sii', revenue_month:MONTHLY_MONTH, attempt_count:Number(monthlyMeta?.attempt_count||0)}] : [];
  const waveB = preflight?.decision === 'pass' ? [] : (!preflight || preflightRetryable(preflight) || preflight.decision !== 'blocked') ? [{key:`mops-material-information-preflight|stock=${stocks[0]}|roc_year=${MATERIAL_YEAR}`, stock:stocks[0], roc_year:MATERIAL_YEAR, attempt_count:preflightAttempts(preflight)}] : [];
  const waveC = preflight?.decision === 'pass' ? stocks.map(stock=>({key:`mops-material-information-listing|stock=${stock}|roc_year=${MATERIAL_YEAR}`,stock,roc_year:MATERIAL_YEAR})) : [];
  return { methodology:'institutional-accumulation-official-disclosure-source-collection-v1', outcome_blind:true, unresolved_identity_count:identities.length, unique_stocks:stocks, wave_a:waveA, wave_b:waveB, wave_c:waveC, material_information_authorized:preflight?.decision === 'pass', preflight_retryable:preflightRetryable(preflight), preflight_attempt_count:preflightAttempts(preflight) };
}
if (require.main === module) console.log(JSON.stringify(plan(), null, 2));
module.exports = { MAX_ATTEMPTS, MONTHLY_MONTH, MATERIAL_YEAR, plan, qualityPassed, retryable, unresolvedIdentities, uniqueStocks, ambiguousPreflight, preflightAttempts, preflightRetryable };
