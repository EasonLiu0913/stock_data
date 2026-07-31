#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const {
  ROOT,
  readJson,
  atomicWriteJson,
  round,
  indicatorById,
} = require('./market_environment_lib');

const READINESS_ID = 'oversold_beta_rebound_v1';
const READINESS_LABEL = '跌深反彈準備度';
const TOTAL_WEIGHT = 100;
const MIN_EFFECTIVE_WEIGHT = 70;

const STATUS_BANDS = Object.freeze([
  { min: 0, max: 24, code: 'not_formed', label: '尚未形成', message: '反彈條件不足', probability: [10, 20] },
  { min: 25, max: 44, code: 'emerging', label: '訊號萌芽', message: '部分風險開始收斂', probability: [20, 35] },
  { min: 45, max: 59, code: 'near_formation', label: '接近形成', message: 'oversold_beta_rebound 快出現', probability: [35, 50] },
  { min: 60, max: 74, code: 'highly_brewing', label: '高度醞釀', message: '反彈機率明顯升高', probability: [50, 65] },
  { min: 75, max: 100, code: 'triggered', label: '已觸發', message: '跌深反彈環境成立', probability: [65, 80] },
]);

function compactDate(value) {
  const compact = String(value || '').replaceAll('-', '').replaceAll('/', '');
  return /^20\d{6}$/.test(compact) ? compact : '';
}

function finiteNumber(value) {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function roundNullable(value, digits = 2) {
  const number = finiteNumber(value);
  return number === null ? null : round(number, digits);
}

function statusBand(score) {
  const value = Math.max(0, Math.min(100, finiteNumber(score) ?? 0));
  return STATUS_BANDS.find((band) => value >= band.min && value <= band.max) || STATUS_BANDS[0];
}

function condition({ id, label, weight, value, full, partial, fullPoints = weight, partialPoints = 0, valueLabel = null, note = null }) {
  if (value === null || value === undefined || (Array.isArray(value) && value.every((item) => item === null))) {
    return {
      id,
      label,
      weight,
      points: 0,
      status: 'na',
      value,
      value_label: valueLabel,
      note: note || '沒有可用資料，不能視為未符合。',
    };
  }
  if (full) {
    return { id, label, weight, points: fullPoints, status: 'full', value, value_label: valueLabel, note };
  }
  if (partial) {
    return { id, label, weight, points: partialPoints, status: 'partial', value, value_label: valueLabel, note };
  }
  return { id, label, weight, points: 0, status: 'unmet', value, value_label: valueLabel, note };
}

function listPreviousEnvironment(date) {
  const root = path.join(ROOT, 'data_market_environment');
  let dates = [];
  try {
    dates = fs.readdirSync(root, { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && /^20\d{6}$/.test(entry.name) && entry.name < date)
      .map((entry) => entry.name)
      .sort();
  } catch {
    return null;
  }
  for (const previousDate of dates.reverse()) {
    const file = path.join(root, previousDate, 'market_environment.json');
    const payload = readJson(file, null);
    if (payload) return { date: previousDate, file, payload };
  }
  return null;
}

function externalIndicator(external, id) {
  const item = indicatorById(external, id);
  return {
    change: finiteNumber(item?.change_percent),
    market_date: item?.market_date || null,
  };
}

function calculateOversoldRatio(summary) {
  const direct = finiteNumber(summary?.market_summary?.oversold_ratio);
  if (direct !== null) return direct;
  const values = (summary?.stocks || [])
    .map((stock) => finiteNumber(stock?.features?.rsi14))
    .filter((value) => value !== null);
  return values.length ? round(values.filter((value) => value <= 30).length / values.length * 100) : null;
}

function scoreReadiness({ environment, summary, external, previousEnvironment, nightFuturesChange = null }) {
  const metrics = environment?.metrics || {};
  const sox = finiteNumber(metrics.sox_change_1d_pct) ?? externalIndicator(external, 'sox').change;
  const adr = finiteNumber(metrics.tsm_adr_change_1d_pct) ?? externalIndicator(external, 'tsm_adr').change;
  const nasdaq = externalIndicator(external, 'nasdaq').change;
  const externalRisk = finiteNumber(metrics.adr_sox_nasdaq_market_risk);
  const wti = externalIndicator(external, 'wti_crude_oil').change;
  const brent = externalIndicator(external, 'brent_crude_oil').change;
  const twse3d = finiteNumber(metrics.twse_return_3d_pct);
  const oversoldRatio = calculateOversoldRatio(summary);
  const riskScore = finiteNumber(metrics.market_risk_score);
  const previousRiskScore = finiteNumber(previousEnvironment?.payload?.metrics?.market_risk_score);
  const riskDecline = riskScore !== null && previousRiskScore !== null ? previousRiskScore - riskScore : null;
  const foreignNetChange = finiteNumber(metrics.foreign_futures_net_change_contracts);
  const night = finiteNumber(nightFuturesChange)
    ?? finiteNumber(metrics.taiwan_index_futures_night_change_pct)
    ?? finiteNumber(environment?.night_futures?.change_percent);

  const conditions = [
    condition({
      id: 'external_semiconductor_turn',
      label: 'SOX ≥ +4% 或台積電 ADR ≥ +3%',
      weight: 15,
      value: [sox, adr],
      valueLabel: `SOX ${sox === null ? 'N/A' : `${round(sox)}%`}／ADR ${adr === null ? 'N/A' : `${round(adr)}%`}`,
      full: (sox !== null && sox >= 4) || (adr !== null && adr >= 3),
      partial: (sox !== null && sox >= 2) || (adr !== null && adr >= 1.5),
      partialPoints: 8,
    }),
    condition({
      id: 'nasdaq_turn',
      label: 'Nasdaq ≥ +1%',
      weight: 8,
      value: nasdaq,
      valueLabel: nasdaq === null ? 'N/A' : `${round(nasdaq)}%`,
      full: nasdaq !== null && nasdaq >= 1,
      partial: nasdaq !== null && nasdaq >= 0.5,
      partialPoints: 4,
    }),
    condition({
      id: 'external_risk_low',
      label: 'ADR／SOX／Nasdaq 風險 ≤ 20',
      weight: 7,
      value: externalRisk,
      valueLabel: externalRisk === null ? 'N/A' : String(round(externalRisk, 1)),
      full: externalRisk !== null && externalRisk <= 20,
      partial: externalRisk !== null && externalRisk <= 40,
      partialPoints: 4,
    }),
    condition({
      id: 'oil_decline',
      label: 'WTI、Brent 同步回落',
      weight: 5,
      value: [wti, brent],
      valueLabel: `WTI ${wti === null ? 'N/A' : `${round(wti)}%`}／Brent ${brent === null ? 'N/A' : `${round(brent)}%`}`,
      full: wti !== null && brent !== null && wti < 0 && brent < 0,
      partial: (wti !== null && wti < 0) || (brent !== null && brent < 0),
      partialPoints: 3,
    }),
    condition({
      id: 'twse_oversold_fuel',
      label: '台股三日報酬 ≤ -5%',
      weight: 15,
      value: twse3d,
      valueLabel: twse3d === null ? 'N/A' : `${round(twse3d)}%`,
      full: twse3d !== null && twse3d <= -5,
      partial: twse3d !== null && twse3d <= -3,
      partialPoints: 8,
    }),
    condition({
      id: 'market_oversold_ratio',
      label: '全市場超賣比率 ≥ 35%',
      weight: 15,
      value: oversoldRatio,
      valueLabel: oversoldRatio === null ? 'N/A' : `${round(oversoldRatio)}%`,
      full: oversoldRatio !== null && oversoldRatio >= 35,
      partial: oversoldRatio !== null && oversoldRatio >= 25,
      partialPoints: 8,
      note: '超賣比率以預測摘要中 RSI14 ≤ 30 的股票比例計算。',
    }),
    condition({
      id: 'risk_contraction',
      label: '市場風險分數較前日下降 ≥ 20',
      weight: 12,
      value: riskDecline,
      valueLabel: riskDecline === null ? 'N/A' : `下降 ${round(riskDecline, 1)}`,
      full: riskDecline !== null && riskDecline >= 20,
      partial: riskDecline !== null && riskDecline >= 10,
      partialPoints: 6,
    }),
    condition({
      id: 'foreign_futures_improvement',
      label: '外資期貨淨空不再增加',
      weight: 8,
      value: foreignNetChange,
      valueLabel: foreignNetChange === null ? 'N/A' : `${foreignNetChange >= 0 ? '改善' : '增加'} ${Math.abs(Math.round(foreignNetChange)).toLocaleString('zh-TW')} 口`,
      full: foreignNetChange !== null && foreignNetChange >= 0,
      partial: foreignNetChange !== null && foreignNetChange > -1000,
      partialPoints: 3,
    }),
    condition({
      id: 'night_futures_open_signal',
      label: '台指期夜盤 ≥ +2%',
      weight: 15,
      value: night,
      valueLabel: night === null ? 'N/A' : `${round(night)}%`,
      full: night !== null && night >= 2,
      partial: night !== null && night >= 0.5,
      partialPoints: night !== null && night >= 1 ? 8 : 4,
      note: night === null ? '缺台指期夜盤結構化資料。' : null,
    }),
  ];

  const score = conditions.reduce((sum, item) => sum + item.points, 0);
  const effectiveWeight = conditions
    .filter((item) => item.status !== 'na')
    .reduce((sum, item) => sum + item.weight, 0);
  const availableSignals = conditions.filter((item) => item.status !== 'na').length;
  const band = statusBand(score);
  return {
    score,
    effective_data_weight: effectiveWeight,
    effective_data_ratio: round(effectiveWeight / TOTAL_WEIGHT * 100),
    available_signals: availableSignals,
    total_signals: conditions.length,
    band,
    conditions,
    inputs: {
      sox_change_1d_pct: roundNullable(sox),
      tsm_adr_change_1d_pct: roundNullable(adr),
      nasdaq_change_1d_pct: roundNullable(nasdaq),
      adr_sox_nasdaq_market_risk: roundNullable(externalRisk, 1),
      wti_change_1d_pct: roundNullable(wti),
      brent_change_1d_pct: roundNullable(brent),
      twse_return_3d_pct: roundNullable(twse3d),
      market_oversold_ratio: roundNullable(oversoldRatio),
      market_risk_score: roundNullable(riskScore, 1),
      previous_market_risk_score: roundNullable(previousRiskScore, 1),
      market_risk_decline: roundNullable(riskDecline, 1),
      foreign_futures_net_change_contracts: roundNullable(foreignNetChange, 0),
      night_futures_change_pct: roundNullable(night),
    },
  };
}

function wilsonInterval(hits, total, z = 1.96) {
  if (!Number.isFinite(total) || total <= 0) return null;
  const p = hits / total;
  const denominator = 1 + z * z / total;
  const center = (p + z * z / (2 * total)) / denominator;
  const margin = z * Math.sqrt((p * (1 - p) + z * z / (4 * total)) / total) / denominator;
  return [round(Math.max(0, center - margin) * 100, 1), round(Math.min(1, center + margin) * 100, 1)];
}

function loadCalibration(score, beforeDate = '') {
  const dir = path.join(ROOT, 'data_prediction_analysis', 'oversold-beta-rebound');
  let files = [];
  try {
    const cutoff = compactDate(beforeDate);
    files = fs.readdirSync(dir)
      .filter((file) => /^20\d{6}\.json$/.test(file))
      .filter((file) => !cutoff || file.slice(0, 8) < cutoff);
  } catch {
    return { sample_count: 0, hit_count: 0, hit_rate: null, confidence_interval: null };
  }
  const band = statusBand(score);
  const samples = files
    .map((file) => readJson(path.join(dir, file), null))
    .filter((item) => {
      const readinessScore = finiteNumber(item?.readiness_score ?? item?.score);
      return readinessScore !== null && readinessScore >= band.min && readinessScore <= band.max;
    })
    .filter((item) => typeof item?.market_rebound_day === 'boolean');
  const hits = samples.filter((item) => item.market_rebound_day).length;
  return {
    sample_count: samples.length,
    hit_count: hits,
    hit_rate: samples.length ? round(hits / samples.length * 100, 1) : null,
    confidence_interval: wilsonInterval(hits, samples.length),
  };
}

function probabilityCalibration(score, effectiveWeight, beforeDate = '') {
  const band = statusBand(score);
  const history = loadCalibration(score, beforeDate);
  if (effectiveWeight < MIN_EFFECTIVE_WEIGHT) {
    return {
      mode: 'unavailable',
      label: '有效資料權重不足',
      probability_range: null,
      sample_count: history.sample_count,
      hit_count: history.hit_count,
      historical_hit_rate: history.hit_rate,
      confidence_interval: history.confidence_interval,
    };
  }
  if (history.sample_count < 20) {
    return {
      mode: 'heuristic',
      label: '啟發式機率區間',
      probability_range: band.probability,
      sample_count: history.sample_count,
      hit_count: history.hit_count,
      historical_hit_rate: history.hit_rate,
      confidence_interval: history.confidence_interval,
    };
  }
  if (history.sample_count < 60) {
    return {
      mode: 'preliminary_calibration',
      label: '初步校準',
      probability_range: history.confidence_interval,
      sample_count: history.sample_count,
      hit_count: history.hit_count,
      historical_hit_rate: history.hit_rate,
      confidence_interval: history.confidence_interval,
    };
  }
  return {
    mode: 'historical_calibration',
    label: '歷史命中率校準',
    probability_range: history.confidence_interval,
    sample_count: history.sample_count,
    hit_count: history.hit_count,
    historical_hit_rate: history.hit_rate,
    confidence_interval: history.confidence_interval,
  };
}

function buildReadinessPayload({ date, rootDir, environment, summary, external, previousEnvironment, nightFuturesChange = null }) {
  const scored = scoreReadiness({ environment, summary, external, previousEnvironment, nightFuturesChange });
  const calibration = probabilityCalibration(scored.score, scored.effective_data_weight, date);
  const warnings = [];
  if (scored.effective_data_weight < MIN_EFFECTIVE_WEIGHT) {
    warnings.push(`有效資料權重 ${scored.effective_data_weight}% 低於 ${MIN_EFFECTIVE_WEIGHT}%，機率顯示 N/A。`);
  }
  const missing = scored.conditions.filter((item) => item.status === 'na');
  for (const item of missing) warnings.push(item.note || `${item.label}：缺少資料。`);
  const marketDirection = scored.score >= 60
    ? '跌深電子股順風'
    : scored.score >= 45
      ? '跌深電子股風向逐步改善'
      : '跌深電子股環境尚未確認';

  return {
    schemaVersion: 1,
    generated_at: new Date().toISOString(),
    strategy_id: READINESS_ID,
    label: READINESS_LABEL,
    forecast_date_compact: date,
    forecast_date: summary?.forecast_date || environment?.forecast_date || null,
    base_trade_date: summary?.base_trade_date || environment?.base_trade_date || null,
    root_dir: rootDir,
    calculation_status: 'completed',
    changes_direction_score: false,
    replaces_market_environment: false,
    score: scored.score,
    total_weight: TOTAL_WEIGHT,
    status_code: scored.band.code,
    status: scored.band.label,
    dashboard_message: scored.band.message,
    market_direction: marketDirection,
    probability: calibration,
    effective_data_weight: scored.effective_data_weight,
    effective_data_ratio: scored.effective_data_ratio,
    available_signals: scored.available_signals,
    total_signals: scored.total_signals,
    conditions: scored.conditions,
    inputs: scored.inputs,
    market_rebound_day_definition: {
      equal_weight_market_return_min_pct: 2,
      advancing_issue_ratio_min_pct: 65,
      rule: '次日全市場等權重報酬 >= +2% 且上漲家數比例 >= 65%',
    },
    warnings,
    source_files: {
      prediction_summary: `data_predictions/${date}/summary.json`,
      market_environment: `data_market_environment/${date}/market_environment.json`,
      external_market: environment?.source_files?.external_market || null,
      previous_market_environment: previousEnvironment
        ? path.relative(ROOT, previousEnvironment.file).replaceAll(path.sep, '/')
        : null,
      night_futures: null,
    },
    notes: [
      '這是獨立的市場反彈準備度，不取代 post_shock_day_1／post_shock_day_2 等市場環境。',
      '這是市場閘門，不直接修改 V1/V2 原始方向分數，也不決定個股是否進入跌深反彈電子股名單。',
      '缺資料以 N/A 表示，不會當成未符合。',
    ],
  };
}

function generateOversoldBetaRebound({ rootDir = 'data_predictions', date, environment = null, dryRun = false, nightFuturesChange = null } = {}) {
  const compact = compactDate(date);
  if (!compact) throw new Error('date must be YYYYMMDD');
  const predictionDir = path.join(ROOT, rootDir, compact);
  const summaryFile = path.join(predictionDir, 'summary.json');
  const environmentFile = path.join(ROOT, 'data_market_environment', compact, 'market_environment.json');
  const summary = readJson(summaryFile, null);
  const env = environment || readJson(environmentFile, null);
  if (!summary || !Array.isArray(summary.stocks)) {
    return { date: compact, root_dir: rootDir, skipped: true, reason: 'missing_summary' };
  }
  if (!env) {
    const unavailable = {
      schemaVersion: 1,
      generated_at: new Date().toISOString(),
      strategy_id: READINESS_ID,
      label: READINESS_LABEL,
      forecast_date_compact: compact,
      calculation_status: 'unable_to_calculate',
      score: null,
      probability: { mode: 'unavailable', label: '無法計算', probability_range: null, sample_count: 0, confidence_interval: null },
      warnings: ['缺少市場環境快照。'],
    };
    if (!dryRun) {
      summary.market_rebound_readiness = unavailable;
      atomicWriteJson(summaryFile, summary);
    }
    return { date: compact, root_dir: rootDir, skipped: false, unable: true, reason: 'missing_environment' };
  }

  const externalFile = env?.source_files?.external_market ? path.join(ROOT, env.source_files.external_market) : null;
  const external = externalFile ? readJson(externalFile, null) : null;
  const previousEnvironment = listPreviousEnvironment(compact);
  const payload = buildReadinessPayload({
    date: compact,
    rootDir,
    environment: env,
    summary,
    external,
    previousEnvironment,
    nightFuturesChange,
  });
  const outputFile = path.join(ROOT, 'data_market_environment', compact, 'oversold_beta_rebound.json');
  summary.market_rebound_readiness = {
    source_file: path.relative(ROOT, outputFile).replaceAll(path.sep, '/'),
    ...payload,
  };
  if (!dryRun) {
    atomicWriteJson(outputFile, payload);
    atomicWriteJson(summaryFile, summary);
  }
  return {
    date: compact,
    root_dir: rootDir,
    skipped: false,
    score: payload.score,
    status: payload.status,
    probability_range: payload.probability.probability_range,
    effective_data_weight: payload.effective_data_weight,
    available_signals: payload.available_signals,
    total_signals: payload.total_signals,
    output: path.relative(ROOT, outputFile).replaceAll(path.sep, '/'),
    dry_run: dryRun,
  };
}

function parseCliArgs(argv) {
  const options = { rootDir: 'data_predictions', date: '', dryRun: false };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--date') options.date = argv[++index] || '';
    else if (arg === '--root') options.rootDir = argv[++index] || '';
    else if (arg === '--dry-run') options.dryRun = true;
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return options;
}

function main(argv = process.argv.slice(2)) {
  const result = generateOversoldBetaRebound(parseCliArgs(argv));
  console.log(JSON.stringify(result));
  return result;
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exitCode = 1;
  }
}

module.exports = {
  READINESS_ID,
  READINESS_LABEL,
  TOTAL_WEIGHT,
  MIN_EFFECTIVE_WEIGHT,
  STATUS_BANDS,
  compactDate,
  roundNullable,
  statusBand,
  condition,
  scoreReadiness,
  wilsonInterval,
  loadCalibration,
  probabilityCalibration,
  buildReadinessPayload,
  generateOversoldBetaRebound,
  main,
};
