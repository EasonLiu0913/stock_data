#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const V1_DIR = path.join(ROOT, 'data_predictions');
const V2_DIR = path.join(ROOT, 'data_predictions_v2');
const OUTPUT_ROOT = path.join(ROOT, 'data_prediction_analysis');
const ANALYSIS_VERSION = '1.1.0';
const DEFAULT_LOW_VOLUME_THRESHOLD = 0.75;
const DEFAULT_SENSITIVITY_THRESHOLDS = [0.5, 0.75, 1, 1.2];

function readJson(file, fallback = null) {
  try {
    const text = fs.readFileSync(file, 'utf8').trim();
    return text ? JSON.parse(text) : fallback;
  } catch {
    return fallback;
  }
}

function writeJsonAtomic(file, payload) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const temporary = `${file}.tmp-${process.pid}`;
  fs.writeFileSync(temporary, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  fs.renameSync(temporary, file);
}

function writeTextAtomic(file, content) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const temporary = `${file}.tmp-${process.pid}`;
  fs.writeFileSync(temporary, content, 'utf8');
  fs.renameSync(temporary, file);
}

function compactDate(value) {
  return String(value || '').replaceAll('-', '').replaceAll('/', '');
}

function isoDate(value) {
  const date = compactDate(value);
  return `${date.slice(0, 4)}-${date.slice(4, 6)}-${date.slice(6, 8)}`;
}

function number(value) {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(String(value).replaceAll(',', '').trim());
  return Number.isFinite(parsed) ? parsed : null;
}

function round(value, digits = 2) {
  return Number.isFinite(value) ? Number(value.toFixed(digits)) : null;
}

function average(values) {
  const valid = values.filter(Number.isFinite);
  return valid.length ? valid.reduce((sum, value) => sum + value, 0) / valid.length : null;
}

function rate(rows, predicate) {
  return rows.length ? rows.filter(predicate).length / rows.length * 100 : null;
}

function parseArgs(argv) {
  const args = {
    lowVolumeThreshold: DEFAULT_LOW_VOLUME_THRESHOLD,
    sensitivityThresholds: DEFAULT_SENSITIVITY_THRESHOLDS,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const item = argv[index];
    if (item === '--date') args.date = compactDate(argv[++index]);
    else if (item === '--low-volume-threshold') args.lowVolumeThreshold = Number(argv[++index]);
    else if (item === '--thresholds') {
      args.sensitivityThresholds = String(argv[++index] || '')
        .split(',')
        .map(Number)
        .filter((value) => Number.isFinite(value) && value >= 0);
    } else if (item === '--help' || item === '-h') args.help = true;
  }
  return args;
}

function usage() {
  return [
    'Usage:',
    '  node scripts/analyze_replay_volume_filter.js [--date YYYYMMDD]',
    '    [--low-volume-threshold 0.75] [--thresholds 0.5,0.75,1,1.2]',
    '',
    'Low volume is defined as actual result-day volume / previous 20 trading-day average volume <= threshold.',
  ].join('\n');
}

function isNonEmptyJson(file, requiredArrayKey = null) {
  const payload = readJson(file, null);
  if (!payload) return false;
  if (requiredArrayKey) return Array.isArray(payload[requiredArrayKey]) && payload[requiredArrayKey].length > 0;
  return true;
}

function availableAnalysisDates() {
  const candidates = new Set();
  const v1Manifest = readJson(path.join(V1_DIR, 'manifest.json'), {});
  const v2Manifest = readJson(path.join(V2_DIR, 'manifest.json'), {});
  for (const value of [
    ...(v1Manifest.available_dates || []),
    v1Manifest.latest_date,
    v1Manifest.forecast_date_compact,
    ...(v2Manifest.available_dates || []),
    v2Manifest.latest_date,
    v2Manifest.forecast_date_compact,
  ]) {
    const date = compactDate(value);
    if (/^20\d{6}$/.test(date)) candidates.add(date);
  }
  return [...candidates].sort().reverse();
}

function resolveDate(requestedDate) {
  if (requestedDate) {
    if (!/^20\d{6}$/.test(requestedDate)) throw new Error(`Invalid date: ${requestedDate}`);
    return requestedDate;
  }
  for (const date of availableAnalysisDates()) {
    const v1File = path.join(V1_DIR, date, 'replay.json');
    const v2File = path.join(V2_DIR, date, 'replay-v2.json');
    if (isNonEmptyJson(v1File, 'rows') && isNonEmptyJson(v2File, 'rows')) return date;
  }
  throw new Error('No date has both non-empty V1 replay.json and V2 replay-v2.json');
}

function v1Outcome(label) {
  const text = String(label || '');
  if (text.includes('不準')) return 'miss';
  if (text.includes('準確')) return 'hit';
  return 'neutral';
}

function v2Outcome(value) {
  return value === 'hit' || value === 'miss' ? value : 'neutral';
}

function directionSide(label) {
  if (String(label || '').includes('偏多')) return 1;
  if (String(label || '').includes('偏空')) return -1;
  return 0;
}

function commonOutcome(direction, actualReturn) {
  const side = directionSide(direction);
  const actual = number(actualReturn);
  if (!Number.isFinite(actual)) return 'neutral';
  if (side > 0) return actual > 0 ? 'hit' : actual < 0 ? 'miss' : 'neutral';
  if (side < 0) return actual < 0 ? 'hit' : actual > 0 ? 'miss' : 'neutral';
  return Math.abs(actual) <= 0.3 ? 'hit' : 'miss';
}


function buildVolumeMap(v1Rows) {
  const map = new Map();
  for (const row of v1Rows || []) {
    const ratio20 = number(row.actual?.volume_ratio_20d_actual);
    const volume = number(row.actual?.volume);
    if (!row.verified || !Number.isFinite(ratio20)) continue;
    map.set(String(row.stock_code), {
      ratio20,
      volume,
      average20: Number.isFinite(volume) && ratio20 > 0 ? volume / ratio20 : null,
    });
  }
  return map;
}

function normalizeV1Rows(rows) {
  return (rows || []).map((row) => {
    const ratio20 = number(row.actual?.volume_ratio_20d_actual);
    if (!row.verified || !Number.isFinite(ratio20)) return null;
    const volume = number(row.actual?.volume);
    const direction = row.prediction?.final_direction_label || '';
    const actualReturn = number(row.actual?.close_return);
    const outcome = commonOutcome(direction, actualReturn);
    return {
      model: 'v1',
      stock_code: String(row.stock_code),
      stock_name: row.stock_name || '',
      industry: row.industry || 'unknown',
      direction,
      score: number(row.prediction?.direction_score),
      actual_return: actualReturn,
      prediction_result: outcome === 'hit' ? '準確' : outcome === 'miss' ? '不準' : '中性難判',
      outcome,
      volume_ratio_20d: ratio20,
      actual_volume: volume,
      average_volume_20d: Number.isFinite(volume) && ratio20 > 0 ? volume / ratio20 : null,
      report_file: row.report_file || null,
      reason_tags: row.reason_tags || [],
    };
  }).filter(Boolean);
}

function normalizeV2Rows(rows, volumeMap) {
  return (rows || []).map((row) => {
    const volume = volumeMap.get(String(row.stock_code));
    if (!volume || !Number.isFinite(volume.ratio20)) return null;
    const direction = row.final_direction_label || '';
    const actualReturn = number(row.actual_return);
    const outcome = commonOutcome(direction, actualReturn);
    return {
      model: 'v2',
      stock_code: String(row.stock_code),
      stock_name: row.stock_name || '',
      industry: row.industry || 'unknown',
      direction,
      score: number(row.score),
      actual_return: actualReturn,
      prediction_result: outcome === 'hit' ? '準確' : outcome === 'miss' ? '不準' : '中性難判',
      outcome,
      volume_ratio_20d: volume.ratio20,
      actual_volume: volume.volume,
      average_volume_20d: volume.average20,
      report_file: null,
      reason_tags: [],
    };
  }).filter(Boolean);
}

function accuracySummary(rows) {
  const hits = rows.filter((row) => row.outcome === 'hit');
  const misses = rows.filter((row) => row.outcome === 'miss');
  const classified = [...hits, ...misses];
  return {
    sample_count: rows.length,
    hit_count: hits.length,
    miss_count: misses.length,
    neutral_count: rows.length - classified.length,
    all_sample_hit_rate: round(rate(rows, (row) => row.outcome === 'hit')),
    classified_accuracy: round(rate(classified, (row) => row.outcome === 'hit')),
    average_actual_return: round(average(rows.map((row) => row.actual_return))),
  };
}

function compactList(rows) {
  return [...rows]
    .sort((left, right) => left.volume_ratio_20d - right.volume_ratio_20d
      || String(left.stock_code).localeCompare(String(right.stock_code), 'zh-Hant', { numeric: true }))
    .map((row) => ({
      ...row,
      volume_ratio_20d: round(row.volume_ratio_20d, 4),
      actual_volume: round(row.actual_volume),
      average_volume_20d: round(row.average_volume_20d),
      actual_return: round(row.actual_return),
    }));
}

function thresholdSimulation(rows, threshold) {
  const lowVolume = rows.filter((row) => row.volume_ratio_20d <= threshold);
  const retained = rows.filter((row) => row.volume_ratio_20d > threshold);
  const before = accuracySummary(rows);
  const after = accuracySummary(retained);
  return {
    threshold,
    low_volume_condition: `volume_ratio_20d <= ${threshold}`,
    removed_count: lowVolume.length,
    retained_count: retained.length,
    retained_coverage_rate: round(rows.length ? retained.length / rows.length * 100 : null),
    removed_hit_count: lowVolume.filter((row) => row.outcome === 'hit').length,
    removed_miss_count: lowVolume.filter((row) => row.outcome === 'miss').length,
    removed_neutral_count: lowVolume.filter((row) => row.outcome === 'neutral').length,
    net_removed_errors: lowVolume.filter((row) => row.outcome === 'miss').length
      - lowVolume.filter((row) => row.outcome === 'hit').length,
    before,
    after,
    all_sample_hit_rate_delta: Number.isFinite(before.all_sample_hit_rate) && Number.isFinite(after.all_sample_hit_rate)
      ? round(after.all_sample_hit_rate - before.all_sample_hit_rate)
      : null,
    classified_accuracy_delta: Number.isFinite(before.classified_accuracy) && Number.isFinite(after.classified_accuracy)
      ? round(after.classified_accuracy - before.classified_accuracy)
      : null,
  };
}

function industryImpact(rows, threshold) {
  const groups = new Map();
  for (const row of rows) {
    if (!groups.has(row.industry)) groups.set(row.industry, []);
    groups.get(row.industry).push(row);
  }
  return [...groups.entries()].map(([industry, members]) => {
    const simulation = thresholdSimulation(members, threshold);
    return {
      industry,
      sample_count: members.length,
      low_volume_count: simulation.removed_count,
      low_volume_rate: round(members.length ? simulation.removed_count / members.length * 100 : null),
      before_hit_rate: simulation.before.all_sample_hit_rate,
      after_hit_rate: simulation.after.all_sample_hit_rate,
      hit_rate_delta: simulation.all_sample_hit_rate_delta,
      removed_hit_count: simulation.removed_hit_count,
      removed_miss_count: simulation.removed_miss_count,
    };
  }).filter((item) => item.low_volume_count > 0)
    .sort((left, right) => right.low_volume_count - left.low_volume_count || right.sample_count - left.sample_count);
}

function summarizeModel(rows, threshold, sensitivityThresholds) {
  const lowVolume = rows.filter((row) => row.volume_ratio_20d <= threshold);
  const simulation = thresholdSimulation(rows, threshold);
  return {
    volume_covered_count: rows.length,
    selected_threshold: threshold,
    baseline: simulation.before,
    after_excluding_low_volume: simulation.after,
    impact: {
      removed_count: simulation.removed_count,
      retained_count: simulation.retained_count,
      retained_coverage_rate: simulation.retained_coverage_rate,
      removed_hit_count: simulation.removed_hit_count,
      removed_miss_count: simulation.removed_miss_count,
      removed_neutral_count: simulation.removed_neutral_count,
      net_removed_errors: simulation.net_removed_errors,
      all_sample_hit_rate_delta: simulation.all_sample_hit_rate_delta,
      classified_accuracy_delta: simulation.classified_accuracy_delta,
      interpretation: simulation.all_sample_hit_rate_delta > 0
        ? '排除低量後命中率上升，但目前只代表同日敏感度分析。'
        : simulation.all_sample_hit_rate_delta < 0
          ? '排除低量後命中率下降，低量不能直接當成排除條件。'
          : '排除低量後命中率沒有改變。',
    },
    low_volume_lists: {
      accurate: compactList(lowVolume.filter((row) => row.outcome === 'hit')),
      inaccurate: compactList(lowVolume.filter((row) => row.outcome === 'miss')),
      neutral: compactList(lowVolume.filter((row) => row.outcome === 'neutral')),
    },
    sensitivity: [...new Set([...sensitivityThresholds, threshold])]
      .sort((left, right) => left - right)
      .map((value) => thresholdSimulation(rows, value)),
    by_industry: industryImpact(rows, threshold),
  };
}

function formatPercent(value) {
  return Number.isFinite(value) ? `${value >= 0 ? '+' : ''}${value.toFixed(2)}%` : 'NA';
}

function modelMarkdown(label, model) {
  const impact = model.impact;
  return [
    `## ${label}`,
    '',
    `- 有20日量比資料：${model.volume_covered_count} 檔`,
    `- 原始命中率：${formatPercent(model.baseline.all_sample_hit_rate)}`,
    `- 排除低量後命中率：${formatPercent(model.after_excluding_low_volume.all_sample_hit_rate)}`,
    `- 命中率差：${formatPercent(impact.all_sample_hit_rate_delta)}`,
    `- 排除低量：${impact.removed_count} 檔；其中準確 ${impact.removed_hit_count}、不準 ${impact.removed_miss_count}、中性 ${impact.removed_neutral_count}`,
    `- 保留覆蓋率：${formatPercent(impact.retained_coverage_rate)}`,
    '',
    `結論：${impact.interpretation}`,
    '',
    '| 門檻 | 排除檔數 | 保留率 | 排除準確 | 排除不準 | 排除後命中率 | 差異 |',
    '|---:|---:|---:|---:|---:|---:|---:|',
    ...model.sensitivity.map((item) => `| ≤ ${item.threshold} | ${item.removed_count} | ${formatPercent(item.retained_coverage_rate)} | ${item.removed_hit_count} | ${item.removed_miss_count} | ${formatPercent(item.after.all_sample_hit_rate)} | ${formatPercent(item.all_sample_hit_rate_delta)} |`),
    '',
  ].join('\n');
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log(usage());
    return;
  }
  if (!Number.isFinite(args.lowVolumeThreshold) || args.lowVolumeThreshold < 0) {
    throw new Error(`Invalid --low-volume-threshold: ${args.lowVolumeThreshold}`);
  }

  const date = resolveDate(args.date);
  const v1File = path.join(V1_DIR, date, 'replay.json');
  const v2File = path.join(V2_DIR, date, 'replay-v2.json');
  const v1Replay = readJson(v1File, null);
  const v2Replay = readJson(v2File, null);
  if (!Array.isArray(v1Replay?.rows) || !v1Replay.rows.length) throw new Error(`V1 replay is empty: ${path.relative(ROOT, v1File)}`);
  if (!Array.isArray(v2Replay?.rows) || !v2Replay.rows.length) throw new Error(`V2 replay is empty: ${path.relative(ROOT, v2File)}`);

  const volumeMap = buildVolumeMap(v1Replay.rows);
  const normalizedV1Rows = normalizeV1Rows(v1Replay.rows);
  const normalizedV2Rows = normalizeV2Rows(v2Replay.rows, volumeMap);
  if (!normalizedV1Rows.length) throw new Error(`V1 replay has no rows with a valid 20-day volume ratio for ${date}`);
  if (!normalizedV2Rows.length) throw new Error(`V2 replay has no rows joinable to V1 20-day volume ratios for ${date}`);

  const v1Codes = new Set(normalizedV1Rows.map((row) => row.stock_code));
  const v2Codes = new Set(normalizedV2Rows.map((row) => row.stock_code));
  const commonCodes = new Set([...v1Codes].filter((code) => v2Codes.has(code)));
  if (!commonCodes.size) throw new Error(`V1 and V2 have no common volume-covered rows for ${date}`);

  const v2ByCode = new Map(normalizedV2Rows.map((row) => [row.stock_code, row]));
  const alignOutcome = (row) => {
    const commonActualReturn = v2ByCode.get(row.stock_code)?.actual_return;
    const outcome = commonOutcome(row.direction, commonActualReturn);
    return {
      ...row,
      actual_return: commonActualReturn,
      outcome,
      prediction_result: outcome === 'hit' ? '準確' : outcome === 'miss' ? '不準' : '中性難判',
    };
  };
  const v1Rows = normalizedV1Rows.filter((row) => commonCodes.has(row.stock_code)).map(alignOutcome);
  const v2Rows = normalizedV2Rows.filter((row) => commonCodes.has(row.stock_code)).map(alignOutcome);

  const generatedAt = new Date().toISOString();
  const payload = {
    analysis_version: ANALYSIS_VERSION,
    generated_at: generatedAt,
    prediction_date: isoDate(date),
    actual_trade_date: v1Replay.actual_trade_date || v2Replay.actual_trade_date || isoDate(date),
    definition: {
      factor_name: '20日成交量比',
      formula: '結果日成交量 / 結果日前20個交易日平均成交量',
      selected_low_volume_threshold: args.lowVolumeThreshold,
      low_volume_condition: `volume_ratio_20d <= ${args.lowVolumeThreshold}`,
      use_note: '低量只作覆盤敏感度分析，不會直接改寫原預測或正式覆盤資格。V1/V2 僅使用兩版皆有20日量比且可覆盤的共同股票。',
      sample_policy: 'V1/V2 使用相同的共同成交量樣本、相同結果日報酬與相同方向判分規則。',
      common_sample_count: commonCodes.size,
    },
    source_files: {
      v1_replay: path.relative(ROOT, v1File),
      v2_replay: path.relative(ROOT, v2File),
    },
    sample_universe: {
      normalized_v1_count: normalizedV1Rows.length,
      normalized_v2_count: normalizedV2Rows.length,
      common_sample_count: commonCodes.size,
      v1_only_count: [...v1Codes].filter((code) => !v2Codes.has(code)).length,
      v2_only_count: [...v2Codes].filter((code) => !v1Codes.has(code)).length,
    },
    models: {
      v1: summarizeModel(v1Rows, args.lowVolumeThreshold, args.sensitivityThresholds),
      v2: summarizeModel(v2Rows, args.lowVolumeThreshold, args.sensitivityThresholds),
    },
    limitations: [
      '成交量是結果日資料，本分析只用來檢查是否應把預測日前的量能條件加入未來模型；不可倒灌成原預測已知資訊。',
      'V1/V2 已固定使用共同樣本，但單一交易日的準確率差異仍可能受大盤與產業影響，不能直接視為因果。',
      '若要正式排除低量股票，應累積多個覆盤日並做樣本外驗證，同時觀察覆蓋率與犧牲的正確預測數。',
    ],
  };

  const outputDir = path.join(OUTPUT_ROOT, date);
  const jsonFile = path.join(outputDir, 'volume-filter-impact.json');
  const markdownFile = path.join(outputDir, 'volume-filter-impact.md');
  writeJsonAtomic(jsonFile, payload);
  writeTextAtomic(markdownFile, [
    `# 覆盤成交量排除測試：${date}`,
    '',
    `低量定義：結果日成交量 ÷ 前20個交易日平均成交量 ≤ ${args.lowVolumeThreshold}。`,
    '',
    '> 這是覆盤敏感度分析。結果日成交量不能倒灌成當時的預測條件；正式模型必須改用預測日前可取得的量能資料再驗證。',
    '',
    modelMarkdown('V1', payload.models.v1),
    modelMarkdown('V2', payload.models.v2),
    '## 研究限制',
    '',
    ...payload.limitations.map((item) => `- ${item}`),
    '',
  ].join('\n'));

  const manifestFile = path.join(OUTPUT_ROOT, 'manifest.json');
  const manifest = readJson(manifestFile, {});
  const dates = [...new Set([
    ...(manifest.available_volume_filter_dates || []),
    date,
  ].map(compactDate).filter((value) => /^20\d{6}$/.test(value)))].sort().reverse();
  writeJsonAtomic(manifestFile, {
    ...manifest,
    latest_volume_filter_date: date,
    available_volume_filter_dates: dates,
    latest_volume_filter_analysis: path.relative(ROOT, jsonFile),
    volume_filter_generated_at: generatedAt,
  });

  console.log(JSON.stringify({
    date,
    threshold: args.lowVolumeThreshold,
    v1: payload.models.v1.impact,
    v2: payload.models.v2.impact,
    outputs: [path.relative(ROOT, jsonFile), path.relative(ROOT, markdownFile), path.relative(ROOT, manifestFile)],
  }, null, 2));
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error(error.stack || error.message);
    process.exit(1);
  }
}

module.exports = {
  accuracySummary,
  commonOutcome,
  normalizeV1Rows,
  normalizeV2Rows,
  summarizeModel,
  thresholdSimulation,
  v1Outcome,
  v2Outcome,
};
