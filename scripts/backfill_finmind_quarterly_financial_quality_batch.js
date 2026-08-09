#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
const UNIVERSE_FILE = path.join(ROOT, 'data_prediction_analysis', 'monthly-revenue', 'fundamental-acceleration-universe.json');
const OUTPUT_ROOT = path.join(ROOT, 'data_finmind_quarterly_financial_quality');
const STATUS_ROOT = path.join(ROOT, 'data_prediction_analysis', 'quarterly-financial-quality', 'batch-status');

function readJson(file, fallback = null) { try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return fallback; } }
function parseArgs(argv) {
  const args = new Map();
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg.startsWith('--')) continue;
    const key = arg.slice(2), next = argv[i + 1];
    if (!next || next.startsWith('--')) args.set(key, true);
    else { args.set(key, next); i += 1; }
  }
  return args;
}
function finiteInt(value, fallback, min = 0) { const n = Number(value); return Number.isInteger(n) && n >= min ? n : fallback; }
function qualifyingHits(stock, threshold) { return (stock.hit_events || []).filter(event => Number(event.score) >= threshold).length; }
function selectCandidates(universe, rule = {}) {
  const coreThreshold = finiteInt(rule.coreThreshold, 9, 0), coreMinHits = finiteInt(rule.coreMinHits, 2, 1);
  const persistentThreshold = finiteInt(rule.persistentThreshold, 8, 0), persistentMinHits = finiteInt(rule.persistentMinHits, 3, 1);
  return (universe.stocks || []).map(stock => {
    const coreHits = qualifyingHits(stock, coreThreshold), persistentHits = qualifyingHits(stock, persistentThreshold);
    const coreMatch = coreHits >= coreMinHits, persistentMatch = persistentHits >= persistentMinHits;
    return { stock_id: String(stock.stock_id), stock_name: stock.stock_name || null, max_score: Number(stock.max_score), core_hits: coreHits, persistent_hits: persistentHits, candidate_tracks: [coreMatch ? 'high_intensity' : null, persistentMatch ? 'persistent_strength' : null].filter(Boolean), first_match_month: stock.first_match_month || null, first_known_date: stock.first_known_date || null };
  }).filter(stock => stock.candidate_tracks.length > 0)
    .sort((a, b) => b.core_hits - a.core_hits || b.persistent_hits - a.persistent_hits || b.max_score - a.max_score || a.stock_id.localeCompare(b.stock_id));
}
function runNode(script, args, env = process.env) {
  const result = spawnSync(process.execPath, [path.join(ROOT, 'scripts', script), ...args], { cwd: ROOT, env, encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 });
  return { ok: result.status === 0, status: result.status, stdout: String(result.stdout || '').trim(), stderr: String(result.stderr || '').trim() };
}
function sleepSync(ms) {
  if (ms <= 0) return;
  const sab = new SharedArrayBuffer(4);
  Atomics.wait(new Int32Array(sab), 0, 0, ms);
}
function coverageMatches(stockId, startQuarter, endQuarter) {
  const dir = path.join(OUTPUT_ROOT, stockId);
  const coverage = readJson(path.join(dir, 'coverage-status.json'));
  const timeline = path.join(dir, 'financial-quality-score-timeline.json');
  return Boolean(coverage && coverage.requested?.start_quarter === startQuarter && coverage.requested?.end_quarter === endQuarter && fs.existsSync(timeline));
}
function compactError(result) { return (result.stderr || result.stdout || `exit status ${result.status}`).replace(/\s+/g, ' ').slice(0, 1200); }

function main(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  const coreThreshold = finiteInt(args.get('core-score-threshold'), 9, 0), coreMinHits = finiteInt(args.get('core-min-hits'), 2, 1);
  const persistentThreshold = finiteInt(args.get('persistent-score-threshold'), 8, 0), persistentMinHits = finiteInt(args.get('persistent-min-hits'), 3, 1);
  const batchIndex = finiteInt(args.get('batch-index'), 0, 0), batchSize = finiteInt(args.get('batch-size'), 20, 1);
  const delayMs = finiteInt(args.get('delay-ms'), 2000, 0), jitterMs = finiteInt(args.get('jitter-ms'), 750, 0);
  const startQuarter = String(args.get('start-quarter') || '2023Q1'), endQuarter = String(args.get('end-quarter') || '2026Q2');
  const asOfDate = String(args.get('as-of-date') || new Date().toISOString().slice(0, 10));
  const force = String(args.get('force') || 'false').toLowerCase() === 'true';

  const universe = readJson(UNIVERSE_FILE);
  if (!universe || !Array.isArray(universe.stocks)) throw new Error(`Missing or invalid universe: ${path.relative(ROOT, UNIVERSE_FILE)}`);
  const rule = { coreThreshold, coreMinHits, persistentThreshold, persistentMinHits };
  const candidates = selectCandidates(universe, rule), includes2059 = candidates.some(row => row.stock_id === '2059');
  console.log(JSON.stringify({ candidate_rule: `score>=${coreThreshold} in >=${coreMinHits} months OR score>=${persistentThreshold} in >=${persistentMinHits} months`, unique_candidates: candidates.length, includes_2059: includes2059, pacing: { delay_ms: delayMs, jitter_ms: jitterMs } }, null, 2));
  if (!includes2059) throw new Error('Candidate rule excludes calibration sample 2059; stop before consuming FinMind API.');

  const totalBatches = Math.ceil(candidates.length / batchSize);
  if (batchIndex >= totalBatches) throw new Error(`batch-index ${batchIndex} out of range; candidates=${candidates.length}, batch_size=${batchSize}`);
  const selected = candidates.slice(batchIndex * batchSize, batchIndex * batchSize + batchSize), results = [];

  for (let i = 0; i < selected.length; i += 1) {
    const candidate = selected[i], stockId = candidate.stock_id;
    if (!force && coverageMatches(stockId, startQuarter, endQuarter)) {
      results.push({ ...candidate, status: 'skipped_complete' });
      console.log(`[skip] ${stockId} already complete`);
    } else {
      console.log(`[backfill] ${stockId} (${candidate.stock_name || ''}) core_hits=${candidate.core_hits} persistent_hits=${candidate.persistent_hits} max=${candidate.max_score}`);
      const backfill = runNode('backfill_finmind_quarterly_financial_quality.js', ['--stock-id', stockId, '--start-quarter', startQuarter, '--end-quarter', endQuarter, '--as-of-date', asOfDate]);
      if (!backfill.ok) {
        if (backfill.status === 3 || /unsupported_financial_model/i.test(`${backfill.stderr} ${backfill.stdout}`)) {
          results.push({ ...candidate, status: 'unsupported_financial_model', error: compactError(backfill) });
          console.warn(`[unsupported] ${stockId}: general-industry financial-quality model does not apply`);
        } else {
          results.push({ ...candidate, status: 'backfill_failed', error: compactError(backfill) });
          console.error(`[failed] ${stockId}: ${compactError(backfill)}`);
        }
      } else {
        const timeline = runNode('generate_financial_quality_score_timeline.js', ['--stock-id', stockId, '--start-quarter', startQuarter, '--end-quarter', endQuarter]);
        if (!timeline.ok) {
          results.push({ ...candidate, status: 'timeline_failed', error: compactError(timeline) });
          console.error(`[timeline failed] ${stockId}: ${compactError(timeline)}`);
        } else {
          const coverage = readJson(path.join(OUTPUT_ROOT, stockId, 'coverage-status.json'), {});
          const missingCounts = (coverage.missing_periods || []).reduce((acc, row) => { acc[row.reason] = (acc[row.reason] || 0) + 1; return acc; }, {});
          results.push({ ...candidate, status: 'complete', available_periods: (coverage.available_periods || []).length, missing_period_counts: missingCounts });
          console.log(`[ok] ${stockId} available=${(coverage.available_periods || []).length} missing=${JSON.stringify(missingCounts)}`);
        }
      }
    }

    if (i < selected.length - 1) {
      const wait = delayMs + (jitterMs > 0 ? Math.floor(Math.random() * (jitterMs + 1)) : 0);
      console.log(`[pace] wait ${wait}ms before next stock`);
      sleepSync(wait);
    }
  }

  const counts = results.reduce((acc, row) => { acc[row.status] = (acc[row.status] || 0) + 1; return acc; }, {});
  const usable = (counts.complete || 0) + (counts.skipped_complete || 0) + (counts.unsupported_financial_model || 0);
  const status = {
    schema_version: 3, dataset: 'finmind_quarterly_financial_quality_batch_status', generated_at: new Date().toISOString(),
    methodology: { candidate_rule: `monthly acceleration score >= ${coreThreshold} in at least ${coreMinHits} months OR score >= ${persistentThreshold} in at least ${persistentMinHits} months`, core: { score_threshold: coreThreshold, min_hits: coreMinHits }, persistent: { score_threshold: persistentThreshold, min_hits: persistentMinHits }, start_quarter: startQuarter, end_quarter: endQuarter, as_of_date: asOfDate, batch_index: batchIndex, batch_size: batchSize, delay_ms: delayMs, jitter_ms: jitterMs, force },
    universe: { unique_candidates: candidates.length, includes_2059: includes2059, total_batches: totalBatches, selected_start_offset: batchIndex * batchSize, selected_count: selected.length }, counts, results,
  };
  fs.mkdirSync(STATUS_ROOT, { recursive: true });
  const statusFile = path.join(STATUS_ROOT, `dual-track-batch${String(batchIndex).padStart(3, '0')}.json`);
  fs.writeFileSync(statusFile, `${JSON.stringify(status, null, 2)}\n`, 'utf8');
  console.log(JSON.stringify({ output: path.relative(ROOT, statusFile), unique_candidates: candidates.length, includes_2059: includes2059, total_batches: totalBatches, batch_index: batchIndex, batch_size: batchSize, selected_count: selected.length, counts }, null, 2));
  if (usable === 0) throw new Error(`Batch ${batchIndex} produced zero usable/classified stocks; inspect ${path.relative(ROOT, statusFile)}`);
}

if (require.main === module) { try { main(); } catch (error) { console.error(error.stack || error.message); process.exitCode = 1; } }
module.exports = { qualifyingHits, selectCandidates };
