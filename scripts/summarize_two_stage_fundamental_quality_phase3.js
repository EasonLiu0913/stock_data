#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { scoreComponents } = require('./summarize_mops_revenue_fundamental_acceleration_score');
const { discoverTradingDates } = require('./fundamental_event_timeline');
const { buildEventDrivenFinancialRows, latestKnownScore } = require('./event_driven_financial_quality');
const { POLICIES, HORIZONS, policyEntry, summarizePolicy } = require('./summarize_two_stage_fundamental_quality_entry_policy');
const { clearCaches } = require('./lib/stock_price_provider');

const ROOT = path.resolve(__dirname, '..');
const SIGNAL_ROOT = path.join(ROOT, 'data_prediction_analysis', 'monthly-revenue', 'monthly-signals');
const REVENUE_ROOT = path.join(ROOT, 'data_mops_monthly_revenue');
const MASTER_FILE = path.join(ROOT, 'data_prediction_analysis', 'quarterly-financial-quality', 'financial-quality-master.json');
const MARKET_FILE = path.join(ROOT, 'data_twse_market_chart', 'market_chart.json');
const OUTPUT = path.join(ROOT, 'data_prediction_analysis', 'quarterly-financial-quality', 'two-stage-fundamental-quality-phase3-event-driven.json');
const ELECTRONIC_INDUSTRIES = new Set(['半導體業','電腦及週邊設備業','光電業','通信網路業','電子零組件業','電子通路業','資訊服務業','其他電子業','電子工業']);

function readJson(file, fallback = null) { try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return fallback; } }
function parseArgs(argv) { const out = new Map(); for (let i = 0; i < argv.length; i += 1) { if (!argv[i].startsWith('--')) continue; out.set(argv[i].slice(2), argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : true); } return out; }
function round(v, d = 4) { return Number.isFinite(v) ? Number(v.toFixed(d)) : null; }
function monthIndex(month) { const m = String(month).match(/^(20\d{2})(\d{2})$/); if (!m) return null; return Number(m[1]) * 12 + Number(m[2]) - 1; }
function monthFromIndex(index) { return `${Math.floor(index / 12)}${String(index % 12 + 1).padStart(2, '0')}`; }
function boundedStart(month, lookback = 12) { const idx = monthIndex(month); return Number.isInteger(idx) ? monthFromIndex(idx - lookback) : month; }
function loadRevenueHistory(start, end) {
  const byMonth = new Map(), byStock = new Map();
  const lower = boundedStart(start, 12);
  const months = fs.readdirSync(REVENUE_ROOT, { withFileTypes: true })
    .filter(e => e.isDirectory() && /^20\d{4}$/.test(e.name) && e.name >= lower && e.name <= end)
    .map(e => e.name).sort();
  for (const month of months) {
    const payload = readJson(path.join(REVENUE_ROOT, month, 'monthly_revenue.json'), {}), monthMap = new Map();
    for (const row of payload.companies || []) {
      const id = String(row.stock_code); monthMap.set(id, row);
      if (!byStock.has(id)) byStock.set(id, new Map()); byStock.get(id).set(month, row);
    }
    byMonth.set(month, monthMap);
  }
  return { byMonth, byStock };
}
function loadFinancialMaster() {
  const payload = readJson(MASTER_FILE);
  if (!payload || !Array.isArray(payload.stocks)) throw new Error('Missing financial-quality-master.json');
  return new Map(payload.stocks.map(stock => [String(stock.stock_id), stock.rows || []]));
}
function latestOldFinancial(rows, eventDate) {
  return (rows || []).filter(row => row.conservative_known_date && row.conservative_known_date <= eventDate)
    .sort((a, b) => String(a.conservative_known_date).localeCompare(String(b.conservative_known_date)) || String(a.fiscal_period).localeCompare(String(b.fiscal_period))).at(-1) || null;
}
function loadMarketRows() {
  const payload = readJson(MARKET_FILE, {});
  return (payload.data || []).filter(row => /^20\d{6}$/.test(String(row.date)) && Number.isFinite(Number(row.close)))
    .map(row => ({ date: String(row.date), close: Number(row.close) })).sort((a, b) => a.date.localeCompare(b.date));
}
function candidateKey(event) { return `${event.month}|${event.stock_id}`; }
function addVsDirect(rows) {
  const direct = new Map(rows.filter(row => row.policy_id === 'direct').map(row => [row.horizon, row]));
  for (const row of rows) {
    const base = direct.get(row.horizon);
    row.vs_direct = base ? {
      avg_endpoint_delta_pct: round(row.endpoint.average_pct - base.endpoint.average_pct),
      median_endpoint_delta_pct: round(row.endpoint.median_pct - base.endpoint.median_pct),
      positive_rate_delta_pp: round(row.endpoint.positive_rate_pct - base.endpoint.positive_rate_pct),
      endpoint_ge30_rate_delta_pp: round(row.endpoint.ge30_rate_pct - base.endpoint.ge30_rate_pct),
      participation_rate_delta_pp: round(row.participation_rate_pct - base.participation_rate_pct),
      median_mae_delta_pct: round(row.mae.median_pct - base.mae.median_pct),
    } : null;
  }
}
function evaluatePolicies(candidates, marketRows, indexByDate) {
  const rows = [];
  for (const policy of POLICIES) {
    const entries = new Map(); let processed = 0;
    for (const event of candidates) {
      entries.set(event, policyEntry(event, policy, marketRows, indexByDate));
      if (++processed % 20 === 0) clearCaches();
    }
    clearCaches();
    for (const horizon of HORIZONS) {
      rows.push({ policy_id: policy.id, policy_name: policy.name, ...summarizePolicy(candidates, entries, horizon, marketRows, indexByDate) });
      clearCaches();
    }
  }
  addVsDirect(rows);
  return rows;
}
function generalBaselineDecision(rows) {
  const d60 = rows.filter(row => row.horizon === 'd60');
  const direct = d60.find(row => row.policy_id === 'direct');
  if (!direct) return { retained: false, reason: 'missing_direct_d60' };
  const fullParticipation = d60.filter(row => row.policy_id !== 'direct' && Number(row.participation_rate_pct) >= 99.999);
  const betterFull = fullParticipation.filter(row => Number(row.endpoint.average_pct) > Number(direct.endpoint.average_pct));
  const skipPolicies = d60.filter(row => /_skip$/.test(row.policy_id));
  return {
    retained: betterFull.length === 0,
    criterion: 'direct remains general baseline when no alternative with effectively full participation has a higher D60 average endpoint; skip policies are treated as conditional-entry policies and their participation/missed-winner costs are reported separately',
    direct_d60: { average_pct: direct.endpoint.average_pct, median_pct: direct.endpoint.median_pct, positive_rate_pct: direct.endpoint.positive_rate_pct, ge30_rate_pct: direct.endpoint.ge30_rate_pct, eligible_events: direct.eligible_events },
    better_full_participation_policies: betterFull.map(row => ({ policy_id: row.policy_id, average_pct: row.endpoint.average_pct, participation_rate_pct: row.participation_rate_pct })),
    conditional_skip_policies: skipPolicies.map(row => ({ policy_id: row.policy_id, average_pct: row.endpoint.average_pct, participation_rate_pct: row.participation_rate_pct, skipped_direct_positive_rate_pct: row.missed_winners.direct_positive_rate_pct, skipped_direct_ge30_rate_pct: row.missed_winners.direct_endpoint_ge30_rate_pct })),
  };
}
function main(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  const start = String(args.get('start-month') || '202401');
  const end = String(args.get('end-month') || '202606');
  const history = loadRevenueHistory(start, end);
  const oldFinancial = loadFinancialMaster();
  const tradingDates = discoverTradingDates(ROOT);
  const eventDrivenCache = new Map();
  const diagnostics = { total_monthly_events: 0, electronic_fas8_events: 0, old_missing_financial: 0, event_driven_missing_financial: 0, old_below_10: 0, event_driven_below_10: 0, old_included: 0, event_driven_included: 0, preliminary_scoreable: 0, preliminary_rejected: 0 };
  const oldCandidates = [], newCandidates = [], fas8Comparisons = [];
  const months = fs.readdirSync(SIGNAL_ROOT).filter(name => /^20\d{4}\.json$/.test(name)).map(name => name.slice(0, 6)).filter(month => month >= start && month <= end).sort();
  for (const month of months) {
    const payload = readJson(path.join(SIGNAL_ROOT, `${month}.json`), {}), revenueMap = history.byMonth.get(month) || new Map();
    for (const event of payload.events || []) {
      diagnostics.total_monthly_events++;
      const stockId = String(event.stock_code), revenueRow = revenueMap.get(stockId) || {};
      if (!ELECTRONIC_INDUSTRIES.has(revenueRow.industry || event.industry || '未分類')) continue;
      const monthly = scoreComponents(event, month, history.byStock.get(stockId));
      if (Number(monthly.total_score) < 8) continue;
      diagnostics.electronic_fas8_events++;
      const eventDate = event.effective_trading_date || event.conservative_availability_date || null;
      const oldFq = latestOldFinancial(oldFinancial.get(stockId) || [], eventDate);
      if (!eventDrivenCache.has(stockId)) {
        const built = buildEventDrivenFinancialRows(stockId, { root: ROOT, tradingDates });
        eventDrivenCache.set(stockId, built);
        diagnostics.preliminary_scoreable += built.scoredPreliminary.length;
        diagnostics.preliminary_rejected += built.rejectedPreliminary.length;
      }
      const built = eventDrivenCache.get(stockId);
      const newFq = latestKnownScore(built.rows, eventDate);
      if (!oldFq || !Number.isFinite(Number(oldFq.financial_quality_score))) diagnostics.old_missing_financial++;
      else if (Number(oldFq.financial_quality_score) < 10) diagnostics.old_below_10++;
      if (!newFq || !Number.isFinite(Number(newFq.financial_quality_score))) diagnostics.event_driven_missing_financial++;
      else if (Number(newFq.financial_quality_score) < 10) diagnostics.event_driven_below_10++;
      const base = { month, stock_id: stockId, stock_name: revenueRow.stock_name || revenueRow.company_name || event.stock_name || event.company_name || null, base_trading_date: event.base_trading_date, event_date: eventDate };
      const oldPass = Number(oldFq?.financial_quality_score) >= 10 && !!event.base_trading_date;
      const newPass = Number(newFq?.financial_quality_score) >= 10 && !!event.base_trading_date;
      if (oldPass) { oldCandidates.push(base); diagnostics.old_included++; }
      if (newPass) { newCandidates.push(base); diagnostics.event_driven_included++; }
      if (String(oldFq?.fiscal_period || '') !== String(newFq?.fiscal_period || '') || Number(oldFq?.financial_quality_score) !== Number(newFq?.financial_quality_score) || oldPass !== newPass) {
        fas8Comparisons.push({ month, stock_id: stockId, event_date: eventDate, monthly_score: monthly.total_score, old: oldFq ? { fiscal_period: oldFq.fiscal_period, score: oldFq.financial_quality_score, known_date: oldFq.conservative_known_date, pass: oldPass } : null, event_driven: newFq ? { fiscal_period: newFq.fiscal_period, score: newFq.financial_quality_score, known_date: newFq.effective_known_date || newFq.effective_date, confidence: newFq.availability_confidence, score_basis: newFq.score_basis, pass: newPass } : null });
      }
    }
  }
  const oldKeys = new Set(oldCandidates.map(candidateKey)), newKeys = new Set(newCandidates.map(candidateKey));
  const added = newCandidates.filter(event => !oldKeys.has(candidateKey(event)));
  const removed = oldCandidates.filter(event => !newKeys.has(candidateKey(event)));
  const unchanged = [...newKeys].filter(key => oldKeys.has(key)).length;
  const marketRows = loadMarketRows(), indexByDate = new Map(marketRows.map((row, index) => [row.date, index]));
  const oldPolicyRows = evaluatePolicies(oldCandidates, marketRows, indexByDate);
  const eventDrivenPolicyRows = evaluatePolicies(newCandidates, marketRows, indexByDate);
  const oldDecision = generalBaselineDecision(oldPolicyRows);
  const newDecision = generalBaselineDecision(eventDrivenPolicyRows);
  const oldD60 = oldPolicyRows.find(row => row.policy_id === 'direct' && row.horizon === 'd60');
  const newD60 = eventDrivenPolicyRows.find(row => row.policy_id === 'direct' && row.horizon === 'd60');
  const conclusion = {
    direct_entry_baseline_before: oldDecision.retained,
    direct_entry_baseline_event_driven: newDecision.retained,
    selection_conclusion: newDecision.retained ? 'retained' : 'changed',
    event_driven_universe_change: { old_candidates: oldCandidates.length, event_driven_candidates: newCandidates.length, unchanged, added: added.length, removed: removed.length },
    d60_direct_delta: oldD60 && newD60 ? { average_pct: round(newD60.endpoint.average_pct - oldD60.endpoint.average_pct), median_pct: round(newD60.endpoint.median_pct - oldD60.endpoint.median_pct), positive_rate_pp: round(newD60.endpoint.positive_rate_pct - oldD60.endpoint.positive_rate_pct), ge30_rate_pp: round(newD60.endpoint.ge30_rate_pct - oldD60.endpoint.ge30_rate_pct) } : null,
    production_gate: 'do_not_migrate_production_in_phase3; use these results to decide whether an explicit versioned production migration is justified',
  };
  const output = {
    schema_version: 1,
    dataset: 'two_stage_fundamental_quality_phase3_event_driven_revalidation',
    generated_at: new Date().toISOString(),
    start_month: start,
    end_month: end,
    methodology: {
      status: 'research_only',
      universe: 'electronic monthly-revenue FAS>=8 + latest scoreable financial-quality FQ>=10',
      event_driven_rule: 'a preliminary event may advance FQ only when current-quarter revenue, operating income (reported or derived from reported operating margin), EPS, gross margin and operating margin are all known and previous-quarter/year-ago comparison quarters were already available',
      no_proxy_lookahead: 'formal-quarter FQ scores are never copied backward to preliminary event dates; the identical 14-point FQ formula is recomputed from fields available at the event date',
      formal_fallback_rule: 'when no stronger actual/verified scoreable event exists, formal financial quality retains conservative fallback availability resolved to the next daily trading date',
      price_policy_comparison: 'reuses the same D20/D40/D60 entry-policy evaluator and fair-maturity rules as the prior policy backtest',
    },
    coverage: diagnostics,
    universe_comparison: { old_candidates: oldCandidates.length, event_driven_candidates: newCandidates.length, unchanged, added_count: added.length, removed_count: removed.length, added_events: added.slice(0, 100), removed_events: removed.slice(0, 100), changed_fas8_financial_states: fas8Comparisons.slice(0, 200) },
    old_policy_rows: oldPolicyRows,
    event_driven_policy_rows: eventDrivenPolicyRows,
    old_general_baseline_decision: oldDecision,
    event_driven_general_baseline_decision: newDecision,
    conclusion,
  };
  fs.mkdirSync(path.dirname(OUTPUT), { recursive: true });
  fs.writeFileSync(OUTPUT, `${JSON.stringify(output, null, 2)}\n`, 'utf8');
  console.log(`PHASE3_SUMMARY=${JSON.stringify({ output: path.relative(ROOT, OUTPUT), diagnostics, universe: output.universe_comparison, old_d60_direct: oldDecision.direct_d60, event_driven_d60_direct: newDecision.direct_d60, conclusion })}`);
}

if (require.main === module) {
  try { main(); } catch (error) { console.error(error.stack || error.message); process.exitCode = 1; }
}
