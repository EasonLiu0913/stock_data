#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const PREDICTION_DIR = path.join(ROOT, 'data_predictions_v2');
const PRICE_DIR = path.join(ROOT, 'data_fubon');
const STOCK_LIST = path.join(ROOT, 'data_twse', 'twse_industry_Stock.json');
const REPLAY_VERSION = '2.0.0-experimental';

function readJson(file, fallback = null) {
  try {
    const text = fs.readFileSync(file, 'utf8').trim();
    return text ? JSON.parse(text) : fallback;
  } catch { return fallback; }
}
function writeJson(file, payload) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
}
function round(value, digits = 2) { return Number.isFinite(value) ? Number(value.toFixed(digits)) : null; }
function average(values) { const valid = values.filter(Number.isFinite); return valid.length ? valid.reduce((a, b) => a + b, 0) / valid.length : null; }
function ratio(rows, predicate) { return rows.length ? rows.filter(predicate).length / rows.length * 100 : null; }
function compactDate(value) { return String(value || '').replaceAll('-', '').replaceAll('/', ''); }
function isoDate(value) { const d = compactDate(value); return `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}`; }
function pct(current, previous) { return Number.isFinite(current) && Number.isFinite(previous) && previous !== 0 ? (current / previous - 1) * 100 : null; }
function parseArgs(argv) {
  const args = { costBps: 30 };
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === '--date') args.date = compactDate(argv[++index]);
    else if (argv[index] === '--actual-date') args.actualDate = compactDate(argv[++index]);
    else if (argv[index] === '--cost-bps') args.costBps = Number(argv[++index]);
  }
  return args;
}
function parsePriceRow(item, date) {
  const key1 = isoDate(date).replaceAll('-', '/');
  const row = item?.[key1] || item?.[isoDate(date)];
  if (!row) return null;
  const number = (value) => {
    const parsed = Number(String(value ?? '').replaceAll(',', ''));
    return Number.isFinite(parsed) ? parsed : null;
  };
  return { close: number(row.Price ?? row.Close), open: number(row.Open), high: number(row.High), low: number(row.Low), volume: number(row.Volume) };
}
function directionSide(label) {
  if (String(label || '').includes('偏多')) return 1;
  if (String(label || '').includes('偏空')) return -1;
  return 0;
}
function predictionOutcome(side, actualReturn) {
  if (!Number.isFinite(actualReturn)) return 'not_eligible';
  if (side > 0) return actualReturn > 0 ? 'hit' : actualReturn < 0 ? 'miss' : 'neutral';
  if (side < 0) return actualReturn < 0 ? 'hit' : actualReturn > 0 ? 'miss' : 'neutral';
  return Math.abs(actualReturn) <= 0.3 ? 'hit' : 'miss';
}
function numericValues(value) {
  return String(value ?? '').match(/-?\d[\d,]*(?:\.\d+)?/g)?.map((item) => Number(item.replaceAll(',', ''))).filter(Number.isFinite) || [];
}
function targetMetrics(payload, actual) {
  const scenario = payload?.view?.scenarios?.[0];
  const values = numericValues(scenario?.target);
  if (values.length < 2 || !Number.isFinite(actual?.close)) return null;
  const lower = Math.min(values[0], values[1]);
  const upper = Math.max(values[0], values[1]);
  const midpoint = (lower + upper) / 2;
  const width = midpoint ? (upper - lower) / midpoint * 100 : null;
  return {
    lower,
    upper,
    midpoint: round(midpoint),
    interval_width_percent: round(width),
    close_inside: actual.close >= lower && actual.close <= upper,
    range_overlaps: Number.isFinite(actual.low) && Number.isFinite(actual.high) ? actual.high >= lower && actual.low <= upper : null,
    midpoint_absolute_error: round(Math.abs(actual.close - midpoint)),
    midpoint_absolute_percentage_error: midpoint ? round(Math.abs(actual.close - midpoint) / midpoint * 100) : null,
    close_distance_to_interval_percent: round(actual.close < lower ? (lower - actual.close) / lower * 100 : actual.close > upper ? (actual.close - upper) / upper * 100 : 0),
  };
}
function rank(values) {
  const sorted = values.map((value, index) => ({ value, index })).sort((a, b) => a.value - b.value);
  const output = Array(values.length);
  for (let start = 0; start < sorted.length;) {
    let end = start + 1;
    while (end < sorted.length && sorted[end].value === sorted[start].value) end += 1;
    const avgRank = (start + end - 1) / 2 + 1;
    for (let i = start; i < end; i += 1) output[sorted[i].index] = avgRank;
    start = end;
  }
  return output;
}
function pearson(x, y) {
  if (x.length !== y.length || x.length < 3) return null;
  const mx = average(x); const my = average(y);
  let numerator = 0; let dx = 0; let dy = 0;
  for (let i = 0; i < x.length; i += 1) {
    const a = x[i] - mx; const b = y[i] - my;
    numerator += a * b; dx += a * a; dy += b * b;
  }
  return dx && dy ? numerator / Math.sqrt(dx * dy) : null;
}
function spearman(x, y) { return pearson(rank(x), rank(y)); }
function groupSummary(rows, key) {
  const groups = new Map();
  for (const row of rows) {
    const value = row[key] || 'unknown';
    if (!groups.has(value)) groups.set(value, []);
    groups.get(value).push(row);
  }
  return [...groups.entries()].map(([name, members]) => ({
    name,
    count: members.length,
    hit_rate: round(ratio(members, (row) => row.outcome === 'hit')),
    miss_rate: round(ratio(members, (row) => row.outcome === 'miss')),
    average_actual_return: round(average(members.map((row) => row.actual_return))),
    average_signed_return: round(average(members.map((row) => row.signed_return))),
  })).sort((a, b) => b.count - a.count);
}
function calibrationBucket(score) {
  if (score <= -6) return '<=-6';
  if (score <= -3) return '-5~-3';
  if (score <= 2) return '-2~2';
  if (score <= 5) return '3~5';
  return '>=6';
}
function thresholdSimulation(rows, threshold) {
  const directional = rows.filter((row) => row.side !== 0);
  const removed = directional.filter((row) => Math.abs(row.score) < threshold);
  const selected = directional.filter((row) => Math.abs(row.score) >= threshold);
  return {
    threshold,
    selected_count: selected.length,
    coverage_rate: round(directional.length ? selected.length / directional.length * 100 : null),
    selected_hit_rate: round(ratio(selected, (row) => row.outcome === 'hit')),
    selected_average_signed_return: round(average(selected.map((row) => row.signed_return))),
    changed_to_neutral_count: removed.length,
    avoided_misses: removed.filter((row) => row.outcome === 'miss').length,
    sacrificed_hits: removed.filter((row) => row.outcome === 'hit').length,
    net_error_reduction: removed.filter((row) => row.outcome === 'miss').length - removed.filter((row) => row.outcome === 'hit').length,
  };
}
function profitFactor(values) {
  const wins = values.filter((value) => value > 0).reduce((sum, value) => sum + value, 0);
  const losses = Math.abs(values.filter((value) => value < 0).reduce((sum, value) => sum + value, 0));
  return losses ? wins / losses : wins > 0 ? null : 0;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const rootManifest = readJson(path.join(PREDICTION_DIR, 'manifest.json'), null);
  const date = args.date || compactDate(rootManifest?.latest_date);
  if (!/^20\d{6}$/.test(date)) throw new Error('Missing V2 prediction date');
  const manifest = readJson(path.join(PREDICTION_DIR, date, 'manifest.json'), rootManifest);
  const baseDate = compactDate(manifest?.base_trade_date);
  const actualDate = args.actualDate || date;
  const basePrices = readJson(path.join(PRICE_DIR, `fubon_${baseDate}_sma.json`), null);
  const actualPrices = readJson(path.join(PRICE_DIR, `fubon_${actualDate}_sma.json`), null);
  if (!basePrices || !actualPrices) throw new Error(`Missing price data for ${baseDate} or ${actualDate}`);
  const stockList = readJson(STOCK_LIST, {});
  const dir = path.join(PREDICTION_DIR, date);
  const files = fs.readdirSync(dir).filter((file) => /^\d{4,6}\.json$/.test(file));
  const rows = [];
  const excluded = [];

  for (const file of files) {
    const prediction = readJson(path.join(dir, file), null);
    const code = String(prediction?.stock_code || file.replace('.json', ''));
    const base = parsePriceRow(basePrices[code], baseDate);
    const actual = parsePriceRow(actualPrices[code], actualDate);
    if (!prediction || !base?.close || !actual?.close) {
      excluded.push({ stock_code: code, reason: !prediction ? 'missing_prediction' : !base?.close ? 'missing_base_close' : 'missing_actual_close' });
      continue;
    }
    const actualReturn = pct(actual.close, base.close);
    const side = directionSide(prediction.final_direction_label);
    const outcome = predictionOutcome(side, actualReturn);
    const signedReturn = side * actualReturn;
    rows.push({
      stock_code: code,
      stock_name: prediction.stock_name,
      industry: prediction.industry || stockList?.[code]?.Industry || stockList?.[code]?.industry || 'unknown',
      score: Number(prediction.direction_score) || 0,
      final_direction_label: prediction.final_direction_label,
      side,
      actual_return: round(actualReturn),
      outcome,
      signed_return: round(signedReturn),
      relative_strength_bucket: prediction.experimental_v2?.relative_strength_bucket || 'unknown',
      chip_technical_quadrant: prediction.experimental_v2?.chip_technical_quadrant || 'unknown',
      target_metrics: targetMetrics(prediction, actual),
    });
  }

  const marketAverage = average(rows.map((row) => row.actual_return));
  const upRatio = ratio(rows, (row) => row.actual_return > 0);
  const downRatio = ratio(rows, (row) => row.actual_return < 0);
  const industries = new Map();
  for (const row of rows) {
    if (!industries.has(row.industry)) industries.set(row.industry, []);
    industries.get(row.industry).push(row.actual_return);
  }
  for (const row of rows) {
    row.market_excess_return = round(row.actual_return - marketAverage);
    row.industry_excess_return = round(row.actual_return - average(industries.get(row.industry)));
  }

  const bullish = rows.filter((row) => row.side > 0);
  const bearish = rows.filter((row) => row.side < 0);
  const directional = rows.filter((row) => row.side !== 0);
  const hitRate = ratio(rows, (row) => row.outcome === 'hit');
  const bullishHit = ratio(bullish, (row) => row.outcome === 'hit');
  const bearishHit = ratio(bearish, (row) => row.outcome === 'hit');
  const cost = args.costBps / 100;
  const grossReturns = directional.map((row) => row.signed_return);
  const netReturns = grossReturns.map((value) => value - cost);
  const targets = rows.map((row) => row.target_metrics).filter(Boolean);
  const scorePairs = rows.filter((row) => Number.isFinite(row.score) && Number.isFinite(row.market_excess_return));
  const avgWin = average(grossReturns.filter((value) => value > 0));
  const avgLoss = average(grossReturns.filter((value) => value < 0));

  const summary = {
    replay_version: REPLAY_VERSION,
    generated_at: new Date().toISOString(),
    prediction_date: isoDate(date),
    base_trade_date: isoDate(baseDate),
    actual_trade_date: isoDate(actualDate),
    verified_count: rows.length,
    excluded_count: excluded.length,
    exclusions: excluded,
    raw_accuracy: {
      hit_rate: round(hitRate),
      bullish_hit_rate: round(bullishHit),
      bearish_hit_rate: round(bearishHit),
      balanced_directional_accuracy: round([bullishHit, bearishHit].filter(Number.isFinite).length ? average([bullishHit, bearishHit]) : null),
    },
    benchmark_adjusted: {
      market_up_ratio: round(upRatio),
      market_down_ratio: round(downRatio),
      equal_weight_market_return: round(marketAverage),
      bullish_excess_hit_rate: round(Number.isFinite(bullishHit) ? bullishHit - upRatio : null),
      bearish_excess_hit_rate: round(Number.isFinite(bearishHit) ? bearishHit - downRatio : null),
    },
    score_calibration: groupSummary(rows.map((row) => ({ ...row, calibration_bucket: calibrationBucket(row.score) })), 'calibration_bucket'),
    numeric_error: {
      sample_count: targets.length,
      interval_close_coverage_rate: round(ratio(targets, (item) => item.close_inside)),
      intraday_range_overlap_rate: round(ratio(targets, (item) => item.range_overlaps)),
      mean_absolute_error: round(average(targets.map((item) => item.midpoint_absolute_error))),
      mean_absolute_percentage_error: round(average(targets.map((item) => item.midpoint_absolute_percentage_error))),
      average_interval_width_percent: round(average(targets.map((item) => item.interval_width_percent))),
      average_close_distance_to_interval_percent: round(average(targets.map((item) => item.close_distance_to_interval_percent))),
    },
    economic_value: {
      transaction_cost_assumption_bps: args.costBps,
      directional_sample_count: directional.length,
      average_gross_signed_return: round(average(grossReturns)),
      average_net_signed_return: round(average(netReturns)),
      gross_profit_factor: round(profitFactor(grossReturns)),
      net_profit_factor: round(profitFactor(netReturns)),
      win_loss_payoff_ratio: Number.isFinite(avgWin) && Number.isFinite(avgLoss) && avgLoss !== 0 ? round(Math.abs(avgWin / avgLoss)) : null,
      maximum_drawdown: null,
      maximum_drawdown_note: '單一交易日橫斷面不計最大回撤；跨日累積後再計算。',
    },
    relative_ability: {
      score_vs_market_excess_spearman_ic: round(spearman(scorePairs.map((row) => row.score), scorePairs.map((row) => row.market_excess_return)), 4),
      average_market_excess_return_by_direction: {
        bullish: round(average(bullish.map((row) => row.market_excess_return))),
        bearish: round(average(bearish.map((row) => -row.market_excess_return))),
      },
      average_industry_excess_signed_return: round(average(directional.map((row) => row.side * row.industry_excess_return))),
    },
    p0_threshold_impact: [3, 4, 5, 6, 7].map((threshold) => thresholdSimulation(rows, threshold)),
    p1_relative_strength_bins: groupSummary(rows, 'relative_strength_bucket'),
    p1_chip_technical_quadrants: groupSummary(rows, 'chip_technical_quadrant'),
    p2_data_quality: {
      excluded_count: excluded.length,
      excluded_stock_codes: excluded.map((row) => row.stock_code),
      note: '股票代碼與缺漏原因由當次資料動態產生，沒有硬編碼。',
    },
  };

  writeJson(path.join(dir, 'replay-v2.json'), { ...summary, rows });
  writeJson(path.join(dir, 'replay-summary-v2.json'), summary);
  console.log(JSON.stringify({ date, actualDate, verified: rows.length, excluded: excluded.length, hit_rate: summary.raw_accuracy.hit_rate }, null, 2));
}

if (require.main === module) {
  try { main(); } catch (error) { console.error(error.stack || error.message); process.exit(1); }
}

module.exports = { calibrationBucket, directionSide, predictionOutcome, profitFactor, spearman, targetMetrics, thresholdSimulation };
