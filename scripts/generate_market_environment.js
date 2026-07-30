#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const {
  ROOT,
  parseArgs,
  compactDate,
  compactToIso,
  weekdayAtOrBefore,
  businessDayDistance,
  readJson,
  atomicWriteJson,
  round,
  pctChange,
  sha256,
  latestDatedFileInDirectories,
  primaryExternalValidation,
  indicatorById,
  trailingReturn,
  loadTwseHistory,
  loadFuturesHistory,
  environmentOutputDir,
  refreshEnvironmentIndexes,
  latestActualEnvironment,
} = require('./market_environment_lib');

function taipeiToday() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Taipei',
    year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}${values.month}${values.day}`;
}

function trigger(id, label, value, points) {
  return { id, label, value, points };
}

function strategyPolicy(code) {
  const common = {
    enforcement_mode: 'shadow',
    raw_predictions_preserved: true,
    formal_direction_score_adjustment: 0,
    bearish_prediction: 'normal',
  };
  if (code === 'shock_first_day_warning') {
    return {
      ...common,
      relative_leadership_momentum: 'disabled_shadow',
      bullish_upgrade: 'blocked_shadow',
      post_shock_survivor: 'not_applicable',
      explanation: '首日衝擊風險時僅在 Shadow mode 停用量價動能相對領漲清單，不改正式分數。',
    };
  }
  if (code === 'post_shock_day_1') {
    return {
      ...common,
      relative_leadership_momentum: 'restricted_shadow',
      bullish_upgrade: 'confirmed_only_shadow',
      post_shock_survivor: 'enabled_shadow',
      explanation: '前一日已確認系統性賣壓，改研究抗跌倖存者，不以一般高動能規則追價。',
    };
  }
  if (code === 'post_shock_day_2') {
    return {
      ...common,
      relative_leadership_momentum: 'restricted_shadow',
      bullish_upgrade: 'confirmed_only_shadow',
      post_shock_survivor: 'enabled_shadow',
      explanation: '衝擊後第二日有限度恢復一般動能，仍保留抗跌倖存者研究。',
    };
  }
  if (code === 'risk_warning') {
    return {
      ...common,
      relative_leadership_momentum: 'reduced_shadow',
      bullish_upgrade: 'extra_confirmation_shadow',
      post_shock_survivor: 'not_applicable',
      explanation: '風險警告時縮小候選清單並要求額外確認，不改正式方向分數。',
    };
  }
  if (code === 'data_invalid') {
    return {
      ...common,
      relative_leadership_momentum: 'unavailable',
      bullish_upgrade: 'unavailable',
      bearish_prediction: 'unavailable',
      post_shock_survivor: 'unavailable',
      explanation: '來源資料不完整或過期，不應產生正式環境判定。',
    };
  }
  return {
    ...common,
    relative_leadership_momentum: 'normal',
    bullish_upgrade: 'normal',
    post_shock_survivor: 'not_applicable',
    explanation: '一般環境，所有策略維持原始輸出。',
  };
}

function main() {
  const args = parseArgs();
  const forecastDate = compactDate(args.get('forecast-date') || process.env.FORECAST_TARGET_DATE, 'forecast date');
  const baseDate = compactDate(args.get('base-date') || process.env.FORECAST_BASE_DATE, 'base date');
  const force = args.has('force');
  const dryRun = args.has('dry-run');
  const strict = args.has('strict');
  const outputDir = environmentOutputDir(forecastDate);
  const outputFile = path.join(outputDir, 'market_environment.json');

  if (!force && fs.existsSync(outputFile) && fs.statSync(outputFile).size > 0) {
    const existing = readJson(outputFile, {});
    if (existing.forecast_date_compact !== forecastDate || existing.base_trade_date_compact !== baseDate) {
      throw new Error(`Existing environment snapshot date mismatch: ${outputFile}`);
    }
    console.log(JSON.stringify({ reused: true, environment: existing.environment?.code, output: path.relative(ROOT, outputFile) }));
    return;
  }

  const expectedUsDate = weekdayAtOrBefore(baseDate);
  const externalSource = latestDatedFileInDirectories(
    path.join(ROOT, 'data_external_market'),
    baseDate,
    'external_market_indicators.json',
  );
  const external = externalSource?.payload || null;
  const externalValidation = primaryExternalValidation(external, expectedUsDate);
  const actualUsDate = externalValidation.actual_date;
  const usDateGap = actualUsDate ? businessDayDistance(expectedUsDate, actualUsDate, 7) : Infinity;
  let freshnessStatus = 'invalid';
  if (externalValidation.exact) freshnessStatus = 'fresh';
  else if (externalValidation.complete && usDateGap <= 1) freshnessStatus = 'holiday_adjusted';
  else if (externalValidation.complete && usDateGap <= 2) freshnessStatus = 'stale_warning';

  const marketRiskSource = latestDatedFileInDirectories(
    path.join(ROOT, 'data_market_risk'),
    baseDate,
    'market_risk_snapshot.json',
  );
  const marketRisk = marketRiskSource?.payload || {};
  const twseHistory = loadTwseHistory(baseDate);
  const twseCurrent = [...twseHistory].reverse().find((item) => item.date === baseDate) || twseHistory.at(-1) || null;
  const twseThreeBack = twseHistory.length >= 4 ? twseHistory.at(-4) : null;
  const futuresHistory = loadFuturesHistory(baseDate);
  const futuresCurrent = [...futuresHistory].reverse().find((item) => item.date === baseDate) || futuresHistory.at(-1) || null;
  const futuresPrevious = futuresHistory.length >= 2 ? futuresHistory.at(-2) : null;
  const previousActual = latestActualEnvironment(baseDate);

  const sox = indicatorById(external, 'sox');
  const tsmAdr = indicatorById(external, 'tsm_adr');
  const sox1d = Number(sox?.change_percent);
  const sox3d = trailingReturn(sox, 3);
  const tsm1d = Number(tsmAdr?.change_percent);
  const twse1d = Number(twseCurrent?.change_percent);
  const twse3d = twseThreeBack ? pctChange(twseCurrent?.close, twseThreeBack.close) : null;
  const twseSoxGap = Number.isFinite(twse3d) && Number.isFinite(sox3d) ? twse3d - sox3d : null;
  const foreignNet = Number(futuresCurrent?.net_contracts);
  const foreignNetChange = Number.isFinite(foreignNet) && Number.isFinite(Number(futuresPrevious?.net_contracts))
    ? foreignNet - Number(futuresPrevious.net_contracts)
    : null;
  const riskScore = Number(marketRisk?.market_risk_score);
  const adrRisk = Number(marketRisk?.external_market?.adr_sox_nasdaq_market_risk);

  const triggers = [];
  let score = 0;
  const add = (condition, id, label, value, points) => {
    if (!condition) return;
    score += points;
    triggers.push(trigger(id, label, value, points));
  };
  add(Number.isFinite(sox1d) && sox1d <= -2, 'sox_1d_drop', '費半單日跌幅低於 -2%', round(sox1d), 2);
  add(Number.isFinite(sox3d) && sox3d <= -5, 'sox_3d_drop', '費半近 3 個交易日跌幅低於 -5%', round(sox3d), 2);
  add(Number.isFinite(tsm1d) && tsm1d <= -1, 'tsm_adr_drop', '台積電 ADR 單日跌幅低於 -1%', round(tsm1d), 1);
  add(Number.isFinite(twseSoxGap) && twseSoxGap >= 3, 'twse_sox_divergence', '台股近 3 日相對費半高出至少 3 個百分點', round(twseSoxGap), 2);
  add(Number.isFinite(twse1d) && twse1d > -0.5, 'twse_not_repriced', '台股前一日跌幅小於 0.5%，可能尚未補跌', round(twse1d), 1);
  add(Number.isFinite(foreignNet) && foreignNet <= -70000, 'foreign_futures_net_short', '外資臺股期貨淨空低於 -70,000 口', foreignNet, 2);
  add(Number.isFinite(foreignNetChange) && foreignNetChange <= -2000, 'foreign_futures_short_increase', '外資期貨淨空單日增加至少 2,000 口', foreignNetChange, 1);
  add(Number.isFinite(riskScore) && riskScore >= 70, 'market_risk_high', '市場風險分數至少 70', round(riskScore, 1), 1);
  add(Number.isFinite(adrRisk) && adrRisk >= 85, 'semiconductor_external_risk_high', 'ADR／費半外部風險至少 85', round(adrRisk, 1), 1);

  const recentActualCode = previousActual?.payload?.actual_environment?.code || null;
  let code;
  if (!externalValidation.complete || ['invalid', 'stale_warning'].includes(freshnessStatus)) code = 'data_invalid';
  else if (recentActualCode === 'systemic_selloff_first_day') code = 'post_shock_day_1';
  else if (['post_shock_stress', 'market_stress'].includes(recentActualCode)) code = 'post_shock_day_2';
  else if (score >= 6) code = 'shock_first_day_warning';
  else if (score >= 4) code = 'risk_warning';
  else code = 'normal';

  const labels = {
    normal: '一般環境',
    risk_warning: '風險警告',
    shock_first_day_warning: '首日衝擊警告',
    post_shock_day_1: '衝擊後第 1 日',
    post_shock_day_2: '衝擊後第 2 日',
    data_invalid: '資料無效',
  };

  const generatedAt = new Date().toISOString();
  const historical = forecastDate < taipeiToday();
  const payloadWithoutHash = {
    schemaVersion: 1,
    generated_at: generatedAt,
    forecast_date: compactToIso(forecastDate),
    forecast_date_compact: forecastDate,
    base_trade_date: compactToIso(baseDate),
    base_trade_date_compact: baseDate,
    information_cutoff: generatedAt,
    historical_reconstruction: historical,
    mode: 'shadow',
    data_freshness: {
      status: freshnessStatus,
      expected_us_market_date: expectedUsDate,
      actual_us_market_date: actualUsDate,
      business_day_gap: Number.isFinite(usDateGap) ? usDateGap : null,
      primary_indicator_agreement: externalValidation.primary_indicator_agreement,
      primary_market_dates: externalValidation.primary_market_dates,
      error_count: externalValidation.error_count,
    },
    source_files: {
      external_market: externalSource ? path.relative(ROOT, externalSource.file).replaceAll(path.sep, '/') : null,
      market_risk: marketRiskSource ? path.relative(ROOT, marketRiskSource.file).replaceAll(path.sep, '/') : null,
      twse_index: twseCurrent ? path.relative(ROOT, twseCurrent.file).replaceAll(path.sep, '/') : null,
      foreign_futures: futuresCurrent ? path.relative(ROOT, futuresCurrent.file).replaceAll(path.sep, '/') : null,
      previous_actual_environment: previousActual ? path.relative(ROOT, previousActual.file).replaceAll(path.sep, '/') : null,
    },
    metrics: {
      sox_change_1d_pct: round(sox1d),
      sox_return_3d_pct: round(sox3d),
      tsm_adr_change_1d_pct: round(tsm1d),
      twse_change_1d_pct: round(twse1d),
      twse_return_3d_pct: round(twse3d),
      twse_minus_sox_3d_pct_points: round(twseSoxGap),
      foreign_futures_net_contracts: Number.isFinite(foreignNet) ? foreignNet : null,
      foreign_futures_net_change_contracts: Number.isFinite(foreignNetChange) ? foreignNetChange : null,
      market_risk_score: round(riskScore, 1),
      adr_sox_nasdaq_market_risk: round(adrRisk, 1),
    },
    environment: {
      code,
      label: labels[code],
      score,
      confidence: freshnessStatus === 'fresh' && triggers.length >= 3 ? 'medium' : 'low',
      triggers,
    },
    strategy_policy: strategyPolicy(code),
    notes: [
      'Shadow mode：目前只標示策略政策，不修改正式方向分數或刪除原始候選。',
      '首日衝擊分數為啟發式，需累積至少 30～60 個覆盤日與多個系統性事件後校準。',
      historical ? '此檔為歷史重建，generated_at 不代表當時實際盤前取得時間。' : '此檔為目前流程產生的盤前環境快照。',
    ],
  };
  const payload = { ...payloadWithoutHash, snapshot_hash: sha256(payloadWithoutHash) };

  if (strict && code === 'data_invalid') {
    throw new Error(`Market environment data is not fresh enough: ${JSON.stringify(payload.data_freshness)}`);
  }

  if (!dryRun) {
    atomicWriteJson(outputFile, payload);
    refreshEnvironmentIndexes(generatedAt);
  }
  console.log(JSON.stringify({
    forecast_date: forecastDate,
    base_date: baseDate,
    environment: code,
    score,
    freshness: freshnessStatus,
    snapshot_hash: payload.snapshot_hash,
    dry_run: dryRun,
    output: path.relative(ROOT, outputFile).replaceAll(path.sep, '/'),
  }));
}

if (require.main === module) main();

module.exports = { main, strategyPolicy };
