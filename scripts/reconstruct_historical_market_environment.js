#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const {
  ROOT,
  parseArgs,
  compactDate,
  readJson,
  atomicWriteJson,
  round,
  pctChange,
  sha256,
  listDateDirectories,
  primaryExternalValidation,
  indicatorById,
  trailingReturn,
  latestActualEnvironment,
  refreshEnvironmentIndexes,
} = require('./market_environment_lib');
const { strategyPolicy } = require('./generate_market_environment');

const EXTERNAL_ROOT = path.join(ROOT, 'data_external_market');

function normalizedRows(indicator) {
  return (Array.isArray(indicator?.rows) ? indicator.rows : [])
    .filter((row) => /^20\d{6}$/.test(String(row?.date || '')) && Number.isFinite(Number(row?.close)))
    .sort((left, right) => String(left.date).localeCompare(String(right.date)));
}

function reconstructIndicatorAtDate(indicator, targetDate) {
  const rows = normalizedRows(indicator).filter((row) => String(row.date) <= targetDate);
  const index = rows.findIndex((row) => String(row.date) === targetDate);
  if (index < 0) return null;

  const current = rows[index];
  const previous = index > 0 ? rows[index - 1] : null;
  const close = Number(current.close);
  const previousClose = Number(previous?.close);
  const change = Number.isFinite(previousClose) ? close - previousClose : null;
  const changePercent = Number.isFinite(previousClose) && previousClose !== 0
    ? (close / previousClose - 1) * 100
    : null;

  return {
    ...indicator,
    requested_date: targetDate,
    market_date: targetDate,
    previous_market_date: previous?.date || null,
    open: Number.isFinite(Number(current.open)) ? Number(current.open) : null,
    high: Number.isFinite(Number(current.high)) ? Number(current.high) : null,
    low: Number.isFinite(Number(current.low)) ? Number(current.low) : null,
    close,
    previous_close: Number.isFinite(previousClose) ? previousClose : null,
    change: round(change, 4),
    change_percent: round(changePercent, 4),
    volume: Number.isFinite(Number(current.volume)) ? Number(current.volume) : null,
    rows: rows.slice(0, index + 1),
  };
}

function reconstructExternalPayloadAtDate(sourcePayload, targetDate) {
  const indicators = (Array.isArray(sourcePayload?.indicators) ? sourcePayload.indicators : [])
    .map((indicator) => reconstructIndicatorAtDate(indicator, targetDate))
    .filter(Boolean);

  const payload = {
    ...sourcePayload,
    collection_date: targetDate,
    indicator_count: indicators.length,
    error_count: 0,
    errors: [],
    indicators,
  };
  const validation = primaryExternalValidation(payload, targetDate);
  return validation.exact ? { payload, validation } : null;
}

function findHistoricalExternalSource(targetDate, maxSourceDate) {
  const dates = listDateDirectories(EXTERNAL_ROOT, maxSourceDate)
    .filter((date) => date >= targetDate)
    .sort();

  for (const sourceDate of dates) {
    const file = path.join(EXTERNAL_ROOT, sourceDate, 'external_market_indicators.json');
    if (!fs.existsSync(file) || fs.statSync(file).size === 0) continue;
    const sourcePayload = readJson(file, null);
    const reconstructed = reconstructExternalPayloadAtDate(sourcePayload, targetDate);
    if (!reconstructed) continue;
    return {
      source_date: sourceDate,
      source_collection_date: sourcePayload?.collection_date || null,
      file,
      ...reconstructed,
    };
  }
  return null;
}

function normalizeScore(raw, scale) {
  return round(100 * (1 - Math.exp(-raw / scale)), 1);
}

function externalRisk(indicators) {
  const byId = Object.fromEntries((indicators || []).map((item) => [item.id, item]));
  const negative = (id, multiplier = 1) => Math.max(0, -(Number(byId[id]?.change_percent) || 0)) * multiplier;
  const positive = (id, multiplier = 1) => Math.max(0, Number(byId[id]?.change_percent) || 0) * multiplier;
  const raw =
    negative('nasdaq', 12) +
    negative('sox', 16) +
    negative('tsm_adr', 14) +
    negative('sp500', 8) +
    positive('usd_twd', 8) +
    positive('wti_crude_oil', 7) +
    positive('brent_crude_oil', 7);
  return {
    external_market_risk_score: normalizeScore(raw, 55),
    adr_sox_nasdaq_market_risk: normalizeScore(
      negative('nasdaq', 12) + negative('sox', 16) + negative('tsm_adr', 14),
      45,
    ),
    oil_futures_risk: normalizeScore(
      positive('wti_crude_oil', 7) + positive('brent_crude_oil', 7),
      35,
    ),
  };
}

function recomputeMarketRisk(marketRiskPayload, exactExternalRisk) {
  const news = marketRiskPayload?.news || {};
  return round(
    (Number(news.keyword_risk_score) || 0) * 0.28 +
    (Number(news.foreign_selling_news_weight) || 0) * 0.16 +
    (Number(news.adr_sox_nasdaq_news_risk) || 0) * 0.16 +
    (Number(news.oil_news_risk) || 0) * 0.08 +
    (Number(exactExternalRisk.external_market_risk_score) || 0) * 0.18 +
    (Number(exactExternalRisk.adr_sox_nasdaq_market_risk) || 0) * 0.10 +
    (Number(exactExternalRisk.oil_futures_risk) || 0) * 0.04,
    1,
  );
}

function buildTriggers(metrics) {
  const triggers = [];
  let score = 0;
  const add = (condition, id, label, value, points) => {
    if (!condition) return;
    score += points;
    triggers.push({ id, label, value, points });
  };

  add(metrics.sox_change_1d_pct <= -2, 'sox_1d_drop', '費半單日跌幅低於 -2%', metrics.sox_change_1d_pct, 2);
  add(metrics.sox_return_3d_pct <= -5, 'sox_3d_drop', '費半近 3 個交易日跌幅低於 -5%', metrics.sox_return_3d_pct, 2);
  add(metrics.tsm_adr_change_1d_pct <= -1, 'tsm_adr_drop', '台積電 ADR 單日跌幅低於 -1%', metrics.tsm_adr_change_1d_pct, 1);
  add(metrics.twse_minus_sox_3d_pct_points >= 3, 'twse_sox_divergence', '台股近 3 日相對費半高出至少 3 個百分點', metrics.twse_minus_sox_3d_pct_points, 2);
  add(metrics.twse_change_1d_pct > -0.5, 'twse_not_repriced', '台股前一日跌幅小於 0.5%，可能尚未補跌', metrics.twse_change_1d_pct, 1);
  add(metrics.foreign_futures_net_contracts <= -70000, 'foreign_futures_net_short', '外資臺股期貨淨空低於 -70,000 口', metrics.foreign_futures_net_contracts, 2);
  add(metrics.foreign_futures_net_change_contracts <= -2000, 'foreign_futures_short_increase', '外資期貨淨空單日增加至少 2,000 口', metrics.foreign_futures_net_change_contracts, 1);
  add(metrics.market_risk_score >= 70, 'market_risk_high', '市場風險分數至少 70', metrics.market_risk_score, 1);
  add(metrics.adr_sox_nasdaq_market_risk >= 85, 'semiconductor_external_risk_high', 'ADR／費半外部風險至少 85', metrics.adr_sox_nasdaq_market_risk, 1);
  return { score, triggers };
}

function classifyEnvironment(score, previousActualCode) {
  if (previousActualCode === 'systemic_selloff_first_day') return 'post_shock_day_1';
  if (['post_shock_stress', 'market_stress'].includes(previousActualCode)) return 'post_shock_day_2';
  if (score >= 6) return 'shock_first_day_warning';
  if (score >= 4) return 'risk_warning';
  return 'normal';
}

function main() {
  const args = parseArgs();
  const forecastDate = compactDate(args.get('forecast-date'), 'forecast date');
  const baseDate = compactDate(args.get('base-date'), 'base date');
  const dryRun = args.has('dry-run');
  const outputFile = path.join(ROOT, 'data_market_environment', forecastDate, 'market_environment.json');
  const existing = readJson(outputFile, null);
  if (!existing) throw new Error(`Missing generated market environment: ${path.relative(ROOT, outputFile)}`);

  if (existing.data_freshness?.status === 'fresh' || existing.data_freshness?.status === 'historical_reconstructed') {
    console.log(JSON.stringify({ forecast_date: forecastDate, skipped: true, reason: 'already_exact' }));
    return;
  }

  const source = findHistoricalExternalSource(baseDate, compactDate(args.get('max-source-date') || '20991231'));
  if (!source) {
    console.log(JSON.stringify({ forecast_date: forecastDate, skipped: true, reason: 'no_exact_historical_rows' }));
    return;
  }

  const external = source.payload;
  const sox = indicatorById(external, 'sox');
  const tsmAdr = indicatorById(external, 'tsm_adr');
  const exactExternalRisk = externalRisk(external.indicators || []);
  const marketRiskFile = existing.source_files?.market_risk
    ? path.join(ROOT, existing.source_files.market_risk)
    : null;
  const marketRiskPayload = marketRiskFile ? readJson(marketRiskFile, {}) : {};
  const marketRiskScore = recomputeMarketRisk(marketRiskPayload, exactExternalRisk);
  const twse3d = Number(existing.metrics?.twse_return_3d_pct);
  const sox3d = trailingReturn(sox, 3);

  const metrics = {
    ...existing.metrics,
    sox_change_1d_pct: round(Number(sox?.change_percent)),
    sox_return_3d_pct: round(sox3d),
    tsm_adr_change_1d_pct: round(Number(tsmAdr?.change_percent)),
    twse_minus_sox_3d_pct_points: Number.isFinite(twse3d) && Number.isFinite(sox3d)
      ? round(twse3d - sox3d)
      : null,
    market_risk_score: marketRiskScore,
    adr_sox_nasdaq_market_risk: exactExternalRisk.adr_sox_nasdaq_market_risk,
  };

  const { score, triggers } = buildTriggers(metrics);
  const previous = latestActualEnvironment(baseDate);
  const previousExact = previous?.date === baseDate ? previous : null;
  const previousActualCode = previousExact?.payload?.actual_environment?.code || null;
  const code = classifyEnvironment(score, previousActualCode);
  const labels = {
    normal: '一般環境',
    risk_warning: '風險警告',
    shock_first_day_warning: '首日衝擊警告',
    post_shock_day_1: '衝擊後第 1 日',
    post_shock_day_2: '衝擊後第 2 日',
  };

  const generatedAt = new Date().toISOString();
  const payloadWithoutHash = {
    ...existing,
    schemaVersion: Math.max(3, Number(existing.schemaVersion) || 1),
    generated_at: generatedAt,
    historical_reconstruction: true,
    data_freshness: {
      status: 'historical_reconstructed',
      reason: 'reconstructed_from_later_snapshot_rows',
      expected_us_market_date: baseDate,
      actual_us_market_date: baseDate,
      business_day_gap: 0,
      source_directory_date: source.source_date,
      source_collection_date: source.source_collection_date,
      primary_indicator_agreement: source.validation.primary_indicator_agreement,
      primary_market_dates: source.validation.primary_market_dates,
      error_count: 0,
    },
    source_files: {
      ...existing.source_files,
      external_market: path.relative(ROOT, source.file).replaceAll(path.sep, '/'),
      previous_actual_environment: previousExact
        ? path.relative(ROOT, previousExact.file).replaceAll(path.sep, '/')
        : null,
    },
    metrics,
    environment: {
      code,
      label: labels[code],
      score,
      confidence: triggers.length >= 3 ? 'medium' : 'low',
      triggers,
    },
    strategy_policy: strategyPolicy(code),
    notes: [
      'Shadow mode：目前只標示策略政策，不修改正式方向分數或刪除原始候選。',
      '首日衝擊分數為啟發式，需累積至少 30～60 個覆盤日與多個系統性事件後校準。',
      `美股行情由 ${path.relative(ROOT, source.file).replaceAll(path.sep, '/')} 的歷史 rows 精確重建至 ${baseDate}；已截斷目標日之後資料。`,
      '此檔為歷史重建，不代表當時系統已在台股開盤前成功保存該快照。',
    ],
  };
  delete payloadWithoutHash.snapshot_hash;
  const payload = { ...payloadWithoutHash, snapshot_hash: sha256(payloadWithoutHash) };

  if (!dryRun) {
    atomicWriteJson(outputFile, payload);
    refreshEnvironmentIndexes(generatedAt);
  }
  console.log(JSON.stringify({
    forecast_date: forecastDate,
    base_date: baseDate,
    reconstructed: true,
    source_date: source.source_date,
    environment: code,
    score,
    dry_run: dryRun,
  }));
}

if (require.main === module) main();

module.exports = {
  reconstructIndicatorAtDate,
  reconstructExternalPayloadAtDate,
  findHistoricalExternalSource,
  externalRisk,
  recomputeMarketRisk,
  buildTriggers,
  classifyEnvironment,
};
