#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
function readJson(file, fallback = null) { try { const text = fs.readFileSync(file, 'utf8').trim(); return text ? JSON.parse(text) : fallback; } catch { return fallback; } }
function write(file, content) { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, content, 'utf8'); }
function writeJson(file, payload) { write(file, `${JSON.stringify(payload, null, 2)}\n`); }
function compact(value) { return String(value || '').replaceAll('-', '').replaceAll('/', ''); }
function round(value, digits = 2) { return Number.isFinite(value) ? Number(value.toFixed(digits)) : null; }
function average(values) { const valid = values.filter(Number.isFinite); return valid.length ? valid.reduce((a, b) => a + b, 0) / valid.length : null; }
function side(label) { return String(label || '').includes('偏多') ? 1 : String(label || '').includes('偏空') ? -1 : 0; }
function parseArgs(argv) { const args = {}; for (let i = 0; i < argv.length; i += 1) if (argv[i] === '--date') args.date = compact(argv[++i]); return args; }

function loadPredictions(dir) {
  if (!fs.existsSync(dir)) return new Map();
  const map = new Map();
  for (const file of fs.readdirSync(dir).filter((name) => /^\d{4,6}\.json$/.test(name))) {
    const row = readJson(path.join(dir, file), null);
    if (row?.stock_code) map.set(String(row.stock_code), row);
  }
  return map;
}

function v1ReplayMetrics(date) {
  const dashboard = readJson(path.join(ROOT, 'data_predictions', date, 'replay-dashboard.json'), null);
  if (!dashboard?.rows) return null;
  const rows = dashboard.rows.filter((row) => row.verified && row.actual && row.prediction);
  const directional = rows.filter((row) => side(row.prediction.final_direction_label));
  const signed = directional.map((row) => side(row.prediction.final_direction_label) * Number(row.actual.close_return)).filter(Number.isFinite);
  return {
    verified_count: rows.length,
    hit_rate: round(rows.filter((row) => String(row.prediction_match_label).includes('準確')).length / rows.length * 100),
    average_gross_signed_return: round(average(signed)),
    average_net_signed_return_30bps: round(average(signed.map((value) => value - 0.3))),
  };
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const v2Manifest = readJson(path.join(ROOT, 'data_predictions_v2', 'manifest.json'), null);
  const date = args.date || compact(v2Manifest?.latest_date);
  if (!/^20\d{6}$/.test(date)) throw new Error('Missing comparison date');
  const v1 = loadPredictions(path.join(ROOT, 'data_predictions', date));
  const v2 = loadPredictions(path.join(ROOT, 'data_predictions_v2', date));
  const shared = [...v1.keys()].filter((code) => v2.has(code));
  const differences = shared.map((code) => {
    const a = v1.get(code); const b = v2.get(code);
    return {
      stock_code: code,
      stock_name: b.stock_name || a.stock_name,
      v1_score: a.direction_score,
      v2_score: b.direction_score,
      score_delta: Number(b.direction_score) - Number(a.direction_score),
      v1_direction: a.final_direction_label,
      v2_direction: b.final_direction_label,
      direction_changed: a.final_direction_label !== b.final_direction_label,
      relative_strength_bucket: b.experimental_v2?.relative_strength_bucket,
      chip_technical_quadrant: b.experimental_v2?.chip_technical_quadrant,
      adjustments: b.experimental_v2?.adjustments || [],
    };
  });
  const changed = differences.filter((row) => row.direction_changed);
  const v1Replay = v1ReplayMetrics(date);
  const v2Replay = readJson(path.join(ROOT, 'data_predictions_v2', date, 'replay-summary-v2.json'), null);
  const payload = {
    comparison_version: '1.0.0',
    generated_at: new Date().toISOString(),
    forecast_date: date,
    shared_prediction_count: shared.length,
    forecast_difference: {
      changed_direction_count: changed.length,
      changed_direction_rate: round(shared.length ? changed.length / shared.length * 100 : null),
      average_score_delta: round(average(differences.map((row) => row.score_delta))),
      changed_examples: changed.slice(0, 200),
    },
    accuracy_comparison: v1Replay && v2Replay ? {
      v1: v1Replay,
      v2: {
        verified_count: v2Replay.verified_count,
        hit_rate: v2Replay.raw_accuracy?.hit_rate,
        balanced_directional_accuracy: v2Replay.raw_accuracy?.balanced_directional_accuracy,
        average_gross_signed_return: v2Replay.economic_value?.average_gross_signed_return,
        average_net_signed_return_30bps: v2Replay.economic_value?.average_net_signed_return,
        score_vs_market_excess_spearman_ic: v2Replay.relative_ability?.score_vs_market_excess_spearman_ic,
        numeric_error: v2Replay.numeric_error,
      },
      deltas: {
        hit_rate: round(v2Replay.raw_accuracy?.hit_rate - v1Replay.hit_rate),
        average_gross_signed_return: round(v2Replay.economic_value?.average_gross_signed_return - v1Replay.average_gross_signed_return),
        average_net_signed_return_30bps: round(v2Replay.economic_value?.average_net_signed_return - v1Replay.average_net_signed_return_30bps),
      },
    } : null,
    status: v1Replay && v2Replay ? 'accuracy_available' : 'forecast_only_waiting_for_actual_market_data',
  };
  const outDir = path.join(ROOT, 'data_prediction_comparisons', date);
  writeJson(path.join(outDir, 'comparison.json'), payload);
  const md = [
    `# V1 / V2 預測比較：${date}`,
    '',
    `- 共同樣本：${shared.length}`,
    `- 方向改變：${changed.length}（${payload.forecast_difference.changed_direction_rate ?? 'NA'}%）`,
    `- 平均分數差：${payload.forecast_difference.average_score_delta ?? 'NA'}`,
    `- 狀態：${payload.status}`,
    '',
    '## 準確度比較',
    '',
    payload.accuracy_comparison
      ? `V1 命中率 ${payload.accuracy_comparison.v1.hit_rate}%；V2 命中率 ${payload.accuracy_comparison.v2.hit_rate}%；差異 ${payload.accuracy_comparison.deltas.hit_rate >= 0 ? '+' : ''}${payload.accuracy_comparison.deltas.hit_rate}%。`
      : '尚未取得結果日行情；目前只比較兩版預測輸出差異。',
    '',
    '完整資料請見 `comparison.json`。',
    '',
  ].join('\n');
  write(path.join(outDir, 'comparison.md'), md);
  writeJson(path.join(ROOT, 'data_prediction_comparisons', 'manifest.json'), {
    latest_date: date,
    latest_comparison: `data_prediction_comparisons/${date}/comparison.json`,
    generated_at: payload.generated_at,
  });
  console.log(JSON.stringify({ date, shared: shared.length, changed: changed.length, status: payload.status }, null, 2));
}

if (require.main === module) { try { main(); } catch (error) { console.error(error.stack || error.message); process.exit(1); } }
