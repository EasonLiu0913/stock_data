#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { scoreComponents } = require('./summarize_mops_revenue_fundamental_acceleration_score');

const ROOT = path.resolve(__dirname, '..');
const SIGNAL_ROOT = path.join(ROOT, 'data_prediction_analysis', 'monthly-revenue', 'monthly-signals');
const REVENUE_ROOT = path.join(ROOT, 'data_mops_monthly_revenue');
const OUTPUT = path.join(ROOT, 'data_prediction_analysis', 'monthly-revenue', 'fundamental-acceleration-universe.json');
const SUMMARY_OUTPUT = path.join(ROOT, 'data_prediction_analysis', 'monthly-revenue', 'fundamental-acceleration-universe-summary.json');

function readJson(file, fallback = null) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return fallback; }
}

function parseArgs(argv) {
  const out = new Map();
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg.startsWith('--')) continue;
    const key = arg.slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith('--')) out.set(key, true);
    else { out.set(key, next); i += 1; }
  }
  return out;
}

function loadRevenueHistory() {
  const byStock = new Map();
  if (!fs.existsSync(REVENUE_ROOT)) return byStock;
  const months = fs.readdirSync(REVENUE_ROOT, { withFileTypes: true })
    .filter(e => e.isDirectory() && /^20\d{4}$/.test(e.name))
    .map(e => e.name)
    .sort();
  for (const month of months) {
    const payload = readJson(path.join(REVENUE_ROOT, month, 'monthly_revenue.json'), {});
    for (const row of payload.companies || []) {
      const code = String(row.stock_code);
      if (!byStock.has(code)) byStock.set(code, new Map());
      byStock.get(code).set(month, row);
    }
  }
  return byStock;
}

function knownDateForEvent(event, month) {
  return event.effective_trading_date || event.known_date || event.available_date || event.conservative_known_date || `${month.slice(0, 4)}-${month.slice(4, 6)}-15`;
}

function thresholdSummary(stocks, threshold) {
  const selected = stocks.filter(stock => stock.hit_events.some(event => event.score >= threshold));
  const events = selected.reduce((sum, stock) => sum + stock.hit_events.filter(event => event.score >= threshold).length, 0);
  return { threshold, unique_stocks: selected.length, selected_events: events };
}

function persistentSummary(stocks, threshold, minHits) {
  const selected = stocks.filter(stock => stock.hit_events.filter(event => event.score >= threshold).length >= minHits);
  return {
    threshold,
    min_hits: minHits,
    unique_stocks: selected.length,
    stock_ids: selected.map(stock => stock.stock_id),
  };
}

function hybridUniverse(stocks) {
  const selected = stocks.filter(stock => {
    const extreme = stock.max_score >= 10;
    const strongHits = stock.hit_events.filter(event => event.score >= 8).length;
    return extreme || strongHits >= 2;
  });
  return selected.map(stock => stock.stock_id);
}

function main(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  const start = String(args.get('start-month') || '202401');
  const end = String(args.get('end-month') || '202606');
  const minScore = Number(args.get('min-score') || 7);
  if (!/^20\d{4}$/.test(start) || !/^20\d{4}$/.test(end)) throw new Error('start/end month must be YYYYMM');
  if (!Number.isFinite(minScore)) throw new Error('min-score must be numeric');

  const revenueHistory = loadRevenueHistory();
  const files = fs.readdirSync(SIGNAL_ROOT)
    .filter(name => /^20\d{4}\.json$/.test(name))
    .map(name => name.slice(0, 6))
    .filter(month => month >= start && month <= end)
    .sort();
  if (!files.length) throw new Error(`No monthly signal files found for ${start}-${end}`);

  const byStock = new Map();
  let selectedEvents = 0;
  for (const month of files) {
    const payload = readJson(path.join(SIGNAL_ROOT, `${month}.json`), {});
    for (const event of payload.events || []) {
      const stockId = String(event.stock_code || '').trim();
      if (!stockId) continue;
      const score = scoreComponents(event, month, revenueHistory.get(stockId)).total_score;
      if (score < minScore) continue;
      selectedEvents += 1;
      const knownDate = knownDateForEvent(event, month);
      const existing = byStock.get(stockId) || {
        stock_id: stockId,
        stock_name: event.stock_name || event.name || null,
        first_match_month: month,
        first_known_date: knownDate,
        max_score: score,
        hit_months: 0,
        hit_events: [],
      };
      existing.hit_months += 1;
      if (score > existing.max_score) existing.max_score = score;
      existing.hit_events.push({
        month,
        known_date: knownDate,
        score,
        yoy_pct: Number(event.factors?.yoy_pct),
        mom_pct: Number(event.factors?.mom_pct),
        yoy_acceleration_pct_points: Number(event.factors?.yoy_acceleration_pct_points),
      });
      byStock.set(stockId, existing);
    }
  }

  const stocks = [...byStock.values()]
    .map(row => ({ ...row, hit_events: row.hit_events.sort((a, b) => a.month.localeCompare(b.month)) }))
    .sort((a, b) => b.max_score - a.max_score || b.hit_months - a.hit_months || a.stock_id.localeCompare(b.stock_id));

  const thresholds = [7, 8, 9, 10, 11, 12].filter(value => value >= minScore);
  const thresholdSummaries = thresholds.map(threshold => thresholdSummary(stocks, threshold));
  const persistentSummaries = [
    persistentSummary(stocks, 8, 2),
    persistentSummary(stocks, 8, 3),
    persistentSummary(stocks, 9, 2),
    persistentSummary(stocks, 9, 3),
  ];
  const hybridStockIds = hybridUniverse(stocks);

  const generatedAt = new Date().toISOString();
  const methodology = {
    source: 'MOPS monthly-revenue historical signal files',
    score_function: 'shared scoreComponents() from summarize_mops_revenue_fundamental_acceleration_score.js',
    min_score: minScore,
    start_month: start,
    end_month: end,
    purpose: 'candidate universe for second-stage quarterly financial-quality backfill and validation',
    candidate_tiers: {
      extreme: 'max score >= 10',
      persistent_strong: 'score >= 8 in at least 2 months',
      proposed_hybrid: 'extreme OR persistent_strong; designed to retain persistent 2059-like signals while reducing API backfill volume',
    },
  };

  const output = {
    schema_version: 2,
    dataset: 'fundamental_acceleration_candidate_universe',
    generated_at: generatedAt,
    status: 'research_only',
    methodology,
    counts: {
      months_scanned: files.length,
      selected_events: selectedEvents,
      unique_stocks: stocks.length,
      proposed_hybrid_unique_stocks: hybridStockIds.length,
    },
    threshold_summary: thresholdSummaries,
    persistence_summary: persistentSummaries.map(({ stock_ids, ...rest }) => rest),
    proposed_hybrid_stock_ids: hybridStockIds,
    stocks,
  };

  const compact = {
    schema_version: 1,
    dataset: 'fundamental_acceleration_candidate_universe_summary',
    generated_at: generatedAt,
    status: 'research_only',
    methodology,
    counts: output.counts,
    threshold_summary: thresholdSummaries,
    persistence_summary: persistentSummaries.map(({ stock_ids, ...rest }) => rest),
    proposed_hybrid: {
      rule: 'max_score>=10 OR score>=8 in at least 2 months',
      unique_stocks: hybridStockIds.length,
      includes_2059: hybridStockIds.includes('2059'),
    },
  };

  fs.mkdirSync(path.dirname(OUTPUT), { recursive: true });
  fs.writeFileSync(OUTPUT, `${JSON.stringify(output, null, 2)}\n`, 'utf8');
  fs.writeFileSync(SUMMARY_OUTPUT, `${JSON.stringify(compact, null, 2)}\n`, 'utf8');
  console.log(JSON.stringify({
    output: path.relative(ROOT, OUTPUT),
    summary_output: path.relative(ROOT, SUMMARY_OUTPUT),
    ...output.counts,
    min_score: minScore,
    threshold_summary: thresholdSummaries,
    persistence_summary: compact.persistence_summary,
    proposed_hybrid: compact.proposed_hybrid,
  }, null, 2));
}

if (require.main === module) {
  try { main(); } catch (error) { console.error(error.stack || error.message); process.exitCode = 1; }
}

module.exports = { knownDateForEvent, thresholdSummary, persistentSummary, hybridUniverse };
