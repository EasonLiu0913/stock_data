#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
const UNIVERSE_FILE = path.join(ROOT, 'data_prediction_analysis', 'monthly-revenue', 'fundamental-acceleration-universe.json');
const OUTPUT_ROOT = path.join(ROOT, 'data_finmind_quarterly_financial_quality');
const STATUS_ROOT = path.join(ROOT, 'data_prediction_analysis', 'quarterly-financial-quality', 'batch-status');

function readJson(file, fallback = null) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return fallback; }
}

function parseArgs(argv) {
  const args = new Map();
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg.startsWith('--')) continue;
    const key = arg.slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith('--')) args.set(key, true);
    else { args.set(key, next); i += 1; }
  }
  return args;
}

function finiteInt(value, fallback, min = 0) {
  const n = Number(value);
  return Number.isInteger(n) && n >= min ? n : fallback;
}

function qualifyingHits(stock, threshold) {
  return (stock.hit_events || []).filter(event => Number(event.score) >= threshold).length;
}

function selectCandidates(universe, threshold, minHits) {
  return (universe.stocks || [])
    .map(stock => ({
      stock_id: String(stock.stock_id),
      stock_name: stock.stock_name || null,
      max_score: Number(stock.max_score),
      qualifying_hits: qualifyingHits(stock, threshold),
      first_match_month: stock.first_match_month || null,
      first_known_date: stock.first_known_date || null,
    }))
    .filter(stock => stock.qualifying_hits >= minHits)
    .sort((a, b) => b.qualifying_hits - a.qualifying_hits || b.max_score - a.max_score || a.stock_id.localeCompare(b.stock_id));
}

function runNode(script, args, env = process.env) {
  const result = spawnSync(process.execPath, [path.join(ROOT, 'scripts', script), ...args], {
    cwd: ROOT,
    env,
    encoding: 'utf8',
    maxBuffer: 10 * 1024 * 1024,
  });
  return {
    ok: result.status === 0,
    status: result.status,
    stdout: String(result.stdout || '').trim(),
    stderr: String(result.stderr || '').trim(),
  };
}

function hasCompleteOutput(stockId, startQuarter, endQuarter) {
  const dir = path.join(OUTPUT_ROOT, stockId);
  const first = path.join(dir, `${startQuarter}.json`);
  const last = path.join(dir, `${endQuarter}.json`);
  const timeline = path.join(dir, 'financial-quality-score-timeline.json');
  return fs.existsSync(first) && fs.existsSync(last) && fs.existsSync(timeline);
}

function compactError(result) {
  const text = result.stderr || result.stdout || `exit status ${result.status}`;
  return text.replace(/\s+/g, ' ').slice(0, 1200);
}

function main(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  const threshold = finiteInt(args.get('score-threshold'), 9, 0);
  const minHits = finiteInt(args.get('min-hits'), 2, 1);
  const batchIndex = finiteInt(args.get('batch-index'), 0, 0);
  const batchSize = finiteInt(args.get('batch-size'), 20, 1);
  const startQuarter = String(args.get('start-quarter') || '2023Q1');
  const endQuarter = String(args.get('end-quarter') || '2026Q2');
  const force = String(args.get('force') || 'false').toLowerCase() === 'true';

  const universe = readJson(UNIVERSE_FILE);
  if (!universe || !Array.isArray(universe.stocks)) throw new Error(`Missing or invalid universe: ${path.relative(ROOT, UNIVERSE_FILE)}`);

  const candidates = selectCandidates(universe, threshold, minHits);
  const totalBatches = Math.ceil(candidates.length / batchSize);
  if (batchIndex >= totalBatches) {
    throw new Error(`batch-index ${batchIndex} out of range; candidates=${candidates.length}, batch_size=${batchSize}, valid_batch_indexes=0-${Math.max(0, totalBatches - 1)}`);
  }
  const start = batchIndex * batchSize;
  const selected = candidates.slice(start, start + batchSize);
  const results = [];

  for (const candidate of selected) {
    const stockId = candidate.stock_id;
    if (!force && hasCompleteOutput(stockId, startQuarter, endQuarter)) {
      results.push({ ...candidate, status: 'skipped_complete' });
      console.log(`[skip] ${stockId} already complete`);
      continue;
    }

    console.log(`[backfill] ${stockId} (${candidate.stock_name || ''}) hits=${candidate.qualifying_hits} max=${candidate.max_score}`);
    const backfill = runNode('backfill_finmind_quarterly_financial_quality.js', [
      '--stock-id', stockId,
      '--start-quarter', startQuarter,
      '--end-quarter', endQuarter,
    ]);
    if (!backfill.ok) {
      results.push({ ...candidate, status: 'backfill_failed', error: compactError(backfill) });
      console.error(`[failed] ${stockId}: ${compactError(backfill)}`);
      continue;
    }

    const timeline = runNode('generate_financial_quality_score_timeline.js', [
      '--stock-id', stockId,
      '--start-quarter', startQuarter,
      '--end-quarter', endQuarter,
    ]);
    if (!timeline.ok) {
      results.push({ ...candidate, status: 'timeline_failed', error: compactError(timeline) });
      console.error(`[timeline failed] ${stockId}: ${compactError(timeline)}`);
      continue;
    }

    results.push({ ...candidate, status: 'complete' });
    console.log(`[ok] ${stockId}`);
  }

  const counts = results.reduce((acc, row) => {
    acc[row.status] = (acc[row.status] || 0) + 1;
    return acc;
  }, {});
  const completedOrSkipped = (counts.complete || 0) + (counts.skipped_complete || 0);

  const status = {
    schema_version: 1,
    dataset: 'finmind_quarterly_financial_quality_batch_status',
    generated_at: new Date().toISOString(),
    methodology: {
      candidate_rule: `monthly fundamental acceleration score >= ${threshold} in at least ${minHits} months`,
      score_threshold: threshold,
      min_hits: minHits,
      start_quarter: startQuarter,
      end_quarter: endQuarter,
      batch_index: batchIndex,
      batch_size: batchSize,
      force,
    },
    universe: {
      unique_candidates: candidates.length,
      includes_2059: candidates.some(row => row.stock_id === '2059'),
      total_batches: totalBatches,
      selected_start_offset: start,
      selected_count: selected.length,
    },
    counts,
    results,
  };

  fs.mkdirSync(STATUS_ROOT, { recursive: true });
  const statusFile = path.join(STATUS_ROOT, `score${threshold}-hits${minHits}-batch${String(batchIndex).padStart(3, '0')}.json`);
  fs.writeFileSync(statusFile, `${JSON.stringify(status, null, 2)}\n`, 'utf8');

  console.log(JSON.stringify({
    output: path.relative(ROOT, statusFile),
    unique_candidates: candidates.length,
    includes_2059: status.universe.includes_2059,
    total_batches: totalBatches,
    batch_index: batchIndex,
    batch_size: batchSize,
    selected_count: selected.length,
    counts,
  }, null, 2));

  if (completedOrSkipped === 0) {
    throw new Error(`Batch ${batchIndex} produced zero complete/skipped stocks; inspect ${path.relative(ROOT, statusFile)}`);
  }
}

if (require.main === module) {
  try { main(); } catch (error) { console.error(error.stack || error.message); process.exitCode = 1; }
}

module.exports = { qualifyingHits, selectCandidates };
