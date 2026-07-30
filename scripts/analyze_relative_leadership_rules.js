#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const PREDICTION_ROOT = path.join(ROOT, 'data_predictions');
const OUTPUT_ROOT = path.join(ROOT, 'data_prediction_analysis', 'relative-leadership');
const MAX_DATES = 30;
const MAX_CONDITIONS = 4;
const MIN_DISCOVERY_SUPPORT = 5;
const MIN_VALIDATION_SUPPORT = 8;
const TARGET = 'relative_leadership';

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
    else if (argv[index] === '--max-dates') args.maxDates = Number(argv[++index]);
  }
  return args;
}

function finite(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function round(value, digits = 2) {
  return Number.isFinite(value) ? Number(value.toFixed(digits)) : null;
}

function pct(count, total) {
  return total ? count / total * 100 : null;
}

function wilsonLower(successes, total, z = 1.96) {
  if (!total) return null;
  const proportion = successes / total;
  const denominator = 1 + z * z / total;
  const center = proportion + z * z / (2 * total);
  const margin = z * Math.sqrt((proportion * (1 - proportion) + z * z / (4 * total)) / total);
  return (center - margin) / denominator * 100;
}

function get(object, dottedPath) {
  return dottedPath.split('.').reduce((value, key) => value == null ? null : value[key], object);
}

function availableDates(limit) {
  if (!fs.existsSync(PREDICTION_ROOT)) return [];
  return fs.readdirSync(PREDICTION_ROOT)
    .filter(name => /^20\d{6}$/.test(name))
    .filter(date => fs.existsSync(path.join(PREDICTION_ROOT, date, 'summary.json'))
      && fs.existsSync(path.join(PREDICTION_ROOT, date, 'replay-dashboard.json')))
    .sort()
    .slice(-limit);
}

function loadDate(date) {
  const directory = path.join(PREDICTION_ROOT, date);
  const summary = readJson(path.join(directory, 'summary.json'), { stocks: [] });
  const replay = readJson(path.join(directory, 'replay-dashboard.json'), { rows: [] });
  const replayByCode = new Map((replay.rows || []).map(row => [String(row.stock_code), row]));
  return (summary.stocks || []).map(prediction => {
    const result = replayByCode.get(String(prediction.stock_code));
    return {
      date,
      stock_code: String(prediction.stock_code),
      stock_name: prediction.stock_name,
      industry: prediction.industry,
      prediction,
      result,
      verified: Boolean(result?.verified),
      target: result?.market_relative?.classification === TARGET,
    };
  }).filter(row => row.verified);
}

function addThresholdAtoms(atoms, definition) {
  const { family, label, path: valuePath, thresholds, directions = ['gte'] } = definition;
  for (const direction of directions) {
    for (const threshold of thresholds) {
      const operator = direction === 'gte' ? '≥' : '≤';
      atoms.push({
        id: `${family}:${direction}:${threshold}`,
        family,
        label: `${label} ${operator} ${threshold}`,
        test: row => {
          const value = finite(get(row.prediction, valuePath));
          return value != null && (direction === 'gte' ? value >= threshold : value <= threshold);
        },
      });
    }
  }
}

function buildAtoms(allRows) {
  const atoms = [];
  const exact = (family, label, pathValue, expected) => atoms.push({
    id: `${family}:eq:${expected}`,
    family,
    label: `${label}＝${expected}`,
    test: row => get(row.prediction, pathValue) === expected,
  });
  const truthy = (family, label, pathValue) => atoms.push({
    id: `${family}:true`,
    family,
    label,
    test: row => Boolean(get(row.prediction, pathValue)),
  });

  ['中性偏多', '中性', '中性偏空', '偏多', '偏空'].forEach(value => exact('direction_label', '方向', 'final_direction_label', value));
  ['低風險', '中風險', '高風險'].forEach(value => exact('risk_label', '個股風險', 'risk_label', value));
  ['偏多', '偏空', '中性或不足'].forEach(value => exact('chip_bias', '籌碼', 'chip_bias', value));
  ['大盤跌勢抗跌', '大盤漲勢領先', '大盤跌勢弱勢', '大盤漲勢落後'].forEach(value => exact('rs_mode', '7日RS型態', 'relative_strength_7d.relative_strength_mode', value));

  truthy('rs_strong', '7日相對強勢成立', 'relative_strength_7d.relative_strength_strong');
  truthy('breakout_matched', '三日突破前兆成立', 'breakout_precursor.matched');
  truthy('consolidation_matched', '盤整轉強成立', 'consolidation_strength.matched');
  [
    ['crossed_sma20', '收復 SMA20', 'reversal_signals.crossed_sma20'],
    ['crossed_sma60', '收復 SMA60', 'reversal_signals.crossed_sma60'],
    ['macd_bullish_cross', 'MACD 黃金交叉', 'reversal_signals.macd_bullish_cross'],
    ['macd_hist_positive_turn', 'MACD 柱翻正', 'reversal_signals.macd_histogram_positive_turn'],
    ['kd_bullish_cross', 'KD 黃金交叉', 'reversal_signals.kd_bullish_cross'],
    ['kd_oversold_turn', 'KD 低檔轉強', 'reversal_signals.kd_oversold_turn'],
  ].forEach(([family, label, valuePath]) => truthy(family, label, valuePath));

  const strategyTags = [...new Set(allRows.flatMap(row => row.prediction.strategy_tags || []))].sort();
  for (const tag of strategyTags) {
    atoms.push({
      id: `strategy:${tag}`,
      family: `strategy:${tag}`,
      label: `策略：${tag}`,
      test: row => (row.prediction.strategy_tags || []).includes(tag),
    });
  }

  [
    { family: 'direction_score', label: '方向分數', path: 'direction_score', thresholds: [-4, -3, -2, -1, 0, 1, 2, 3, 4], directions: ['gte', 'lte'] },
    { family: 'r1', label: 'r1', path: 'features.r1', thresholds: [-5, -3, -1, 0, 1, 2, 3, 5], directions: ['gte', 'lte'] },
    { family: 'r3', label: 'r3', path: 'features.r3', thresholds: [-10, -5, -3, 0, 2, 5, 8, 12], directions: ['gte', 'lte'] },
    { family: 'volume1', label: '1日量比', path: 'features.volume_ratio_1d', thresholds: [0.7, 1, 1.2, 1.5, 2, 3], directions: ['gte', 'lte'] },
    { family: 'volume5', label: '5日量比', path: 'features.volume_ratio_5d', thresholds: [0.8, 1, 1.2, 1.5, 2], directions: ['gte', 'lte'] },
    { family: 'gap_sma20', label: 'SMA20乖離', path: 'features.gap_sma20', thresholds: [-10, -5, 0, 5, 10, 15], directions: ['gte', 'lte'] },
    { family: 'rsi14', label: 'RSI14', path: 'features.rsi14', thresholds: [25, 30, 35, 40, 50, 55, 60, 65, 70], directions: ['gte', 'lte'] },
    { family: 'institutional', label: '法人比', path: 'features.institutional_ratio', thresholds: [0, 2, 5, 10, 20], directions: ['gte', 'lte'] },
    { family: 'main_net', label: '主力比', path: 'features.main_net_ratio', thresholds: [-5, 0, 1, 2, 5, 10], directions: ['gte', 'lte'] },
    { family: 'margin_change', label: '融資變化率', path: 'features.margin_change_rate', thresholds: [-5, -2, 0, 2, 5], directions: ['gte', 'lte'] },
    { family: 'rs7', label: '7日RS', path: 'relative_strength_7d.relative_strength_7d', thresholds: [-5, 0, 2, 5, 8, 10, 15], directions: ['gte', 'lte'] },
    { family: 'stock_return7', label: '個股7日報酬', path: 'relative_strength_7d.stock_return_7d', thresholds: [-5, -2, 0, 2, 5, 8, 12], directions: ['gte', 'lte'] },
    { family: 'breakout_score', label: '突破前兆分數', path: 'breakout_precursor.score', thresholds: [25, 50, 75, 100], directions: ['gte'] },
    { family: 'consolidation_score', label: '盤整分數', path: 'consolidation_strength.consolidation_score', thresholds: [2, 3, 4, 5], directions: ['gte'] },
    { family: 'strengthening_score', label: '轉強分數', path: 'consolidation_strength.strengthening_score', thresholds: [5, 8, 10, 12], directions: ['gte'] },
    { family: 'near20high', label: '距20日高點', path: 'consolidation_strength.metrics.near_20d_high', thresholds: [0, 2, 5, 10], directions: ['lte'] },
    { family: 'ma_compression', label: '均線糾結', path: 'consolidation_strength.metrics.ma_compression', thresholds: [2, 4, 6, 10], directions: ['lte'] },
    { family: 'range20', label: '20日區間', path: 'consolidation_strength.metrics.range_20d', thresholds: [8, 10, 15, 20], directions: ['lte'] },
    { family: 'volume_lead', label: '前兆量能倍率', path: 'breakout_precursor.metrics.volume_lead_ratio', thresholds: [1, 1.2, 1.5, 2, 3], directions: ['gte'] },
    { family: 'macd_hist', label: 'MACD柱', path: 'reversal_signals.macd_histogram', thresholds: [-0.5, 0, 0.2, 0.5], directions: ['gte', 'lte'] },
    { family: 'k9', label: 'K9', path: 'reversal_signals.k9', thresholds: [20, 30, 50, 70, 80], directions: ['gte', 'lte'] },
  ].forEach(definition => addThresholdAtoms(atoms, definition));

  atoms.push({
    id: 'kd:k_above_d',
    family: 'kd_relation',
    label: 'K9 ≥ D9',
    test: row => {
      const k = finite(row.prediction.reversal_signals?.k9);
      const d = finite(row.prediction.reversal_signals?.d9);
      return k != null && d != null && k >= d;
    },
  });

  return atoms;
}

function selectedRows(rows, atoms) {
  return rows.filter(row => atoms.every(atom => atom.test(row)));
}

function summarizeSelection(rows, baselineRate) {
  const hits = rows.filter(row => row.target).length;
  const precision = pct(hits, rows.length);
  return {
    count: rows.length,
    hits,
    precision: round(precision),
    lift: Number.isFinite(precision) && Number.isFinite(baselineRate) && baselineRate > 0 ? round(precision / baselineRate, 2) : null,
    wilson_lower_95: round(wilsonLower(hits, rows.length)),
  };
}

function evaluateCandidate(candidate, discoveryRows, validationByDate, discoveryBaseline) {
  const discoverySelected = selectedRows(discoveryRows, candidate.atoms);
  const discovery = summarizeSelection(discoverySelected, discoveryBaseline);
  const perDate = [];
  const pooled = [];
  for (const [date, rows] of validationByDate.entries()) {
    const selected = selectedRows(rows, candidate.atoms);
    pooled.push(...selected);
    const baseline = pct(rows.filter(row => row.target).length, rows.length);
    perDate.push({ date, ...summarizeSelection(selected, baseline) });
  }
  const validationRows = [...validationByDate.values()].flat();
  const validationBaseline = pct(validationRows.filter(row => row.target).length, validationRows.length);
  const validation = summarizeSelection(pooled, validationBaseline);
  validation.day_count = perDate.filter(item => item.count > 0).length;
  validation.positive_day_count = perDate.filter(item => item.count > 0 && item.precision >= 50).length;
  validation.per_date = perDate;
  return { discovery, validation, discoverySelected, validationSelected: pooled };
}

function candidateScore(candidate) {
  const discovery = candidate.discovery;
  const validation = candidate.validation;
  const validationWeight = validation.count >= MIN_VALIDATION_SUPPORT ? 1 : validation.count / MIN_VALIDATION_SUPPORT;
  const dayWeight = Math.min(1, validation.day_count / 2);
  const simplicity = 1 / candidate.atoms.length;
  return (validation.precision || 0) * 3 * validationWeight
    + (validation.wilson_lower_95 || 0) * 2
    + (discovery.precision || 0)
    + Math.min(30, validation.count) * 0.7
    + dayWeight * 15
    + simplicity * 3;
}

function searchRules(discoveryRows, validationByDate, atoms) {
  const discoveryBaseline = pct(discoveryRows.filter(row => row.target).length, discoveryRows.length);
  const singleCandidates = atoms.map((atom, index) => ({ atoms: [atom], atomIndexes: [index] }))
    .map(candidate => ({ ...candidate, ...evaluateCandidate(candidate, discoveryRows, validationByDate, discoveryBaseline) }))
    .filter(candidate => candidate.discovery.count >= MIN_DISCOVERY_SUPPORT)
    .sort((a, b) => candidateScore(b) - candidateScore(a))
    .slice(0, 90);

  const allLevels = [...singleCandidates];
  let beam = singleCandidates;
  for (let level = 2; level <= MAX_CONDITIONS; level += 1) {
    const next = [];
    const seen = new Set();
    for (const parent of beam) {
      const lastIndex = parent.atomIndexes[parent.atomIndexes.length - 1];
      const families = new Set(parent.atoms.map(atom => atom.family));
      for (let index = lastIndex + 1; index < atoms.length; index += 1) {
        const atom = atoms[index];
        if (families.has(atom.family)) continue;
        const atomIndexes = [...parent.atomIndexes, index];
        const key = atomIndexes.join(',');
        if (seen.has(key)) continue;
        seen.add(key);
        const candidate = { atoms: [...parent.atoms, atom], atomIndexes };
        const evaluated = evaluateCandidate(candidate, discoveryRows, validationByDate, discoveryBaseline);
        if (evaluated.discovery.count < MIN_DISCOVERY_SUPPORT) continue;
        if ((evaluated.discovery.precision || 0) < discoveryBaseline + 5) continue;
        next.push({ ...candidate, ...evaluated });
      }
    }
    next.sort((a, b) => candidateScore(b) - candidateScore(a));
    beam = next.slice(0, level === 2 ? 700 : level === 3 ? 450 : 250);
    allLevels.push(...beam);
  }

  const unique = new Map();
  for (const candidate of allLevels) {
    const selectedKey = candidate.discoverySelected.map(row => row.stock_code).sort().join(',');
    const existing = unique.get(selectedKey);
    if (!existing || candidate.atoms.length < existing.atoms.length || candidateScore(candidate) > candidateScore(existing)) {
      unique.set(selectedKey, candidate);
    }
  }

  return [...unique.values()]
    .map(candidate => ({ ...candidate, score: round(candidateScore(candidate), 4) }))
    .sort((a, b) => b.score - a.score);
}

function serializeCandidate(candidate, limitStocks = 80) {
  const stock = row => ({
    date: row.date,
    stock_code: row.stock_code,
    stock_name: row.stock_name,
    industry: row.industry,
    relative_leadership: row.target,
  });
  return {
    conditions: candidate.atoms.map(atom => atom.label),
    condition_ids: candidate.atoms.map(atom => atom.id),
    condition_count: candidate.atoms.length,
    score: candidate.score,
    discovery: candidate.discovery,
    validation: candidate.validation,
    discovery_stocks: candidate.discoverySelected.slice(0, limitStocks).map(stock),
    validation_stocks: candidate.validationSelected.slice(0, limitStocks).map(stock),
  };
}

function candidateTier(candidate) {
  const d = candidate.discovery;
  const v = candidate.validation;
  if (d.count >= 5 && d.precision >= 95 && v.count >= MIN_VALIDATION_SUPPORT && v.precision >= 85 && v.day_count >= 2) return 'A_near_perfect';
  if (d.count >= 8 && d.precision >= 85 && v.count >= MIN_VALIDATION_SUPPORT && v.precision >= 75 && v.day_count >= 2) return 'B_high_precision';
  if (d.count >= 10 && d.precision >= 70 && v.count >= 12 && v.precision >= 65 && v.day_count >= 2) return 'C_repeatable_signal';
  return 'exploratory';
}

function markdown(payload) {
  const lines = [
    `# 相對領漲事前訊號組合研究：${payload.discovery_date}`,
    '',
    `- 探索日：${payload.discovery_date}`,
    `- 驗證日：${payload.validation_dates.length ? payload.validation_dates.join('、') : '無'}`,
    `- 可用正式覆盤日：${payload.available_dates.length} 天（程式最多讀取 ${payload.max_dates} 天）`,
    `- 相對領漲定義：覆盤結果分類為 \`${TARGET}\`；只使用預測日前已存在欄位搜尋規則。`,
    `- 探索日基準率：${payload.discovery_baseline.precision}%（${payload.discovery_baseline.hits}/${payload.discovery_baseline.count}）`,
    `- 驗證期基準率：${payload.validation_baseline.precision}%（${payload.validation_baseline.hits}/${payload.validation_baseline.count}）`,
    '',
    '> 注意：目前只有四個正式覆盤日。接近 100% 但樣本很少的規則很容易是多重測試巧合；A/B 級規則仍須累積更多不同市場環境後才能加入正式選股。',
    '',
    '## 結論',
    '',
    `- A 級接近滿分且跨日重複：${payload.tier_counts.A_near_perfect} 組`,
    `- B 級高精度：${payload.tier_counts.B_high_precision} 組`,
    `- C 級可重複訊號：${payload.tier_counts.C_repeatable_signal} 組`,
    '',
    '## 前 20 組規則',
    '',
    '| 等級 | 條件 | 探索日命中 | 探索樣本 | 驗證命中 | 驗證樣本 | 驗證日覆蓋 | 95%下限 |',
    '|---|---|---:|---:|---:|---:|---:|---:|',
  ];
  for (const item of payload.top_rules.slice(0, 20)) {
    lines.push(`| ${item.tier} | ${item.conditions.join(' ＋ ')} | ${item.discovery.precision ?? 'NA'}% | ${item.discovery.count} | ${item.validation.precision ?? 'NA'}% | ${item.validation.count} | ${item.validation.day_count} | ${item.validation.wilson_lower_95 ?? 'NA'}% |`);
  }
  lines.push('', '## 方法限制', '');
  lines.push('- 搜尋過大量排列組合，因此不能只看探索日 100%；排序優先使用前幾日的時間外驗證與 Wilson 95% 下限。');
  lines.push('- 沒有使用股票代號、名稱、產業、結果日價格型態或結果日成交量作為條件，避免記憶個股與資料洩漏。');
  lines.push('- 目前可用日期少，無法代表完整牛市、空頭、盤整與事件日；程式會自動擴展到最近 30 個正式覆盤日。');
  return `${lines.join('\n')}\n`;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const maxDates = Number.isFinite(args.maxDates) && args.maxDates > 1 ? Math.min(30, Math.floor(args.maxDates)) : MAX_DATES;
  const dates = availableDates(maxDates);
  if (!dates.length) throw new Error('No completed replay dates found.');
  const discoveryDate = args.date || dates[dates.length - 1];
  if (!dates.includes(discoveryDate)) throw new Error(`Replay date ${discoveryDate} is not available.`);
  const selectedDates = dates.filter(date => date <= discoveryDate);
  const validationDates = selectedDates.filter(date => date < discoveryDate);
  const discoveryRows = loadDate(discoveryDate);
  const validationByDate = new Map(validationDates.map(date => [date, loadDate(date)]));
  const allRows = [...discoveryRows, ...[...validationByDate.values()].flat()];
  const atoms = buildAtoms(allRows);
  const candidates = searchRules(discoveryRows, validationByDate, atoms);

  const tiered = candidates.map(candidate => ({ ...candidate, tier: candidateTier(candidate) }));
  const priorityOrder = { A_near_perfect: 0, B_high_precision: 1, C_repeatable_signal: 2, exploratory: 3 };
  tiered.sort((a, b) => priorityOrder[a.tier] - priorityOrder[b.tier] || b.score - a.score);

  const discoveryBaseline = summarizeSelection(discoveryRows, pct(discoveryRows.filter(row => row.target).length, discoveryRows.length));
  const validationRows = [...validationByDate.values()].flat();
  const validationBaseline = summarizeSelection(validationRows, pct(validationRows.filter(row => row.target).length, validationRows.length));
  const topRules = tiered.filter(candidate => candidate.tier !== 'exploratory').slice(0, 50);
  const fallbackRules = tiered.slice(0, 30);
  const selectedRules = topRules.length ? topRules : fallbackRules;

  const payload = {
    schema_version: '1.0.0',
    generated_at: new Date().toISOString(),
    target: TARGET,
    discovery_date: discoveryDate,
    validation_dates: validationDates,
    available_dates: selectedDates,
    max_dates: maxDates,
    methodology: {
      discovery: 'Latest selected replay date is used for rule discovery.',
      validation: 'All earlier completed replay dates use exactly the same frozen rule.',
      max_conditions: MAX_CONDITIONS,
      minimum_discovery_support: MIN_DISCOVERY_SUPPORT,
      minimum_validation_support: MIN_VALIDATION_SUPPORT,
      leakage_controls: ['prediction-time fields only', 'no stock identity', 'no industry', 'no result-day pattern or price inputs'],
      ranking: 'Out-of-sample precision, Wilson lower bound, validation support, date coverage, then discovery precision.',
    },
    discovery_baseline: discoveryBaseline,
    validation_baseline: validationBaseline,
    atom_count: atoms.length,
    candidate_count: candidates.length,
    tier_counts: {
      A_near_perfect: tiered.filter(candidate => candidate.tier === 'A_near_perfect').length,
      B_high_precision: tiered.filter(candidate => candidate.tier === 'B_high_precision').length,
      C_repeatable_signal: tiered.filter(candidate => candidate.tier === 'C_repeatable_signal').length,
      exploratory: tiered.filter(candidate => candidate.tier === 'exploratory').length,
    },
    top_rules: selectedRules.map(candidate => ({ tier: candidate.tier, ...serializeCandidate(candidate) })),
    best_exploratory_rules: tiered.filter(candidate => candidate.tier === 'exploratory').slice(0, 20).map(candidate => ({ tier: candidate.tier, ...serializeCandidate(candidate) })),
  };

  writeJson(path.join(OUTPUT_ROOT, `${discoveryDate}.json`), payload);
  writeText(path.join(OUTPUT_ROOT, `${discoveryDate}.md`), markdown(payload));
  writeJson(path.join(OUTPUT_ROOT, 'manifest.json'), {
    generated_at: payload.generated_at,
    latest_date: discoveryDate,
    available_dates: selectedDates,
    latest_json: `data_prediction_analysis/relative-leadership/${discoveryDate}.json`,
    latest_markdown: `data_prediction_analysis/relative-leadership/${discoveryDate}.md`,
  });

  console.log(JSON.stringify({
    discovery_date: discoveryDate,
    validation_dates: validationDates,
    discovery_rows: discoveryRows.length,
    validation_rows: validationRows.length,
    atom_count: atoms.length,
    candidate_count: candidates.length,
    tier_counts: payload.tier_counts,
    outputs: [
      path.relative(ROOT, path.join(OUTPUT_ROOT, `${discoveryDate}.json`)),
      path.relative(ROOT, path.join(OUTPUT_ROOT, `${discoveryDate}.md`)),
    ],
  }, null, 2));
}

try {
  main();
} catch (error) {
  console.error(error.stack || error.message);
  process.exit(1);
}
