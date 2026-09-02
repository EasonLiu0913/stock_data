#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { discoverTradingDates } = require('./fundamental_event_timeline');
const { fallbackFormalEvents, dedupeEvents } = require('./build_fundamental_event_timeline');

const ROOT = path.resolve(__dirname, '..');
const PRIOR_AUDIT = path.join(ROOT, 'data_research', 'institutional-flow', 'institutional-accumulation-official-disclosure-pit-coverage-audit-v1.json');
const OUTPUT = path.join(ROOT, 'data_research', 'institutional-flow', 'institutional-accumulation-official-disclosure-artifact-reconstruction-v1.json');
const ALLOWED_STATES = new Set(['reconstructable_from_pre_T0_durable_inputs','source_exists_but_version_or_timing_unsafe','source_missing','not_applicable']);

function readJson(file) { return JSON.parse(fs.readFileSync(file, 'utf8')); }
function compactDate(value) { return String(value || '').replace(/-/g, '').slice(0, 8); }
function t0EndIso(t0) { return `${t0.slice(0,4)}-${t0.slice(4,6)}-${t0.slice(6,8)}T23:59:59+08:00`; }
function parseArgs(argv) { return new Set(argv.filter(x => x.startsWith('--')).map(x => x.slice(2))); }

function gitLastCommitIso(relativePath, root = ROOT) {
  try { return execFileSync('git', ['log','-1','--format=%cI','--',relativePath], { cwd: root, encoding: 'utf8' }).trim() || null; }
  catch { return null; }
}

function listQuarterlySources(stock, root = ROOT) {
  const dir = path.join(root, 'data_finmind_quarterly_financial_quality', stock);
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter(name => /^20\d{2}Q[1-4]\.json$/.test(name)).sort().map(name => {
    const relative = path.posix.join('data_finmind_quarterly_financial_quality', stock, name);
    const payload = readJson(path.join(root, relative));
    return { relative, period: name.replace('.json',''), conservative_known_date: compactDate(payload?.methodology?.conservative_known_date) };
  });
}

function classifyIdentity(identity, options = {}) {
  const root = path.resolve(options.root || ROOT);
  const historyResolver = options.historyResolver || (relative => gitLastCommitIso(relative, root));
  const sources = listQuarterlySources(identity.stock, root).map(source => {
    const commit = historyResolver(source.relative);
    const knownByT0 = /^20\d{6}$/.test(source.conservative_known_date) && source.conservative_known_date <= identity.t0;
    const commitByT0 = Boolean(commit) && Date.parse(commit) <= Date.parse(t0EndIso(identity.t0));
    return { ...source, last_commit_at: commit, known_by_t0: knownByT0, commit_by_t0: commitByT0 };
  });
  const historicallyRelevant = sources.filter(source => source.known_by_t0);
  const safe = historicallyRelevant.filter(source => source.commit_by_t0);
  let state;
  if (safe.length) state = 'reconstructable_from_pre_T0_durable_inputs';
  else if (historicallyRelevant.length) state = 'source_exists_but_version_or_timing_unsafe';
  else if (!sources.length) state = 'source_missing';
  else state = 'not_applicable';
  if (!ALLOWED_STATES.has(state)) throw new Error(`Unexpected reconstruction state: ${state}`);
  return { stock: identity.stock, t0: identity.t0, artifact: identity.artifact, state, safe_source_paths: safe.map(x => x.relative), source_evidence: sources };
}

function writeReconstructedArtifact(stock, year, decisions, options = {}) {
  const root = path.resolve(options.root || ROOT);
  const historyResolver = options.historyResolver || (relative => gitLastCommitIso(relative, root));
  const t0s = decisions.filter(x => x.stock === stock && x.artifact.endsWith(`/${year}.json`)).map(x => x.t0).sort();
  const asOfCompact = t0s[t0s.length - 1];
  const asOfDate = `${asOfCompact.slice(0,4)}-${asOfCompact.slice(4,6)}-${asOfCompact.slice(6,8)}`;
  const all = fallbackFormalEvents(stock, discoverTradingDates(root), asOfDate);
  const safeEvents = all.filter(event => {
    const sourceFile = event?.source?.source_file;
    if (!sourceFile) return false;
    const commit = historyResolver(sourceFile);
    return Boolean(commit) && Date.parse(commit) <= Date.parse(t0EndIso(asOfCompact));
  });
  if (!safeEvents.length) return null;
  const rows = dedupeEvents(safeEvents);
  const dir = path.join(root, 'data_fundamental_events', stock);
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `${year}.json`);
  const payload = {
    schema_version: 1,
    dataset: 'fundamental_event_timeline',
    generated_at: new Date().toISOString(),
    shadow_mode: true,
    stock_id: stock,
    year,
    as_of_date: asOfDate,
    event_count: rows.length,
    reconstruction: { method: 'offline_pre_t0_durable_financial_fallback_only', network_collection_used: false, source_history_verified: true, source_paths: [...new Set(rows.map(event => event?.source?.source_file).filter(Boolean))] },
    events: rows,
  };
  fs.writeFileSync(file, `${JSON.stringify(payload, null, 2)}\n`);
  return path.relative(root, file).replace(/\\/g, '/');
}

function buildReconstruction(options = {}) {
  const root = path.resolve(options.root || ROOT);
  const audit = readJson(path.join(root, path.relative(ROOT, PRIOR_AUDIT)));
  if (audit.scope?.outcome_values_read !== false || audit.scope?.holdout_outcomes_read !== false || audit.scope?.protected_2454_outcomes_read !== false) throw new Error('Prior audit violates outcome-blind boundary');
  const missing = (audit.identities || []).filter(row => row.primary_coverage === 'missing_artifact');
  const decisions = missing.map(identity => classifyIdentity(identity, options));
  if (decisions.length !== Number(audit.summary?.missing_artifact_identities || 0)) throw new Error('Missing identity count mismatch');
  const counts = Object.fromEntries([...ALLOWED_STATES].map(state => [state, decisions.filter(x => x.state === state).length]));
  return { audit, decisions, counts };
}

function main(argv = process.argv.slice(2)) {
  const apply = parseArgs(argv).has('apply');
  const { audit, decisions, counts } = buildReconstruction();
  const reconstructed = [];
  if (apply) {
    const keys = [...new Set(decisions.filter(x => x.state === 'reconstructable_from_pre_T0_durable_inputs').map(x => x.artifact))].sort();
    for (const artifact of keys) {
      const match = artifact.match(/^data_fundamental_events\/(\d+)\/(20\d{2})\.json$/);
      if (!match) throw new Error(`Unexpected artifact path: ${artifact}`);
      const written = writeReconstructedArtifact(match[1], match[2], decisions);
      if (written) reconstructed.push(written);
    }
  }
  const payload = {
    reconstruction_id: 'institutional-accumulation-official-disclosure-artifact-reconstruction-v1',
    generated_at: new Date().toISOString(),
    outcome_blind: true,
    network_collection_used: false,
    protected_2454_outcomes_read: false,
    development_outcome_values_read: false,
    holdout_outcomes_read: false,
    before_summary: audit.summary,
    missing_identity_count: decisions.length,
    classification_counts: counts,
    decisions,
    reconstructed_artifacts: reconstructed,
    after_summary: null,
    unresolved_gaps: decisions.filter(x => x.state !== 'reconstructable_from_pre_T0_durable_inputs').map(x => ({ stock: x.stock, t0: x.t0, state: x.state })),
  };
  fs.mkdirSync(path.dirname(OUTPUT), { recursive: true });
  fs.writeFileSync(OUTPUT, `${JSON.stringify(payload, null, 2)}\n`);
  console.log(JSON.stringify({ apply, missing_identity_count: decisions.length, classification_counts: counts, reconstructed_artifacts: reconstructed }, null, 2));
}

if (require.main === module) main();
module.exports = { ALLOWED_STATES, compactDate, listQuarterlySources, classifyIdentity, writeReconstructedArtifact, buildReconstruction };
