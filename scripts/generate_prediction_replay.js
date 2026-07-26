#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const PREDICTION_DIR = path.join(ROOT, 'data_predictions');
const FUBON_DIR = path.join(ROOT, 'data_fubon');
const CONCEPT_LIST_FILE = path.join(ROOT, 'data_concept_stocks', 'concept-stock-lists.json');

function readJson(file, fallback = null) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return fallback;
  }
}

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const item = argv[index];
    if (item === '--date') args.date = argv[++index];
    else if (item === '--actual-date') args.actualDate = argv[++index];
    else if (item === '--dry-run') args.dryRun = true;
    else if (item === '--help' || item === '-h') args.help = true;
  }
  return args;
}

function usage() {
  return [
    'Usage:',
    '  node scripts/generate_prediction_replay.js --date YYYYMMDD [--actual-date YYYYMMDD] [--dry-run]',
    '',
    'Example:',
    '  node scripts/generate_prediction_replay.js --date 20260727',
  ].join('\n');
}

function compactDate(value) {
  return String(value || '').replaceAll('-', '').replaceAll('/', '');
}

function slashDate(value) {
  const compact = compactDate(value);
  return `${compact.slice(0, 4)}/${compact.slice(4, 6)}/${compact.slice(6, 8)}`;
}

function isoDate(value) {
  const compact = compactDate(value);
  return `${compact.slice(0, 4)}-${compact.slice(4, 6)}-${compact.slice(6, 8)}`;
}

function num(value) {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(String(value).replaceAll(',', '').trim());
  return Number.isFinite(parsed) ? parsed : null;
}

function round(value, digits = 2) {
  return Number.isFinite(value) ? Number(value.toFixed(digits)) : null;
}

function pct(current, previous) {
  return Number.isFinite(current) && Number.isFinite(previous) && previous !== 0
    ? (current / previous - 1) * 100
    : null;
}

function average(values) {
  const valid = values.filter(Number.isFinite);
  return valid.length ? valid.reduce((sum, value) => sum + value, 0) / valid.length : null;
}

function ratio(rows, predicate) {
  return rows.length ? rows.filter(predicate).length / rows.length * 100 : null;
}

function fubonFile(date) {
  return path.join(FUBON_DIR, `fubon_${compactDate(date)}_sma.json`);
}

function parseFubonRow(item, date) {
  const row = item?.[slashDate(date)] || item?.[isoDate(date)];
  if (!row) return null;
  return {
    close: num(row.Price ?? row.Close),
    open: num(row.Open),
    high: num(row.High),
    low: num(row.Low),
    volume: num(row.Volume),
    sma5: num(row.SMA5),
    sma20: num(row.SMA20),
    sma60: num(row.SMA60),
  };
}

function loadFubonSnapshot(date) {
  const file = fubonFile(date);
  const data = readJson(file, null);
  if (!data) {
    throw new Error(`Missing actual price file: ${path.relative(ROOT, file)}`);
  }
  return data;
}

function loadVolumeHistory(untilDate) {
  const compactUntil = compactDate(untilDate);
  const files = fs.readdirSync(FUBON_DIR)
    .filter((file) => /^fubon_20\d{6}_sma\.json$/.test(file))
    .map((file) => ({ file, date: file.slice(6, 14) }))
    .filter((item) => item.date <= compactUntil)
    .sort((left, right) => left.date.localeCompare(right.date));

  const history = new Map();
  for (const { file, date } of files) {
    const data = readJson(path.join(FUBON_DIR, file), {});
    for (const [code, item] of Object.entries(data || {})) {
      const row = parseFubonRow(item, date);
      if (!row || !Number.isFinite(row.volume)) continue;
      if (!history.has(code)) history.set(code, []);
      history.get(code).push({ date, volume: row.volume });
    }
  }
  return history;
}

function previousVolumeAverage(history, code, actualDate, periods) {
  const rows = (history.get(String(code)) || [])
    .filter((row) => row.date < compactDate(actualDate))
    .slice(-periods);
  return average(rows.map((row) => row.volume));
}

function isBullish(label) {
  return String(label || '').includes('偏多');
}

function isBearish(label) {
  return String(label || '').includes('偏空');
}

function directionSide(label) {
  if (isBullish(label)) return 'bullish';
  if (isBearish(label)) return 'bearish';
  return 'neutral';
}

function addIf(tags, condition, tag) {
  if (condition) tags.push(tag);
}

function actualPattern(metrics) {
  const tags = [];
  const openMove = metrics.open_return;
  const closeMove = metrics.close_return;
  const intraday = metrics.intraday_return;
  const range = metrics.range_percent;
  const volumeRatio = metrics.volume_ratio_5d_actual ?? metrics.volume_ratio_20d_actual;

  const openedHigh = openMove >= 0.3;
  const openedLow = openMove <= -0.3;
  const closedUpFromOpen = intraday >= 0.3;
  const closedDownFromOpen = intraday <= -0.3;

  addIf(tags, openedHigh && closedUpFromOpen, '開高走高');
  addIf(tags, openedHigh && closedDownFromOpen, '開高走低');
  addIf(tags, openedLow && closedUpFromOpen, '開低走高');
  addIf(tags, openedLow && closedDownFromOpen, '開低走低');
  addIf(tags, Number.isFinite(volumeRatio) && volumeRatio >= 1.5 && closeMove >= 0.7, '放量上攻');
  addIf(tags, Number.isFinite(volumeRatio) && volumeRatio >= 1.5 && closeMove <= -0.7, '放量下殺');
  addIf(tags, Number.isFinite(volumeRatio) && volumeRatio <= 0.7 && Math.abs(closeMove) <= 0.7 && range <= 2, '縮量整理');
  addIf(tags, metrics.upper_shadow_percent >= 1.2 && metrics.upper_shadow_percent >= metrics.lower_shadow_percent * 1.5, '長上影賣壓');
  addIf(tags, metrics.lower_shadow_percent >= 1.2 && metrics.lower_shadow_percent >= metrics.upper_shadow_percent * 1.5, '長下影承接');
  if (!tags.length) tags.push(Math.abs(closeMove) <= 0.5 ? '平盤震盪' : closeMove > 0 ? '收盤偏強' : '收盤偏弱');
  return tags;
}

function actualMood(metrics, tags) {
  let score = 0;
  if (metrics.close_return >= 1.5) score += 2;
  else if (metrics.close_return >= 0.3) score += 1;
  else if (metrics.close_return <= -1.5) score -= 2;
  else if (metrics.close_return <= -0.3) score -= 1;

  if (metrics.intraday_return >= 1) score += 1;
  else if (metrics.intraday_return <= -1) score -= 1;

  if (tags.includes('開低走高')) score += 2;
  if (tags.includes('開高走低')) score -= 2;
  if (tags.includes('放量上攻')) score += 2;
  if (tags.includes('放量下殺')) score -= 2;
  if (tags.includes('長下影承接')) score += 1;
  if (tags.includes('長上影賣壓')) score -= 1;

  let label = '中性';
  if (score >= 4) label = '強多';
  else if (score >= 2) label = '偏多';
  else if (score <= -4) label = '強空';
  else if (score <= -2) label = '偏空';
  return { score, label };
}

function matchPrediction(stock, mood) {
  const side = directionSide(stock.final_direction_label);
  let directionAccuracy = 'neutral';
  let moodAccuracy = 'neutral';
  let label = '中性難判';

  if (side === 'bullish') {
    directionAccuracy = mood.score > 0 ? 'hit' : mood.score < 0 ? 'miss' : 'neutral';
    moodAccuracy = mood.score >= 2 ? 'hit' : mood.score <= -2 ? 'miss' : 'neutral';
    label = mood.score >= 2 ? '明顯準確' : mood.score > 0 ? '大致準確' : mood.score <= -2 ? '明顯不準' : mood.score < 0 ? '大致不準' : '中性難判';
  } else if (side === 'bearish') {
    directionAccuracy = mood.score < 0 ? 'hit' : mood.score > 0 ? 'miss' : 'neutral';
    moodAccuracy = mood.score <= -2 ? 'hit' : mood.score >= 2 ? 'miss' : 'neutral';
    label = mood.score <= -2 ? '明顯準確' : mood.score < 0 ? '大致準確' : mood.score >= 2 ? '明顯不準' : mood.score > 0 ? '大致不準' : '中性難判';
  } else {
    directionAccuracy = Math.abs(mood.score) <= 1 ? 'hit' : 'neutral';
    moodAccuracy = Math.abs(mood.score) <= 1 ? 'hit' : 'neutral';
    label = Math.abs(mood.score) <= 1 ? '大致準確' : '中性難判';
  }
  return { direction_accuracy: directionAccuracy, mood_accuracy: moodAccuracy, prediction_match_label: label };
}

function reasonTags(stock, patternTags, match) {
  const tags = [];
  const accurate = match.prediction_match_label.includes('準確');
  const inaccurate = match.prediction_match_label.includes('不準');

  if (accurate) {
    addIf(tags, stock.reversal_signals?.tags?.length, '技術轉強後續強');
    addIf(tags, patternTags.includes('放量上攻') || patternTags.includes('放量下殺'), '放量配合方向');
    addIf(tags, stock.chip_bias === '偏多' && isBullish(stock.final_direction_label), '籌碼同步偏多');
    addIf(tags, stock.chip_bias === '偏空' && isBearish(stock.final_direction_label), '籌碼同步偏空');
    addIf(tags, stock.relative_strength_7d?.relative_strength_strong, '相對強勢有效');
    addIf(tags, stock.data_completeness >= 80 && stock.risk_label !== '高風險', '低風險高完整度樣本命中');
  }

  if (inaccurate) {
    addIf(tags, patternTags.includes('開高走低'), '開高出貨');
    addIf(tags, patternTags.includes('開低走高'), '開低承接轉強');
    addIf(tags, patternTags.includes('放量下殺'), '放量反殺');
    addIf(tags, patternTags.includes('縮量整理'), '量能不足');
    addIf(tags, stock.combined_risk_label === '高風險' || stock.market_context_risk_label === '高風險', '高風險環境干擾');
    addIf(tags, stock.chip_bias === '偏空' && isBullish(stock.final_direction_label), '籌碼與技術矛盾');
    addIf(tags, stock.chip_bias === '偏多' && isBearish(stock.final_direction_label), '籌碼與技術矛盾');
    addIf(tags, stock.data_completeness < 80 || (stock.missing_data || []).length, '預測時資料缺漏');
    addIf(tags, stock.features?.rsi14 >= 70 || Math.abs(stock.features?.gap_sma20 ?? 0) >= 15, '前一日過熱反轉');
  }

  return tags.length ? tags : ['待人工覆盤'];
}

function buildReplayRow(stock, baseRow, actualRow, volumeHistory, actualDate) {
  if (!baseRow || !actualRow || !Number.isFinite(baseRow.close) || !Number.isFinite(actualRow.close)) {
    return {
      stock_code: stock.stock_code,
      stock_name: stock.stock_name,
      verified: false,
      missing_reason: 'missing_price_row',
    };
  }

  const volumeAvg5 = previousVolumeAverage(volumeHistory, stock.stock_code, actualDate, 5);
  const volumeAvg20 = previousVolumeAverage(volumeHistory, stock.stock_code, actualDate, 20);
  const bodyHigh = Math.max(actualRow.open, actualRow.close);
  const bodyLow = Math.min(actualRow.open, actualRow.close);
  const metrics = {
    open_return: round(pct(actualRow.open, baseRow.close)),
    close_return: round(pct(actualRow.close, baseRow.close)),
    intraday_return: round(pct(actualRow.close, actualRow.open)),
    range_percent: round((actualRow.high - actualRow.low) / baseRow.close * 100),
    upper_shadow_percent: round((actualRow.high - bodyHigh) / baseRow.close * 100),
    lower_shadow_percent: round((bodyLow - actualRow.low) / baseRow.close * 100),
    volume_ratio_5d_actual: round(Number.isFinite(volumeAvg5) ? actualRow.volume / volumeAvg5 : null),
    volume_ratio_20d_actual: round(Number.isFinite(volumeAvg20) ? actualRow.volume / volumeAvg20 : null),
  };
  const patternTags = actualPattern(metrics);
  const mood = actualMood(metrics, patternTags);
  const match = matchPrediction(stock, mood);

  return {
    stock_code: stock.stock_code,
    stock_name: stock.stock_name,
    industry: stock.industry,
    report_file: stock.report_file,
    verified: true,
    prediction: {
      final_direction_label: stock.final_direction_label,
      direction_score: stock.direction_score,
      risk_label: stock.risk_label,
      combined_risk_label: stock.combined_risk_label,
      data_completeness: stock.data_completeness,
      chip_bias: stock.chip_bias,
      strategy_tags: stock.strategy_tags || [],
    },
    actual: {
      base_close: round(baseRow.close),
      open: round(actualRow.open),
      high: round(actualRow.high),
      low: round(actualRow.low),
      close: round(actualRow.close),
      volume: actualRow.volume,
      ...metrics,
      pattern_tags: patternTags,
      mood_score: mood.score,
      mood_label: mood.label,
    },
    ...match,
    reason_tags: reasonTags(stock, patternTags, match),
  };
}

function summarizeGroup(name, rows) {
  const verified = rows.filter((row) => row.verified);
  return {
    name,
    count: verified.length,
    obvious_hit_count: verified.filter((row) => row.prediction_match_label === '明顯準確').length,
    obvious_miss_count: verified.filter((row) => row.prediction_match_label === '明顯不準').length,
    hit_rate: round(ratio(verified, (row) => row.prediction_match_label.includes('準確'))),
    obvious_miss_rate: round(ratio(verified, (row) => row.prediction_match_label === '明顯不準')),
    average_close_return: round(average(verified.map((row) => row.actual.close_return))),
    average_mood_score: round(average(verified.map((row) => row.actual.mood_score))),
  };
}

function groupBy(rows, keyFn) {
  const groups = new Map();
  for (const row of rows) {
    for (const key of [].concat(keyFn(row)).filter(Boolean)) {
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(row);
    }
  }
  return [...groups.entries()].map(([name, items]) => summarizeGroup(name, items))
    .sort((left, right) => right.count - left.count || right.hit_rate - left.hit_rate);
}

function conceptSummaries(rows) {
  const concepts = readJson(CONCEPT_LIST_FILE, { lists: [] }).lists || [];
  const rowByCode = new Map(rows.map((row) => [String(row.stock_code), row]));
  return concepts.map((concept) => {
    const members = concept.stocks.map((stock) => rowByCode.get(String(stock.code))).filter(Boolean);
    return summarizeGroup(concept.name, members);
  }).filter((item) => item.count > 0)
    .sort((left, right) => right.count - left.count || right.hit_rate - left.hit_rate);
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help || !args.date) {
    console.log(usage());
    process.exit(args.help ? 0 : 1);
  }

  const predictionDate = compactDate(args.date);
  const predictionDir = path.join(PREDICTION_DIR, predictionDate);
  const summary = readJson(path.join(predictionDir, 'summary.json'), null);
  if (!summary) throw new Error(`Missing prediction summary: data_predictions/${predictionDate}/summary.json`);

  const actualDate = compactDate(args.actualDate || summary.forecast_date || predictionDate);
  const baseDate = compactDate(summary.base_trade_date);
  const baseSnapshot = loadFubonSnapshot(baseDate);
  const actualSnapshot = loadFubonSnapshot(actualDate);
  const volumeHistory = loadVolumeHistory(actualDate);

  const rows = summary.stocks.map((stock) => buildReplayRow(
    stock,
    parseFubonRow(baseSnapshot[String(stock.stock_code)], baseDate),
    parseFubonRow(actualSnapshot[String(stock.stock_code)], actualDate),
    volumeHistory,
    actualDate,
  ));
  const verified = rows.filter((row) => row.verified);
  const obviousHits = verified.filter((row) => row.prediction_match_label === '明顯準確')
    .sort((left, right) => Math.abs(right.actual.mood_score) - Math.abs(left.actual.mood_score));
  const obviousMisses = verified.filter((row) => row.prediction_match_label === '明顯不準')
    .sort((left, right) => Math.abs(right.actual.mood_score) - Math.abs(left.actual.mood_score));

  const summaryPayload = {
    generated_at: new Date().toISOString(),
    prediction_date: isoDate(predictionDate),
    base_trade_date: isoDate(baseDate),
    actual_trade_date: isoDate(actualDate),
    total_predictions: rows.length,
    verified_count: verified.length,
    missing_count: rows.length - verified.length,
    obvious_hit_count: obviousHits.length,
    obvious_miss_count: obviousMisses.length,
    hit_rate: round(ratio(verified, (row) => row.prediction_match_label.includes('準確'))),
    obvious_miss_rate: round(ratio(verified, (row) => row.prediction_match_label === '明顯不準')),
    bullish_hit_rate: round(ratio(verified.filter((row) => isBullish(row.prediction.final_direction_label)), (row) => row.prediction_match_label.includes('準確'))),
    bearish_hit_rate: round(ratio(verified.filter((row) => isBearish(row.prediction.final_direction_label)), (row) => row.prediction_match_label.includes('準確'))),
    open_high_selloff_count: verified.filter((row) => row.actual.pattern_tags.includes('開高走低') && isBullish(row.prediction.final_direction_label)).length,
    open_low_reversal_count: verified.filter((row) => row.actual.pattern_tags.includes('開低走高') && isBearish(row.prediction.final_direction_label)).length,
    by_industry: groupBy(verified, (row) => row.industry).slice(0, 30),
    by_strategy_tag: groupBy(verified, (row) => row.prediction.strategy_tags).slice(0, 30),
    by_concept: conceptSummaries(verified).slice(0, 30),
    obvious_hits: obviousHits.slice(0, 30),
    obvious_misses: obviousMisses.slice(0, 30),
  };

  const mistakesPayload = {
    generated_at: summaryPayload.generated_at,
    prediction_date: summaryPayload.prediction_date,
    actual_trade_date: summaryPayload.actual_trade_date,
    count: obviousMisses.length,
    mistakes: obviousMisses,
    by_reason: groupBy(obviousMisses, (row) => row.reason_tags),
    by_industry: groupBy(obviousMisses, (row) => row.industry),
    by_strategy_tag: groupBy(obviousMisses, (row) => row.prediction.strategy_tags),
    by_concept: conceptSummaries(obviousMisses),
  };

  const outputs = [
    path.join(predictionDir, 'replay.json'),
    path.join(predictionDir, 'replay-summary.json'),
    path.join(predictionDir, 'replay-mistakes.json'),
  ];

  if (!args.dryRun) {
    fs.writeFileSync(outputs[0], `${JSON.stringify({
    generated_at: summaryPayload.generated_at,
    prediction_date: summaryPayload.prediction_date,
    base_trade_date: summaryPayload.base_trade_date,
    actual_trade_date: summaryPayload.actual_trade_date,
    rows,
    }, null, 2)}\n`, 'utf8');
    fs.writeFileSync(outputs[1], `${JSON.stringify(summaryPayload, null, 2)}\n`, 'utf8');
    fs.writeFileSync(outputs[2], `${JSON.stringify(mistakesPayload, null, 2)}\n`, 'utf8');
  }

  console.log(JSON.stringify({
    prediction_date: predictionDate,
    actual_date: actualDate,
    dry_run: Boolean(args.dryRun),
    verified: verified.length,
    obvious_hits: obviousHits.length,
    obvious_misses: obviousMisses.length,
    outputs: outputs.map((file) => path.relative(ROOT, file)),
  }, null, 2));
}

try {
  main();
} catch (error) {
  console.error(error.message);
  process.exit(1);
}
