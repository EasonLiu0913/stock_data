#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const V1_ROOT = path.join(ROOT, 'data_predictions');
const V2_ROOT = path.join(ROOT, 'data_predictions_v2');
const UI_ROOT = path.join(ROOT, 'data_prediction_ui');
const INDEX_FILE = path.join(ROOT, 'public', 'index.html');

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

function compactDate(value) {
  return String(value || '').replaceAll('-', '').replaceAll('/', '');
}

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === '--date') args.date = compactDate(argv[++index]);
    else if (argv[index] === '--help' || argv[index] === '-h') args.help = true;
  }
  return args;
}

function listStockFiles(dir) {
  try {
    return fs.readdirSync(dir).filter((file) => /^\d{4,6}\.json$/.test(file)).sort();
  } catch {
    return [];
  }
}

function countBy(rows, selector) {
  const counts = {};
  for (const row of rows) {
    const key = selector(row);
    if (!key) continue;
    counts[key] = (counts[key] || 0) + 1;
  }
  return counts;
}

function numberOrNull(value) {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function firstDefined(...values) {
  return values.find((value) => value !== undefined && value !== null && value !== '');
}

function normalizeCompleteness(payload) {
  const value = firstDefined(
    payload?.data_completeness,
    payload?.completeness,
    payload?.data_quality?.completeness,
    payload?.view?.data_completeness
  );
  const number = numberOrNull(value);
  if (number === null) return null;
  return number <= 1 ? Number((number * 100).toFixed(1)) : Number(number.toFixed(1));
}

function normalizeVersion(payload, version) {
  if (!payload) return null;
  const experimental = payload.experimental_v2 || {};
  return {
    methodology_version: payload.methodology_version || null,
    score: numberOrNull(payload.direction_score),
    raw_direction: payload.raw_direction_label || null,
    direction: payload.final_direction_label || null,
    risk_label: firstDefined(payload.risk_label, payload.combined_risk_label, payload.view?.risk_label) || null,
    data_completeness: normalizeCompleteness(payload),
    score_delta: version === 'v2' ? numberOrNull(experimental.score_delta) : null,
    changed: false,
    relative_strength_bucket: version === 'v2' ? experimental.relative_strength_bucket || null : null,
    chip_technical_quadrant: version === 'v2' ? experimental.chip_technical_quadrant || null : null,
    chip_signal_score: version === 'v2' ? numberOrNull(experimental.chip_signal_score) : null,
    technical_signal_score: version === 'v2' ? numberOrNull(experimental.technical_signal_score) : null,
    adjustments: version === 'v2' && Array.isArray(experimental.adjustments) ? experimental.adjustments : []
  };
}

function updateIndex() {
  if (!fs.existsSync(INDEX_FILE)) return false;
  let html = fs.readFileSync(INDEX_FILE, 'utf8');
  const original = html;
  const entry = "            { file: 'prediction-version-dashboard.html', title: 'V1 / V2 股票預測切換', description: '切換正式 V1 與實驗 V2，查看方向、分數差異、規則調整與個股明細。' },\n";

  if (!html.includes("file: 'prediction-version-dashboard.html'")) {
    html = html.replace(/(const tools = \[\s*\n)/, `$1${entry}`);
  }

  html = html.replace(
    /prediction-stock\.html\?date=/g,
    'prediction-version-dashboard.html?version=v1&date='
  );

  if (html !== original) fs.writeFileSync(INDEX_FILE, html, 'utf8');
  return html !== original;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log('Usage: node scripts/generate_prediction_version_ui.js [--date YYYYMMDD]');
    return;
  }

  const v1RootManifest = readJson(path.join(V1_ROOT, 'manifest.json'), {});
  const v2RootManifest = readJson(path.join(V2_ROOT, 'manifest.json'), {});
  const date = args.date || compactDate(v2RootManifest.latest_date || v1RootManifest.latest_date || v1RootManifest.forecast_date_compact);
  if (!/^20\d{6}$/.test(date)) throw new Error(`Unable to resolve prediction date: ${date}`);

  const v1Dir = path.join(V1_ROOT, date);
  const v2Dir = path.join(V2_ROOT, date);
  const v1Manifest = readJson(path.join(v1Dir, 'manifest.json'), v1RootManifest);
  const v2Manifest = readJson(path.join(v2Dir, 'manifest.json'), null);
  if (!v1Manifest || listStockFiles(v1Dir).length === 0) {
    throw new Error(`Missing V1 prediction files for ${date}`);
  }

  const filenames = [...new Set([...listStockFiles(v1Dir), ...listStockFiles(v2Dir)])].sort();
  const rows = filenames.map((filename) => {
    const code = filename.replace(/\.json$/, '');
    const v1Payload = readJson(path.join(v1Dir, filename), null);
    const v2Payload = readJson(path.join(v2Dir, filename), null);
    const source = v2Payload || v1Payload || {};
    const v1 = normalizeVersion(v1Payload, 'v1');
    const v2 = normalizeVersion(v2Payload, 'v2');
    if (v2) v2.changed = Boolean(v1 && v1.direction !== v2.direction);
    return {
      stock_code: String(firstDefined(source.stock_code, code)),
      stock_name: firstDefined(source.stock_name, source.name, code),
      industry: firstDefined(source.industry, source.Industry, v1Payload?.industry, null),
      features: {
        relative_strength: numberOrNull(source.features?.relative_strength),
        rsi14: numberOrNull(source.features?.rsi14),
        gap_sma20: numberOrNull(source.features?.gap_sma20),
        institutional_ratio: numberOrNull(source.features?.institutional_ratio),
        main_net_ratio: numberOrNull(source.features?.main_net_ratio)
      },
      v1,
      v2,
      paths: {
        v1: v1 ? `data_predictions/${date}/${filename}` : null,
        v2: v2 ? `data_predictions_v2/${date}/${filename}` : null
      }
    };
  });

  const v1Rows = rows.filter((row) => row.v1);
  const v2Rows = rows.filter((row) => row.v2);
  const changedRows = rows.filter((row) => row.v1 && row.v2 && row.v1.direction !== row.v2.direction);
  const payload = {
    schema_version: 1,
    generated_at: new Date().toISOString(),
    forecast_date: v1Manifest.forecast_date || v2Manifest?.forecast_date || date,
    forecast_date_compact: date,
    base_trade_date: v1Manifest.base_trade_date || v2Manifest?.base_trade_date || null,
    versions: {
      v1: {
        available: v1Rows.length > 0,
        methodology_version: v1Manifest.methodology_version || v1Rows[0]?.v1?.methodology_version || null,
        total_predictions: v1Rows.length,
        direction_distribution: countBy(v1Rows, (row) => row.v1.direction)
      },
      v2: {
        available: v2Rows.length > 0,
        methodology_version: v2Manifest?.methodology_version || v2Rows[0]?.v2?.methodology_version || null,
        total_predictions: v2Rows.length,
        direction_distribution: countBy(v2Rows, (row) => row.v2.direction),
        changed_direction_count: changedRows.length,
        changed_direction_rate: v2Rows.length ? Number((changedRows.length / v2Rows.length * 100).toFixed(2)) : null,
        relative_strength_buckets: countBy(v2Rows, (row) => row.v2.relative_strength_bucket),
        chip_technical_quadrants: countBy(v2Rows, (row) => row.v2.chip_technical_quadrant)
      }
    },
    rows
  };

  writeJson(path.join(UI_ROOT, `${date}.json`), payload);
  const previousManifest = readJson(path.join(UI_ROOT, 'manifest.json'), {});
  const availableDates = [...new Set([...(previousManifest.available_dates || []), date])].sort();
  const latestDate = availableDates.at(-1);
  writeJson(path.join(UI_ROOT, 'manifest.json'), {
    schema_version: 1,
    generated_at: payload.generated_at,
    latest_date: latestDate,
    available_dates: availableDates,
    latest_data: `data_prediction_ui/${latestDate}.json`
  });

  const indexUpdated = updateIndex();
  console.log(JSON.stringify({
    date,
    v1: v1Rows.length,
    v2: v2Rows.length,
    changed: changedRows.length,
    index_updated: indexUpdated
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

module.exports = { main, normalizeCompleteness, normalizeVersion, numberOrNull };
