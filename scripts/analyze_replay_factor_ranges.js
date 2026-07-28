#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const PREDICTION_ROOT = path.join(ROOT, 'data_predictions');
const OUTPUT_ROOT = path.join(ROOT, 'data_prediction_analysis');
const FACTORS = [
  { key: 'r1', label: 'r1', read: row => row.features?.r1 },
  { key: 'r3', label: 'r3', read: row => row.features?.r3 },
  { key: 'relative7d', label: '7日RS', read: row => row.relative_strength_7d?.relative_strength_7d },
];
const MIN_INDUSTRY_SAMPLE = 12;
const BIN_COUNT = 4;

function readJson(file, fallback = null) {
  try {
    const text = fs.readFileSync(file, 'utf8').trim();
    return text ? JSON.parse(text) : fallback;
  } catch {
    return fallback;
  }
}

function writeJson(file, payload) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
}

function writeText(file, content) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content, 'utf8');
}

function compact(value) {
  return String(value || '').replaceAll('-', '').replaceAll('/', '');
}

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === '--date') args.date = compact(argv[++index]);
  }
  return args;
}

function finite(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function round(value, digits = 4) {
  return Number.isFinite(value) ? Number(value.toFixed(digits)) : null;
}

function average(values) {
  const valid = values.filter(Number.isFinite);
  return valid.length ? valid.reduce((sum, value) => sum + value, 0) / valid.length : null;
}

function median(values) {
  const valid = values.filter(Number.isFinite).sort((a, b) => a - b);
  if (!valid.length) return null;
  const middle = Math.floor(valid.length / 2);
  return valid.length % 2 ? valid[middle] : (valid[middle - 1] + valid[middle]) / 2;
}

function ratio(rows, predicate) {
  return rows.length ? rows.filter(predicate).length / rows.length * 100 : null;
}

function rank(values) {
  const sorted = values.map((value, index) => ({ value, index })).sort((a, b) => a.value - b.value);
  const output = Array(values.length);
  for (let start = 0; start < sorted.length;) {
    let end = start + 1;
    while (end < sorted.length && sorted[end].value === sorted[start].value) end += 1;
    const averageRank = (start + end - 1) / 2 + 1;
    for (let index = start; index < end; index += 1) output[sorted[index].index] = averageRank;
    start = end;
  }
  return output;
}

function pearson(left, right) {
  if (left.length !== right.length || left.length < 3) return null;
  const leftMean = average(left);
  const rightMean = average(right);
  let numerator = 0;
  let leftSquares = 0;
  let rightSquares = 0;
  for (let index = 0; index < left.length; index += 1) {
    const leftDelta = left[index] - leftMean;
    const rightDelta = right[index] - rightMean;
    numerator += leftDelta * rightDelta;
    leftSquares += leftDelta * leftDelta;
    rightSquares += rightDelta * rightDelta;
  }
  return leftSquares && rightSquares ? numerator / Math.sqrt(leftSquares * rightSquares) : null;
}

function spearman(left, right) {
  return pearson(rank(left), rank(right));
}

function formatRange(minimum, maximum) {
  const min = round(minimum, 2);
  const max = round(maximum, 2);
  if (!Number.isFinite(min) || !Number.isFinite(max)) return 'NA';
  if (min === max) return `${min}`;
  return `${min} ～ ${max}`;
}

function quantileBins(rows, factorKey) {
  const sorted = [...rows].sort((left, right) => left[factorKey] - right[factorKey] || left.stock_code.localeCompare(right.stock_code));
  const binCount = Math.min(BIN_COUNT, Math.max(1, Math.floor(sorted.length / 3)));
  const bins = [];
  for (let index = 0; index < binCount; index += 1) {
    const start = Math.floor(index * sorted.length / binCount);
    const end = Math.floor((index + 1) * sorted.length / binCount);
    const members = sorted.slice(start, end);
    if (!members.length) continue;
    const values = members.map(row => row[factorKey]);
    const returns = members.map(row => row.actual_return);
    bins.push({
      bin: index + 1,
      count: members.length,
      minimum: round(Math.min(...values), 2),
      maximum: round(Math.max(...values), 2),
      range: formatRange(Math.min(...values), Math.max(...values)),
      average_factor: round(average(values), 2),
      average_actual_return: round(average(returns), 3),
      median_actual_return: round(median(returns), 3),
      positive_rate: round(ratio(members, row => row.actual_return > 0), 2),
      non_negative_rate: round(ratio(members, row => row.actual_return >= 0), 2),
      stock_codes: members.map(row => row.stock_code),
    });
  }
  return bins;
}

function associationLabel(correlation, lowToHighSpread) {
  if (!Number.isFinite(correlation) || !Number.isFinite(lowToHighSpread)) return '資料不足';
  if (correlation >= 0.2 && lowToHighSpread > 0) return '正向連動';
  if (correlation <= -0.2 && lowToHighSpread < 0) return '反向連動';
  if (Math.abs(correlation) < 0.1 && Math.abs(lowToHighSpread) < 0.5) return '連動偏弱';
  return '非單調／尚不一致';
}

function evidenceLevel(sampleCount, correlation, bestWorstSpread) {
  if (sampleCount >= 30 && (Math.abs(correlation || 0) >= 0.3 || Math.abs(bestWorstSpread || 0) >= 1.5)) return '較高';
  if (sampleCount >= 20 && (Math.abs(correlation || 0) >= 0.2 || Math.abs(bestWorstSpread || 0) >= 1)) return '中等';
  if (sampleCount >= MIN_INDUSTRY_SAMPLE) return '初步';
  return '資料不足';
}

function analyzeFactor(rows, factor) {
  const valid = rows
    .map(row => ({ ...row, factor_value: finite(factor.read(row.prediction)) }))
    .filter(row => Number.isFinite(row.factor_value) && Number.isFinite(row.actual_return));
  const factorValues = valid.map(row => row.factor_value);
  const returns = valid.map(row => row.actual_return);
  const normalized = valid.map(row => ({ ...row, [factor.key]: row.factor_value }));
  const bins = quantileBins(normalized, factor.key);
  const best = [...bins].sort((left, right) => right.average_actual_return - left.average_actual_return || right.positive_rate - left.positive_rate)[0] || null;
  const worst = [...bins].sort((left, right) => left.average_actual_return - right.average_actual_return || left.positive_rate - right.positive_rate)[0] || null;
  const first = bins[0] || null;
  const last = bins[bins.length - 1] || null;
  const rankCorrelation = spearman(factorValues, returns);
  const linearCorrelation = pearson(factorValues, returns);
  const lowToHighSpread = first && last ? last.average_actual_return - first.average_actual_return : null;
  const bestWorstSpread = best && worst ? best.average_actual_return - worst.average_actual_return : null;
  return {
    factor: factor.key,
    label: factor.label,
    sample_count: valid.length,
    pearson: round(linearCorrelation, 4),
    spearman: round(rankCorrelation, 4),
    low_to_high_average_return_spread: round(lowToHighSpread, 3),
    best_to_worst_average_return_spread: round(bestWorstSpread, 3),
    association: associationLabel(rankCorrelation, lowToHighSpread),
    evidence_level: evidenceLevel(valid.length, rankCorrelation, bestWorstSpread),
    best_range: best ? {
      range: best.range,
      minimum: best.minimum,
      maximum: best.maximum,
      count: best.count,
      average_actual_return: best.average_actual_return,
      median_actual_return: best.median_actual_return,
      positive_rate: best.positive_rate,
    } : null,
    worst_range: worst ? {
      range: worst.range,
      minimum: worst.minimum,
      maximum: worst.maximum,
      count: worst.count,
      average_actual_return: worst.average_actual_return,
      median_actual_return: worst.median_actual_return,
      positive_rate: worst.positive_rate,
    } : null,
    bins,
  };
}

function industrySummary(industry, rows) {
  const returns = rows.map(row => row.actual_return).filter(Number.isFinite);
  return {
    industry,
    sample_count: rows.length,
    average_actual_return: round(average(returns), 3),
    median_actual_return: round(median(returns), 3),
    positive_rate: round(ratio(rows, row => row.actual_return > 0), 2),
    factors: Object.fromEntries(FACTORS.map(factor => [factor.key, analyzeFactor(rows, factor)])),
  };
}

function evidenceScore(item) {
  const factor = item.factor;
  const sampleWeight = Math.min(1, factor.sample_count / 30);
  return sampleWeight * (Math.abs(factor.spearman || 0) * 4 + Math.abs(factor.best_to_worst_average_return_spread || 0));
}

function markdownReport(payload) {
  const lines = [
    `# 產業別 r1／r3／7日RS 與實際漲跌分析：${payload.date}`,
    '',
    `- 預測日：${payload.prediction_date}`,
    `- 實際交易日：${payload.actual_trade_date}`,
    `- 有效股票：${payload.verified_count}`,
    `- 產業數：${payload.industry_count}`,
    `- 可做初步分層的產業：${payload.eligible_industry_count}（每產業至少 ${MIN_INDUSTRY_SAMPLE} 檔）`,
    '',
    '> 重要：目前只有單一交易日的橫斷面資料。以下區間只能作為探索性參考，不能直接當成固定交易門檻；至少要累積多個不同市場日後再驗證。',
    '',
    '## 全市場關聯',
    '',
    '| 因子 | 樣本 | Spearman | Pearson | 最佳區間 | 最佳區間平均漲跌 | 上漲率 | 判讀 |',
    '|---|---:|---:|---:|---|---:|---:|---|',
  ];
  for (const factor of Object.values(payload.overall.factors)) {
    lines.push(`| ${factor.label} | ${factor.sample_count} | ${factor.spearman ?? 'NA'} | ${factor.pearson ?? 'NA'} | ${factor.best_range?.range ?? 'NA'} | ${factor.best_range?.average_actual_return ?? 'NA'}% | ${factor.best_range?.positive_rate ?? 'NA'}% | ${factor.association} |`);
  }

  lines.push('', '## 較值得持續觀察的產業區間', '');
  lines.push('| 產業 | 樣本 | 因子 | 關聯 | Spearman | 最佳區間 | 區間平均漲跌 | 區間上漲率 | 最佳－最差差距 | 證據 |');
  lines.push('|---|---:|---|---|---:|---|---:|---:|---:|---|');
  for (const item of payload.highlights) {
    const factor = item.factor;
    lines.push(`| ${item.industry} | ${item.industry_sample_count} | ${factor.label} | ${factor.association} | ${factor.spearman ?? 'NA'} | ${factor.best_range?.range ?? 'NA'} | ${factor.best_range?.average_actual_return ?? 'NA'}% | ${factor.best_range?.positive_rate ?? 'NA'}% | ${factor.best_to_worst_average_return_spread ?? 'NA'}pp | ${factor.evidence_level} |`);
  }

  lines.push('', '## 各產業完整摘要', '');
  lines.push('| 產業 | 樣本 | 平均實際漲跌 | 上漲率 | r1 最佳區間 | r1 Spearman | r3 最佳區間 | r3 Spearman | 7日RS 最佳區間 | 7日RS Spearman |');
  lines.push('|---|---:|---:|---:|---|---:|---|---:|---|---:|');
  for (const industry of payload.industries.filter(row => row.sample_count >= MIN_INDUSTRY_SAMPLE)) {
    lines.push(`| ${industry.industry} | ${industry.sample_count} | ${industry.average_actual_return ?? 'NA'}% | ${industry.positive_rate ?? 'NA'}% | ${industry.factors.r1.best_range?.range ?? 'NA'} | ${industry.factors.r1.spearman ?? 'NA'} | ${industry.factors.r3.best_range?.range ?? 'NA'} | ${industry.factors.r3.spearman ?? 'NA'} | ${industry.factors.relative7d.best_range?.range ?? 'NA'} | ${industry.factors.relative7d.spearman ?? 'NA'} |`);
  }

  lines.push('', '## 判讀原則', '');
  lines.push('- 區間採各產業內部分位數切成最多四組，因此不同產業的數字範圍本來就可能不同。');
  lines.push('- `Spearman` 觀察因子愈高時，實際漲跌是否傾向單調增加或減少。');
  lines.push('- `最佳－最差差距` 是表現最好區間與最差區間的平均實際報酬差，單位是百分點。');
  lines.push('- 樣本少於 12 檔的產業只保留在 JSON，不列入可操作區間摘要。');
  lines.push('- 單日結果容易受到市場共同漲跌、產業事件和極端值影響，後續應以跨日穩定性為主要判斷。');
  lines.push('', '完整分組與股票代號請見 `industry-factor-ranges.json`。', '');
  return lines.join('\n');
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const rootManifest = readJson(path.join(PREDICTION_ROOT, 'manifest.json'), {});
  const candidates = [
    args.date,
    ...(rootManifest.available_dates || []),
    rootManifest.latest_date,
  ].map(compact).filter(date => /^20\d{6}$/.test(date)).sort().reverse();
  const date = candidates.find(candidate =>
    fs.existsSync(path.join(PREDICTION_ROOT, candidate, 'summary.json'))
    && fs.existsSync(path.join(PREDICTION_ROOT, candidate, 'replay-dashboard.json'))
  );
  if (!date) throw new Error('No prediction date with summary.json and replay-dashboard.json was found');

  const summary = readJson(path.join(PREDICTION_ROOT, date, 'summary.json'), null);
  const replay = readJson(path.join(PREDICTION_ROOT, date, 'replay-dashboard.json'), null);
  if (!summary?.stocks || !replay?.rows) throw new Error(`Invalid prediction or replay data for ${date}`);

  const predictionByCode = new Map(summary.stocks.map(row => [String(row.stock_code), row]));
  const rows = replay.rows
    .filter(row => row.verified && Number.isFinite(finite(row.actual?.close_return)))
    .map(row => ({
      stock_code: String(row.stock_code),
      stock_name: row.stock_name,
      industry: row.industry || predictionByCode.get(String(row.stock_code))?.industry || 'unknown',
      actual_return: finite(row.actual?.close_return),
      prediction: predictionByCode.get(String(row.stock_code)),
    }))
    .filter(row => row.prediction);

  const groups = new Map();
  for (const row of rows) {
    if (!groups.has(row.industry)) groups.set(row.industry, []);
    groups.get(row.industry).push(row);
  }

  const industries = [...groups.entries()]
    .map(([industry, members]) => industrySummary(industry, members))
    .sort((left, right) => right.sample_count - left.sample_count || left.industry.localeCompare(right.industry, 'zh-Hant'));
  const overall = industrySummary('全市場', rows);
  const highlights = industries
    .filter(industry => industry.sample_count >= MIN_INDUSTRY_SAMPLE)
    .flatMap(industry => Object.values(industry.factors).map(factor => ({
      industry: industry.industry,
      industry_sample_count: industry.sample_count,
      industry_average_actual_return: industry.average_actual_return,
      factor,
    })))
    .filter(item => item.factor.evidence_level === '中等' || item.factor.evidence_level === '較高')
    .sort((left, right) => evidenceScore(right) - evidenceScore(left))
    .slice(0, 40);

  const payload = {
    schema_version: '1.0.0',
    generated_at: new Date().toISOString(),
    date,
    prediction_date: summary.forecast_date,
    actual_trade_date: replay.actual_trade_date,
    verified_count: rows.length,
    industry_count: industries.length,
    eligible_industry_count: industries.filter(row => row.sample_count >= MIN_INDUSTRY_SAMPLE).length,
    methodology: {
      factors: FACTORS.map(item => ({ key: item.key, label: item.label })),
      actual_outcome: 'replay-dashboard.rows[].actual.close_return',
      industry_minimum_sample: MIN_INDUSTRY_SAMPLE,
      maximum_quantile_bins: BIN_COUNT,
      note: 'Single-day cross-sectional exploratory analysis; ranges are not validated trading thresholds.',
    },
    overall,
    highlights,
    industries,
  };

  const outputDir = path.join(OUTPUT_ROOT, date);
  writeJson(path.join(outputDir, 'industry-factor-ranges.json'), payload);
  writeText(path.join(outputDir, 'industry-factor-ranges.md'), `${markdownReport(payload)}\n`);
  writeJson(path.join(OUTPUT_ROOT, 'manifest.json'), {
    latest_date: date,
    latest_json: `data_prediction_analysis/${date}/industry-factor-ranges.json`,
    latest_markdown: `data_prediction_analysis/${date}/industry-factor-ranges.md`,
    generated_at: payload.generated_at,
  });
  console.log(JSON.stringify({
    date,
    verified_count: rows.length,
    industries: industries.length,
    eligible_industries: payload.eligible_industry_count,
    highlights: highlights.length,
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

module.exports = { analyzeFactor, pearson, quantileBins, spearman };
