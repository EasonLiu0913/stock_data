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
} = require('./market_environment_lib');

const PREDICTION_DIR = path.join(ROOT, 'data_predictions');
const ENV_DIR = path.join(ROOT, 'data_market_environment');
const OUTPUT_DIR = path.join(ROOT, 'data_prediction_analysis', 'relative-leadership', 'environment');

const RULES = [
  {
    id: 'volume5_1_5_rsi70',
    label: '5 日量比 ≥ 1.5 ＋ RSI14 ≥ 70',
    test: (prediction) => Number(prediction?.features?.volume_ratio_5d) >= 1.5 && Number(prediction?.features?.rsi14) >= 70,
  },
  {
    id: 'volume5_1_5_rs7_8',
    label: '5 日量比 ≥ 1.5 ＋ 7 日 RS ≥ 8',
    test: (prediction) => Number(prediction?.features?.volume_ratio_5d) >= 1.5 && Number(prediction?.relative_strength_7d?.relative_strength_7d) >= 8,
  },
  {
    id: 'volume5_2_rs7_10',
    label: '5 日量比 ≥ 2 ＋ 7 日 RS ≥ 10',
    test: (prediction) => Number(prediction?.features?.volume_ratio_5d) >= 2 && Number(prediction?.relative_strength_7d?.relative_strength_7d) >= 10,
  },
  {
    id: 'volume5_2_return7_2',
    label: '5 日量比 ≥ 2 ＋個股 7 日報酬 ≥ 2%',
    test: (prediction) => Number(prediction?.features?.volume_ratio_5d) >= 2 && Number(prediction?.relative_strength_7d?.stock_return_7d) >= 2,
  },
];

function completedDates(maxDates, targetDate = null) {
  if (!fs.existsSync(PREDICTION_DIR)) return [];
  return fs.readdirSync(PREDICTION_DIR)
    .filter((date) => /^20\d{6}$/.test(date) && (!targetDate || date <= targetDate))
    .filter((date) => ['replay-dashboard.json', 'replay-summary.json'].every((file) => fs.existsSync(path.join(PREDICTION_DIR, date, file))))
    .filter((date) => fs.existsSync(path.join(ENV_DIR, date, 'actual_market_environment.json')))
    .sort()
    .slice(-maxDates);
}

function summarize(rows) {
  const hits = rows.filter((row) => row.target).length;
  return {
    count: rows.length,
    hits,
    precision: rows.length ? round(hits / rows.length * 100) : null,
  };
}

function loadDate(date) {
  const dashboard = readJson(path.join(PREDICTION_DIR, date, 'replay-dashboard.json'), { rows: [] });
  const actual = readJson(path.join(ENV_DIR, date, 'actual_market_environment.json'), {});
  const environment = actual?.actual_environment?.code || 'unknown';
  return (dashboard.rows || [])
    .filter((row) => row.verified)
    .map((row) => ({
      date,
      environment,
      stock_code: String(row.stock_code),
      stock_name: row.stock_name,
      prediction: row.prediction || {},
      target: row?.market_relative?.classification === 'relative_leadership',
    }));
}

function markdown(payload) {
  const lines = [
    `# 相對領漲環境分層研究：${payload.latest_date || '無資料'}`,
    '',
    `- 分析日期：${payload.available_dates.join('、') || '無'}`,
    `- 最多使用：${payload.max_dates} 個已完成覆盤日`,
    '- 僅使用預測日前欄位；環境分類使用收盤後覆盤結果，僅供策略驗證。',
    '',
    '## 市場環境基準率',
    '',
    '|環境|日期數|樣本|相對領漲|基準率|',
    '|---|---:|---:|---:|---:|',
  ];
  for (const row of payload.environment_baselines) {
    lines.push(`|${row.environment}|${row.day_count}|${row.count}|${row.hits}|${row.precision ?? 'NA'}%|`);
  }
  lines.push('', '## 固定候選規則', '', '|規則|環境|日期數|樣本|命中|精準率|相對基準提升|', '|---|---|---:|---:|---:|---:|---:|');
  for (const rule of payload.rules) {
    for (const row of rule.by_environment) {
      lines.push(`|${rule.label}|${row.environment}|${row.day_count}|${row.count}|${row.hits}|${row.precision ?? 'NA'}%|${row.lift ?? 'NA'}x|`);
    }
  }
  lines.push('', '> Shadow mode：樣本不足時不得把單日高命中直接升級為正式交易規則。', '');
  return lines.join('\n');
}

function main() {
  const args = parseArgs();
  const maxDates = Math.max(2, Math.min(30, Number(args.get('max-dates') || 30)));
  const targetDate = args.get('date') ? compactDate(args.get('date'), 'date') : null;
  const dates = completedDates(maxDates, targetDate);
  const rows = dates.flatMap(loadDate);
  const environments = [...new Set(rows.map((row) => row.environment))].sort();
  const environmentBaselines = environments.map((environment) => {
    const selected = rows.filter((row) => row.environment === environment);
    return {
      environment,
      day_count: new Set(selected.map((row) => row.date)).size,
      ...summarize(selected),
    };
  });
  const baselineMap = new Map(environmentBaselines.map((row) => [row.environment, row.precision]));

  const ruleResults = RULES.map((rule) => ({
    id: rule.id,
    label: rule.label,
    by_environment: environments.map((environment) => {
      const selected = rows.filter((row) => row.environment === environment && rule.test(row.prediction));
      const summary = summarize(selected);
      const baseline = baselineMap.get(environment);
      return {
        environment,
        day_count: new Set(selected.map((row) => row.date)).size,
        ...summary,
        baseline_precision: baseline,
        lift: summary.precision != null && baseline ? round(summary.precision / baseline, 2) : null,
      };
    }),
    per_date: dates.map((date) => {
      const selected = rows.filter((row) => row.date === date && rule.test(row.prediction));
      return { date, environment: selected[0]?.environment || readJson(path.join(ENV_DIR, date, 'actual_market_environment.json'), {})?.actual_environment?.code || 'unknown', ...summarize(selected) };
    }),
  }));

  const latestDate = dates.at(-1) || targetDate || null;
  const generatedAt = new Date().toISOString();
  const payload = {
    schemaVersion: 1,
    generated_at: generatedAt,
    latest_date: latestDate,
    max_dates: maxDates,
    available_dates: dates,
    methodology: {
      target: 'market_relative.classification === relative_leadership',
      environment_source: 'data_market_environment/<date>/actual_market_environment.json',
      leakage_control: 'Environment is used only to group replay results, not as a prediction-time stock feature.',
      minimum_recommendation: 'At least 30 total samples, 3 dates, and multiple stress events before enabling a policy.',
    },
    environment_baselines: environmentBaselines,
    rules: ruleResults,
  };

  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  if (latestDate) {
    atomicWriteJson(path.join(OUTPUT_DIR, `${latestDate}.json`), payload);
    fs.writeFileSync(path.join(OUTPUT_DIR, `${latestDate}.md`), markdown(payload), 'utf8');
  }
  atomicWriteJson(path.join(OUTPUT_DIR, 'manifest.json'), {
    schemaVersion: 1,
    generated_at: generatedAt,
    latest_date: latestDate,
    latest_json: latestDate ? `data_prediction_analysis/relative-leadership/environment/${latestDate}.json` : null,
    latest_markdown: latestDate ? `data_prediction_analysis/relative-leadership/environment/${latestDate}.md` : null,
    available_dates: dates,
  });
  console.log(JSON.stringify({ latest_date: latestDate, dates: dates.length, environments, output: path.relative(ROOT, OUTPUT_DIR) }));
}

main();
