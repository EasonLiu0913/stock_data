#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const FUBON_DIR = path.join(ROOT, 'data_fubon');
const FILE_INDEX = path.join(FUBON_DIR, 'files.json');
const INDUSTRY_FILE = path.join(ROOT, 'data_twse', 'twse_industry_Stock.json');
const OUTPUT_ROOT = path.join(ROOT, 'data_volume_analysis');
const SAMPLE_SIZE = 200;
const HISTORY_FILES = 100;
const MIN_HISTORY = 35;
const MIN_MOVE = 0.5;
const PRICE_BANDS = [
  { key: 'lt20', label: '< 20 元', min: 0, max: 20, target: 34 },
  { key: '20_50', label: '20–50 元', min: 20, max: 50, target: 34 },
  { key: '50_100', label: '50–100 元', min: 50, max: 100, target: 34 },
  { key: '100_200', label: '100–200 元', min: 100, max: 200, target: 34 },
  { key: '200_500', label: '200–500 元', min: 200, max: 500, target: 34 },
  { key: 'gte500', label: '≥ 500 元', min: 500, max: Infinity, target: 30 },
];
const RVOL_BUCKETS = [
  { label: '<0.60', min: -Infinity, max: 0.60 },
  { label: '0.60–0.90', min: 0.60, max: 0.90 },
  { label: '0.90–1.20', min: 0.90, max: 1.20 },
  { label: '1.20–1.50', min: 1.20, max: 1.50 },
  { label: '1.50–2.00', min: 1.50, max: 2.00 },
  { label: '2.00–3.00', min: 2.00, max: 3.00 },
  { label: '≥3.00', min: 3.00, max: Infinity },
];
const THRESHOLDS = [0.7, 0.8, 0.9, 1.0, 1.2, 1.3, 1.5, 1.8, 2.0, 2.5, 3.0];

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

function writeText(file, text) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${text.trim()}\n`, 'utf8');
}

function num(value) {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(String(value).replaceAll(',', '').trim());
  return Number.isFinite(parsed) ? parsed : null;
}

function round(value, digits = 3) {
  return Number.isFinite(value) ? Number(value.toFixed(digits)) : null;
}

function pct(current, previous) {
  return Number.isFinite(current) && Number.isFinite(previous) && previous !== 0
    ? (current / previous - 1) * 100
    : null;
}

function compact(value) {
  return String(value || '').replaceAll('-', '').replaceAll('/', '');
}

function parseArgs(argv) {
  const output = {};
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === '--date') output.date = compact(argv[++index]);
    if (argv[index] === '--sample-size') output.sampleSize = Number(argv[++index]);
  }
  return output;
}

function average(values) {
  const valid = values.filter(Number.isFinite);
  return valid.length ? valid.reduce((sum, value) => sum + value, 0) / valid.length : null;
}

function quantile(values, q) {
  const valid = values.filter(Number.isFinite).sort((a, b) => a - b);
  if (!valid.length) return null;
  if (valid.length === 1) return valid[0];
  const position = (valid.length - 1) * q;
  const lower = Math.floor(position);
  const upper = Math.ceil(position);
  if (lower === upper) return valid[lower];
  return valid[lower] + (valid[upper] - valid[lower]) * (position - lower);
}

function median(values) {
  return quantile(values, 0.5);
}

function ratio(rows, predicate) {
  return rows.length ? rows.filter(predicate).length / rows.length * 100 : null;
}

function dateFromFile(file) {
  return file.match(/fubon_(20\d{6})_sma\.json$/)?.[1] || null;
}

function isoDate(date) {
  return `${date.slice(0, 4)}-${date.slice(4, 6)}-${date.slice(6, 8)}`;
}

function priceBand(price) {
  return PRICE_BANDS.find((band) => price >= band.min && price < band.max) || null;
}

function parseDailyFile(file, expectedDate) {
  const payload = readJson(file, {});
  const expectedIso = isoDate(expectedDate);
  const output = [];
  for (const [code, stock] of Object.entries(payload || {})) {
    const dateKey = Object.keys(stock || {}).find((key) => compact(key) === expectedDate);
    if (!dateKey) continue;
    const row = stock[dateKey] || {};
    const close = num(row.Price ?? row.Close);
    const open = num(row.Open);
    const high = num(row.High);
    const low = num(row.Low);
    const volume = num(row.Volume);
    if (![close, open, high, low, volume].every(Number.isFinite) || close <= 0 || volume < 0) continue;
    output.push({
      code: String(code),
      name: stock.StockName || '',
      date: expectedIso,
      close,
      open,
      high,
      low,
      volume,
      turnover_ntd: close * volume * 1000,
    });
  }
  return output;
}

function loadHistory(date) {
  const files = (readJson(FILE_INDEX, []) || [])
    .filter((file) => /^fubon_20\d{6}_sma\.json$/.test(file))
    .map((file) => ({ file, date: dateFromFile(file) }))
    .filter((item) => item.date && (!date || item.date <= date))
    .sort((left, right) => left.date.localeCompare(right.date))
    .slice(-HISTORY_FILES);
  if (!files.length) throw new Error('No SMA files were found');
  const resolvedDate = date || files.at(-1).date;
  const history = new Map();
  for (const item of files) {
    for (const row of parseDailyFile(path.join(FUBON_DIR, item.file), item.date)) {
      if (!history.has(row.code)) history.set(row.code, []);
      history.get(row.code).push(row);
    }
  }
  for (const rows of history.values()) rows.sort((left, right) => left.date.localeCompare(right.date));
  return { history, files, date: resolvedDate };
}

function evenlySpaced(items, count) {
  if (count >= items.length) return [...items];
  if (count <= 0) return [];
  const selected = [];
  const used = new Set();
  for (let index = 0; index < count; index += 1) {
    let position = count === 1 ? Math.floor(items.length / 2) : Math.round(index * (items.length - 1) / (count - 1));
    while (used.has(position) && position + 1 < items.length) position += 1;
    while (used.has(position) && position - 1 >= 0) position -= 1;
    if (!used.has(position)) {
      used.add(position);
      selected.push(items[position]);
    }
  }
  return selected;
}

function latestCandidate(code, rows, industries, date) {
  const latest = rows.at(-1);
  if (!latest || compact(latest.date) !== date || rows.length < MIN_HISTORY) return null;
  const recent20 = rows.slice(-20);
  const medianTurnover20 = median(recent20.map((row) => row.turnover_ntd));
  const medianVolume20 = median(recent20.map((row) => row.volume));
  const band = priceBand(latest.close);
  if (!band || !Number.isFinite(medianTurnover20) || !Number.isFinite(medianVolume20)) return null;
  return {
    code,
    name: industries[code]?.Name || latest.name || '',
    industry: industries[code]?.Industry || '其他',
    band: band.key,
    band_label: band.label,
    latest_price: latest.close,
    latest_volume: latest.volume,
    median_volume_20: medianVolume20,
    median_turnover_20: medianTurnover20,
    history_count: rows.length,
  };
}

function chooseSample(candidates, sampleSize) {
  const byBand = new Map(PRICE_BANDS.map((band) => [band.key, []]));
  for (const item of candidates) byBand.get(item.band)?.push(item);
  for (const items of byBand.values()) {
    items.sort((left, right) => left.median_turnover_20 - right.median_turnover_20 || left.code.localeCompare(right.code));
  }
  const selected = [];
  const selectedCodes = new Set();
  for (const band of PRICE_BANDS) {
    const available = byBand.get(band.key) || [];
    const target = Math.min(band.target, available.length, sampleSize - selected.length);
    for (const item of evenlySpaced(available, target)) {
      selected.push(item);
      selectedCodes.add(item.code);
    }
  }
  if (selected.length < sampleSize) {
    const remaining = candidates
      .filter((item) => !selectedCodes.has(item.code))
      .sort((left, right) => left.median_turnover_20 - right.median_turnover_20 || left.code.localeCompare(right.code));
    for (const item of evenlySpaced(remaining, Math.min(sampleSize - selected.length, remaining.length))) {
      selected.push(item);
      selectedCodes.add(item.code);
    }
  }
  return selected.slice(0, sampleSize).sort((left, right) => {
    const bandOrder = PRICE_BANDS.findIndex((band) => band.key === left.band) - PRICE_BANDS.findIndex((band) => band.key === right.band);
    return bandOrder || left.latest_price - right.latest_price || left.code.localeCompare(right.code);
  });
}

function percentileRank(value, reference) {
  const valid = reference.filter(Number.isFinite);
  if (!valid.length || !Number.isFinite(value)) return null;
  const below = valid.filter((item) => item < value).length;
  const equal = valid.filter((item) => item === value).length;
  return (below + equal * 0.5) / valid.length * 100;
}

function buildObservations(sample, history) {
  const observations = [];
  for (const stock of sample) {
    const rows = history.get(stock.code) || [];
    for (let index = 20; index < rows.length - 1; index += 1) {
      const current = rows[index];
      const previous = rows[index - 1];
      const next = rows[index + 1];
      const prior5 = rows.slice(index - 5, index);
      const prior20 = rows.slice(index - 20, index);
      const prior60 = rows.slice(Math.max(0, index - 60), index);
      const avgVolume5 = average(prior5.map((row) => row.volume));
      const avgVolume20 = average(prior20.map((row) => row.volume));
      const medianVolume20 = median(prior20.map((row) => row.volume));
      const avgTurnover20 = average(prior20.map((row) => row.turnover_ntd));
      const r1 = pct(current.close, previous.close);
      const nextReturn = pct(next.close, current.close);
      if (![r1, nextReturn, avgVolume5, avgVolume20, medianVolume20, avgTurnover20].every(Number.isFinite)) continue;
      observations.push({
        code: stock.code,
        name: stock.name,
        industry: stock.industry,
        band: stock.band,
        band_label: stock.band_label,
        date: current.date,
        price: current.close,
        volume: current.volume,
        turnover_ntd: current.turnover_ntd,
        r1,
        next_return: nextReturn,
        rvol1: previous.volume > 0 ? current.volume / previous.volume : null,
        rvol5: avgVolume5 > 0 ? current.volume / avgVolume5 : null,
        rvol20: avgVolume20 > 0 ? current.volume / avgVolume20 : null,
        median_volume_ratio20: medianVolume20 > 0 ? current.volume / medianVolume20 : null,
        turnover_ratio20: avgTurnover20 > 0 ? current.turnover_ntd / avgTurnover20 : null,
        volume_percentile60: percentileRank(current.volume, prior60.map((row) => row.volume)),
        direction: r1 >= MIN_MOVE ? 'up' : r1 <= -MIN_MOVE ? 'down' : 'flat',
      });
    }
  }
  return observations.filter((row) => [row.rvol5, row.rvol20, row.median_volume_ratio20, row.turnover_ratio20, row.volume_percentile60].every(Number.isFinite));
}

function continuationStats(rows, direction) {
  const relevant = rows.filter((row) => row.direction === direction);
  const continuation = direction === 'up' ? (row) => row.next_return > 0 : (row) => row.next_return < 0;
  const reversal = direction === 'up' ? (row) => row.next_return < 0 : (row) => row.next_return > 0;
  return {
    count: relevant.length,
    current_move_average: round(average(relevant.map((row) => row.r1))),
    next_return_average: round(average(relevant.map((row) => row.next_return))),
    next_return_median: round(median(relevant.map((row) => row.next_return))),
    continuation_rate: round(ratio(relevant, continuation), 2),
    reversal_rate: round(ratio(relevant, reversal), 2),
  };
}

function bucketAnalysis(rows, metric, buckets = RVOL_BUCKETS) {
  return buckets.map((bucket) => {
    const members = rows.filter((row) => row[metric] >= bucket.min && row[metric] < bucket.max);
    return {
      bucket: bucket.label,
      minimum: Number.isFinite(bucket.min) ? bucket.min : null,
      maximum: Number.isFinite(bucket.max) ? bucket.max : null,
      count: members.length,
      all: {
        average_next_return: round(average(members.map((row) => row.next_return))),
        median_next_return: round(median(members.map((row) => row.next_return))),
      },
      up: continuationStats(members, 'up'),
      down: continuationStats(members, 'down'),
    };
  });
}

function thresholdComparison(rows, metric, direction, threshold) {
  const directional = rows.filter((row) => row.direction === direction);
  const high = directional.filter((row) => row[metric] >= threshold);
  const low = directional.filter((row) => row[metric] < threshold);
  if (high.length < 30 || low.length < 30) return null;
  const highStats = continuationStats(high, direction);
  const lowStats = continuationStats(low, direction);
  return {
    threshold,
    high_count: high.length,
    low_count: low.length,
    high_continuation_rate: highStats.continuation_rate,
    low_continuation_rate: lowStats.continuation_rate,
    continuation_uplift_pp: round(highStats.continuation_rate - lowStats.continuation_rate, 2),
    high_next_return_average: highStats.next_return_average,
    low_next_return_average: lowStats.next_return_average,
    average_return_spread_pp: round(highStats.next_return_average - lowStats.next_return_average),
  };
}

function bestThresholds(rows, metric) {
  const output = {};
  for (const direction of ['up', 'down']) {
    output[direction] = THRESHOLDS
      .map((threshold) => thresholdComparison(rows, metric, direction, threshold))
      .filter(Boolean)
      .sort((left, right) => Math.abs(right.continuation_uplift_pp) - Math.abs(left.continuation_uplift_pp))[0] || null;
  }
  return output;
}

function liquiditySummary(rows) {
  const latestByCode = new Map();
  for (const row of rows) latestByCode.set(row.code, row);
  const latest = [...latestByCode.values()];
  const volumes = latest.map((row) => row.volume);
  const turnovers = latest.map((row) => row.turnover_ntd);
  return {
    stock_count: latest.length,
    observation_count: rows.length,
    price_median: round(median(latest.map((row) => row.price)), 2),
    volume_median_lots: round(median(volumes), 0),
    volume_p75_lots: round(quantile(volumes, 0.75), 0),
    volume_p85_lots: round(quantile(volumes, 0.85), 0),
    volume_p90_lots: round(quantile(volumes, 0.90), 0),
    turnover_median_ntd: round(median(turnovers), 0),
    turnover_p75_ntd: round(quantile(turnovers, 0.75), 0),
    turnover_p85_ntd: round(quantile(turnovers, 0.85), 0),
    turnover_p90_ntd: round(quantile(turnovers, 0.90), 0),
  };
}

function ruleStats(rows, predicate, direction) {
  return continuationStats(rows.filter(predicate), direction);
}

function evaluateRules(rows) {
  const rules = [
    { key: 'rvol20_1_2', label: '20日均量比 ≥ 1.2', test: (row) => row.rvol20 >= 1.2 },
    { key: 'rvol20_1_5', label: '20日均量比 ≥ 1.5', test: (row) => row.rvol20 >= 1.5 },
    { key: 'rvol20_2_0', label: '20日均量比 ≥ 2.0', test: (row) => row.rvol20 >= 2.0 },
    { key: 'percentile80', label: '近60日量能百分位 ≥ 80', test: (row) => row.volume_percentile60 >= 80 },
    { key: 'percentile90', label: '近60日量能百分位 ≥ 90', test: (row) => row.volume_percentile60 >= 90 },
    { key: 'turnover_ratio_1_5', label: '成交金額20日比 ≥ 1.5', test: (row) => row.turnover_ratio20 >= 1.5 },
    { key: 'combined_confirm', label: '均量比≥1.5 且量能百分位≥80', test: (row) => row.rvol20 >= 1.5 && row.volume_percentile60 >= 80 },
    { key: 'low_volume', label: '20日均量比 ≤ 0.75', test: (row) => row.rvol20 <= 0.75 },
  ];
  return rules.map((rule) => ({
    key: rule.key,
    label: rule.label,
    matched_observations: rows.filter(rule.test).length,
    up: ruleStats(rows, rule.test, 'up'),
    down: ruleStats(rows, rule.test, 'down'),
  }));
}

function analyzeScope(label, rows) {
  return {
    label,
    liquidity: liquiditySummary(rows),
    rvol20_buckets: bucketAnalysis(rows, 'rvol20'),
    median_volume_ratio20_buckets: bucketAnalysis(rows, 'median_volume_ratio20'),
    turnover_ratio20_buckets: bucketAnalysis(rows, 'turnover_ratio20'),
    best_thresholds: {
      rvol20: bestThresholds(rows, 'rvol20'),
      median_volume_ratio20: bestThresholds(rows, 'median_volume_ratio20'),
      turnover_ratio20: bestThresholds(rows, 'turnover_ratio20'),
    },
    rule_evaluation: evaluateRules(rows),
  };
}

function formatMoney(value) {
  if (!Number.isFinite(value)) return 'NA';
  if (value >= 1e9) return `${round(value / 1e9, 2)} 億元`;
  if (value >= 1e6) return `${round(value / 1e6, 1)} 百萬元`;
  if (value >= 1e3) return `${round(value / 1e3, 1)} 千元`;
  return `${round(value, 0)} 元`;
}

function markdown(payload) {
  const lines = [
    `# 成交量確認與反轉風險分析：${payload.date}`,
    '',
    `- 代表股票：${payload.sample.stock_count} 檔`,
    `- 日觀察值：${payload.observation_count.toLocaleString()} 筆`,
    `- 歷史區間：${payload.history.start_date} ～ ${payload.history.end_date}`,
    `- 價格分層：${PRICE_BANDS.map((band) => band.label).join('、')}`,
    '',
    '> 研究問題：上漲或下跌時，成交量相對自身歷史放大，是否提高隔日延續率；量縮是否提高隔日反轉可能。成交量原始張數只作流動性描述，不直接作跨股票訊號。',
    '',
    '## 200 檔代表股如何選',
    '',
    '- 先依最新收盤價切成六個價格帶。',
    '- 每個價格帶按近20日中位成交金額由低到高排序，再等距抽樣，涵蓋低、中、高流動性股票。',
    '- 若某價格帶不足目標檔數，再由其他價格帶未入選股票補足。',
    '- 每檔至少需要 35 個交易日資料。',
    '',
    '## 不同價格帶的原始成交量與成交金額',
    '',
    '| 價格帶 | 股票數 | 觀察值 | 最新價中位數 | 成交量中位數 | 成交量P85 | 成交量P90 | 成交金額中位數 | 成交金額P85 |',
    '|---|---:|---:|---:|---:|---:|---:|---:|---:|',
  ];
  for (const band of payload.price_bands) {
    const item = payload.scopes[band.key].liquidity;
    lines.push(`| ${band.label} | ${item.stock_count} | ${item.observation_count} | ${item.price_median ?? 'NA'} 元 | ${item.volume_median_lots ?? 'NA'} 張 | ${item.volume_p85_lots ?? 'NA'} 張 | ${item.volume_p90_lots ?? 'NA'} 張 | ${formatMoney(item.turnover_median_ntd)} | ${formatMoney(item.turnover_p85_ntd)} |`);
  }
  lines.push('', '## 全樣本：不同放量規則的隔日延續率', '');
  lines.push('| 規則 | 命中觀察值 | 上漲日樣本 | 上漲隔日續漲率 | 上漲隔日平均 | 下跌日樣本 | 下跌隔日續跌率 | 下跌隔日平均 |');
  lines.push('|---|---:|---:|---:|---:|---:|---:|---:|');
  for (const rule of payload.scopes.all.rule_evaluation) {
    lines.push(`| ${rule.label} | ${rule.matched_observations} | ${rule.up.count} | ${rule.up.continuation_rate ?? 'NA'}% | ${rule.up.next_return_average ?? 'NA'}% | ${rule.down.count} | ${rule.down.continuation_rate ?? 'NA'}% | ${rule.down.next_return_average ?? 'NA'}% |`);
  }
  lines.push('', '## 各價格帶：20日均量比的最佳探索門檻', '');
  lines.push('| 價格帶 | 上漲日門檻 | 高量續漲率 | 低量續漲率 | 差距 | 下跌日門檻 | 高量續跌率 | 低量續跌率 | 差距 |');
  lines.push('|---|---:|---:|---:|---:|---:|---:|---:|---:|');
  for (const band of payload.price_bands) {
    const thresholds = payload.scopes[band.key].best_thresholds.rvol20;
    const up = thresholds.up;
    const down = thresholds.down;
    lines.push(`| ${band.label} | ${up?.threshold ?? 'NA'}x | ${up?.high_continuation_rate ?? 'NA'}% | ${up?.low_continuation_rate ?? 'NA'}% | ${up?.continuation_uplift_pp ?? 'NA'}pp | ${down?.threshold ?? 'NA'}x | ${down?.high_continuation_rate ?? 'NA'}% | ${down?.low_continuation_rate ?? 'NA'}% | ${down?.continuation_uplift_pp ?? 'NA'}pp |`);
  }
  lines.push('', '## 建議拿來討論的成交量定義', '');
  lines.push('### 方案 A：20日相對均量（最容易落地）');
  lines.push('- `量縮`：當日量 ÷ 前20日平均量 ≤ 0.75。');
  lines.push('- `正常量`：0.75～1.20。');
  lines.push('- `溫和放量`：1.20～1.50。');
  lines.push('- `有效放量候選`：≥1.50。');
  lines.push('- `大量／事件量`：≥2.00；≥3.00 視為極端量，需防止沖高回落或恐慌殺盤。');
  lines.push('');
  lines.push('### 方案 B：股票自身60日量能百分位（跨股票較公平）');
  lines.push('- ≥70：活躍。');
  lines.push('- ≥80：明顯放量。');
  lines.push('- ≥90：大量。');
  lines.push('- ≥95：極端量。');
  lines.push('');
  lines.push('### 方案 C：成交金額相對值＋絕對流動性底線');
  lines.push('- 先用 `當日成交金額 ÷ 前20日平均成交金額 ≥ 1.5` 判斷資金是否真的放大。');
  lines.push('- 再依價格帶的成交金額P50或P75設最低流動性，避免幾十張就造成很高量比的冷門股。');
  lines.push('');
  lines.push('### 方案 D：雙重確認（較適合放進預測模型）');
  lines.push('- 放量確認：`20日均量比 ≥ 1.5` 且 `60日量能百分位 ≥ 80`。');
  lines.push('- 上漲有效：r1 至少 +0.5% 或突破關鍵價位，並符合放量確認。');
  lines.push('- 下跌有效：r1 至少 -0.5% 或跌破關鍵價位，並符合放量確認。');
  lines.push('- 量縮反轉候選：|r1| ≥ 0.5%，但20日均量比 ≤ 0.75。');
  lines.push('');
  lines.push('## 初步判斷原則', '');
  lines.push('- 不建議使用「超過固定幾千張」作為全市場共同門檻，因價格與個股流動性差異太大。');
  lines.push('- 價格帶主要用來設定成交金額與流動性底線；判斷多空可信度仍應以股票自己的相對量為主。');
  lines.push('- 放量只代表市場參與度提高，不保證方向正確；極端量需要搭配收盤位置、上下影線與隔日承接。');
  lines.push('- 本報告分析隔日方向延續，正式納入模型前應再以多個市場階段做走勢外驗證。');
  lines.push('', `完整200檔清單、每個量比區間與規則統計請見 \`data_volume_analysis/${payload.date}/volume-confirmation-analysis.json\`。`, '');
  return lines.join('\n');
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const sampleSize = Number.isFinite(args.sampleSize) && args.sampleSize > 0 ? Math.floor(args.sampleSize) : SAMPLE_SIZE;
  const industries = readJson(INDUSTRY_FILE, {});
  const loaded = loadHistory(args.date);
  const candidates = [...loaded.history.entries()]
    .map(([code, rows]) => latestCandidate(code, rows, industries, loaded.date))
    .filter(Boolean);
  const sample = chooseSample(candidates, sampleSize);
  if (sample.length < Math.min(sampleSize, 100)) throw new Error(`Only ${sample.length} eligible stocks were selected`);
  const observations = buildObservations(sample, loaded.history);
  if (!observations.length) throw new Error('No usable observations were generated');
  const scopes = { all: analyzeScope('全樣本', observations) };
  for (const band of PRICE_BANDS) {
    scopes[band.key] = analyzeScope(band.label, observations.filter((row) => row.band === band.key));
  }
  const payload = {
    schema_version: '1.0.0',
    generated_at: new Date().toISOString(),
    date: loaded.date,
    methodology: {
      sample_size_requested: sampleSize,
      historical_file_count: loaded.files.length,
      minimum_stock_history: MIN_HISTORY,
      minimum_directional_move_percent: MIN_MOVE,
      volume_unit_assumption: 'data_fubon Volume is treated as lots; estimated turnover = close price × volume × 1,000 TWD',
      selection: 'price-band stratification plus evenly spaced sampling across 20-day median turnover',
    },
    history: {
      start_date: loaded.files[0].date,
      end_date: loaded.files.at(-1).date,
      file_count: loaded.files.length,
    },
    price_bands: PRICE_BANDS.map(({ key, label, min, max, target }) => ({ key, label, min, max: Number.isFinite(max) ? max : null, target })),
    sample: {
      stock_count: sample.length,
      stocks: sample,
      counts_by_band: Object.fromEntries(PRICE_BANDS.map((band) => [band.key, sample.filter((row) => row.band === band.key).length])),
    },
    observation_count: observations.length,
    scopes,
  };
  const outputDir = path.join(OUTPUT_ROOT, loaded.date);
  writeJson(path.join(outputDir, 'volume-confirmation-analysis.json'), payload);
  writeText(path.join(outputDir, 'volume-confirmation-analysis.md'), markdown(payload));
  writeJson(path.join(OUTPUT_ROOT, 'manifest.json'), {
    latest_date: loaded.date,
    latest_json: `data_volume_analysis/${loaded.date}/volume-confirmation-analysis.json`,
    latest_markdown: `data_volume_analysis/${loaded.date}/volume-confirmation-analysis.md`,
    generated_at: payload.generated_at,
  });
  console.log(JSON.stringify({
    date: loaded.date,
    sample_size: sample.length,
    observation_count: observations.length,
    counts_by_band: payload.sample.counts_by_band,
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

module.exports = { bucketAnalysis, chooseSample, continuationStats, quantile };
