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

function actualSide(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return null;
  return numeric > 0.3 ? 1 : numeric < -0.3 ? -1 : 0;
}

function sideLabel(value) {
  return value > 0 ? '上漲' : value < 0 ? '下跌' : '中性';
}

function percentage(count, total) {
  return round(total ? count / total * 100 : null);
}

function predictionHit(direction, actualReturn) {
  const predicted = side(direction);
  const actual = Number(actualReturn);
  if (!Number.isFinite(actual)) return false;
  if (predicted > 0) return actual > 0;
  if (predicted < 0) return actual < 0;
  return Math.abs(actual) <= 0.3;
}

function ranks(values) {
  const indexed = values.map((value, index) => ({ value, index }))
    .sort((a, b) => a.value - b.value || a.index - b.index);
  const result = new Array(values.length);
  for (let start = 0; start < indexed.length;) {
    let end = start + 1;
    while (end < indexed.length && indexed[end].value === indexed[start].value) end += 1;
    const rank = (start + end - 1) / 2 + 1;
    for (let index = start; index < end; index += 1) result[indexed[index].index] = rank;
    start = end;
  }
  return result;
}

function pearson(left, right) {
  if (left.length !== right.length || left.length < 2) return null;
  const leftAverage = average(left);
  const rightAverage = average(right);
  let numerator = 0;
  let leftSquares = 0;
  let rightSquares = 0;
  for (let index = 0; index < left.length; index += 1) {
    const leftDelta = left[index] - leftAverage;
    const rightDelta = right[index] - rightAverage;
    numerator += leftDelta * rightDelta;
    leftSquares += leftDelta ** 2;
    rightSquares += rightDelta ** 2;
  }
  const denominator = Math.sqrt(leftSquares * rightSquares);
  return denominator ? numerator / denominator : null;
}

function spearman(left, right) {
  return pearson(ranks(left), ranks(right));
}

function buildCommonMetrics(rows) {
  if (!rows.length) return null;
  const directionalCommonRows = rows.filter((row) => side(row.v1_direction) !== 0 && side(row.v2_direction) !== 0);
  const marketAverage = average(rows.map((row) => Number(row.actual_return)));

  function metrics(version) {
    const directionKey = version + '_direction';
    const scoreKey = version + '_score';
    const hitKey = version + '_hit';
    const bullish = rows.filter((row) => side(row[directionKey]) > 0);
    const bearish = rows.filter((row) => side(row[directionKey]) < 0);
    const bullishHitRate = percentage(bullish.filter((row) => row[hitKey]).length, bullish.length);
    const bearishHitRate = percentage(bearish.filter((row) => row[hitKey]).length, bearish.length);
    const balancedValues = [bullishHitRate, bearishHitRate].filter(Number.isFinite);
    const signedReturns = directionalCommonRows
      .map((row) => side(row[directionKey]) * Number(row.actual_return))
      .filter(Number.isFinite);
    const scorePairs = rows
      .map((row) => ({
        score: Number(row[scoreKey]),
        excessReturn: Number(row.actual_return) - marketAverage,
      }))
      .filter((row) => Number.isFinite(row.score) && Number.isFinite(row.excessReturn));
    const ic = scorePairs.length > 1
      ? round(spearman(scorePairs.map((row) => row.score), scorePairs.map((row) => row.excessReturn)), 4)
      : null;
    const balanced = round(average(balancedValues));
    return {
      sample_count: rows.length,
      verified_count: rows.length,
      directional_common_sample_count: directionalCommonRows.length,
      bullish_sample_count: bullish.length,
      bearish_sample_count: bearish.length,
      hit_rate: percentage(rows.filter((row) => row[hitKey]).length, rows.length),
      bullish_hit_rate: bullishHitRate,
      bearish_hit_rate: bearishHitRate,
      balanced_weight_accuracy: balanced,
      balanced_directional_accuracy: balanced,
      average_gross_signed_return: round(average(signedReturns)),
      score_vs_market_excess_spearman_ic: ic,
      ic_sample_count: scorePairs.length,
    };
  }

  const v1 = metrics('v1');
  const v2 = metrics('v2');
  return {
    sample_policy: {
      rule: 'All V1/V2 performance metrics use the intersection of stocks evaluable by both versions.',
      common_sample_count: rows.length,
      investment_return_rule: 'Average investment return uses the subset where both V1 and V2 have a non-neutral direction.',
      directional_common_sample_count: directionalCommonRows.length,
      market_benchmark: 'Equal-weight average return of the same common sample.',
    },
    common_sample_count: rows.length,
    directional_common_sample_count: directionalCommonRows.length,
    v1,
    v2,
    deltas: {
      hit_rate: round(v2.hit_rate - v1.hit_rate),
      balanced_weight_accuracy: round(v2.balanced_weight_accuracy - v1.balanced_weight_accuracy),
      balanced_directional_accuracy: round(v2.balanced_directional_accuracy - v1.balanced_directional_accuracy),
      average_gross_signed_return: round(v2.average_gross_signed_return - v1.average_gross_signed_return),
      score_vs_market_excess_spearman_ic: round(v2.score_vs_market_excess_spearman_ic - v1.score_vs_market_excess_spearman_ic, 4),
    },
  };
}

function buildPairedEvaluation(date, v1Predictions, v2Predictions) {
  const v1Dashboard = readJson(path.join(ROOT, 'data_predictions', date, 'replay-dashboard.json'), null);
  const v2Dashboard = readJson(path.join(ROOT, 'data_predictions_v2', date, 'replay-v2.json'), null);
  if (!Array.isArray(v1Dashboard?.rows) || !Array.isArray(v2Dashboard?.rows)) return null;

  const v1Rows = new Map(v1Dashboard.rows
    .filter((row) => row?.verified && row?.actual)
    .map((row) => [String(row.stock_code || row.prediction?.stock_code || ''), row]));
  const v2Rows = new Map(v2Dashboard.rows
    .filter((row) => Number.isFinite(Number(row?.actual_return)))
    .map((row) => [String(row.stock_code || ''), row]));

  const rows = [...v1Rows.keys()]
    .filter((code) => code && v2Rows.has(code) && v1Predictions.has(code) && v2Predictions.has(code))
    .map((code) => {
      const v1Row = v1Rows.get(code);
      const v2Row = v2Rows.get(code);
      const v1Prediction = v1Predictions.get(code);
      const v2Prediction = v2Predictions.get(code);
      const actualReturn = Number(v2Row.actual_return ?? v1Row.actual?.close_return);
      const actual = actualSide(actualReturn);
      const v1Direction = v1Prediction.final_direction_label;
      const v2Direction = v2Prediction.final_direction_label;
      const v1Predicted = side(v1Direction);
      const v2Predicted = side(v2Direction);
      const v1Distance = Math.abs(v1Predicted - actual);
      const v2Distance = Math.abs(v2Predicted - actual);
      const adjustments = v2Prediction.experimental_v2?.adjustments || [];
      const activeAdjustments = adjustments.filter((item) => Number(item.score) !== 0);
      const primaryFactor = activeAdjustments.length
        ? activeAdjustments.map((item) => item.id).join(' + ')
        : v1Direction !== v2Direction ? 'direction_mapping_or_threshold' : 'no_direction_change';
      return {
        stock_code: code,
        stock_name: v2Prediction.stock_name || v1Prediction.stock_name || v2Row.stock_name,
        industry: v2Prediction.industry || v1Prediction.industry || v2Row.industry,
        actual_return: round(actualReturn),
        actual_class: sideLabel(actual),
        v1_score: Number(v1Prediction.direction_score),
        v2_score: Number(v2Prediction.direction_score),
        score_delta: round(Number(v2Prediction.direction_score) - Number(v1Prediction.direction_score)),
        v1_direction: v1Direction,
        v2_direction: v2Direction,
        direction_changed: v1Direction !== v2Direction,
        v1_hit: predictionHit(v1Direction, actualReturn),
        v2_hit: predictionHit(v2Direction, actualReturn),
        closer_version: v1Distance < v2Distance ? 'v1' : v2Distance < v1Distance ? 'v2' : 'tie',
        transition: v1Direction + ' → ' + v2Direction,
        primary_factor: primaryFactor,
        relative_strength_bucket: v2Prediction.experimental_v2?.relative_strength_bucket,
        chip_technical_quadrant: v2Prediction.experimental_v2?.chip_technical_quadrant,
        adjustments,
      };
    });

  const changedRows = rows.filter((row) => row.direction_changed);
  const exact = {
    both_hit: rows.filter((row) => row.v1_hit && row.v2_hit).length,
    v1_only_hit: rows.filter((row) => row.v1_hit && !row.v2_hit).length,
    v2_only_hit: rows.filter((row) => !row.v1_hit && row.v2_hit).length,
    neither_hit: rows.filter((row) => !row.v1_hit && !row.v2_hit).length,
  };
  exact.v1_hit_count = exact.both_hit + exact.v1_only_hit;
  exact.v2_hit_count = exact.both_hit + exact.v2_only_hit;
  exact.v1_hit_rate = percentage(exact.v1_hit_count, rows.length);
  exact.v2_hit_rate = percentage(exact.v2_hit_count, rows.length);
  exact.v2_minus_v1_hit_rate = round(exact.v2_hit_rate - exact.v1_hit_rate);

  const closer = {
    v1_closer: changedRows.filter((row) => row.closer_version === 'v1').length,
    v2_closer: changedRows.filter((row) => row.closer_version === 'v2').length,
    tie: changedRows.filter((row) => row.closer_version === 'tie').length,
  };
  closer.v1_closer_rate = percentage(closer.v1_closer, changedRows.length);
  closer.v2_closer_rate = percentage(closer.v2_closer, changedRows.length);
  closer.v2_minus_v1_count = closer.v2_closer - closer.v1_closer;

  function groupedSummary(key) {
    const groups = new Map();
    for (const row of changedRows) {
      const name = row[key] || 'unknown';
      const item = groups.get(name) || {
        name,
        count: 0,
        v1_closer: 0,
        v2_closer: 0,
        tie: 0,
        both_hit: 0,
        v1_only_hit: 0,
        v2_only_hit: 0,
        neither_hit: 0,
      };
      item.count += 1;
      item[row.closer_version === 'v1' ? 'v1_closer' : row.closer_version === 'v2' ? 'v2_closer' : 'tie'] += 1;
      if (row.v1_hit && row.v2_hit) item.both_hit += 1;
      else if (row.v1_hit) item.v1_only_hit += 1;
      else if (row.v2_hit) item.v2_only_hit += 1;
      else item.neither_hit += 1;
      groups.set(name, item);
    }
    return [...groups.values()].map((item) => ({
      ...item,
      v2_minus_v1_closer: item.v2_closer - item.v1_closer,
      v2_minus_v1_only_hit: item.v2_only_hit - item.v1_only_hit,
    })).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
  }

  return {
    definition: {
      scope: 'Only stocks evaluable by both V1 and V2 are compared.',
      actual_class: '上漲: return > 0.3%; 下跌: return < -0.3%; 中性: |return| <= 0.3%.',
      hit: 'Predicted direction class exactly equals the actual class.',
      closer: 'On direction-changed rows, smaller ordinal distance between predicted class (-1/0/+1) and actual class wins.',
      caveat: 'All performance comparisons use only the intersection of stocks evaluable by both versions. Version-only stocks are retained only for stock-list views.',
    },
    common_evaluable_count: rows.length,
    changed_evaluable_count: changedRows.length,
    actual_distribution: {
      up: rows.filter((row) => row.actual_class === '上漲').length,
      neutral: rows.filter((row) => row.actual_class === '中性').length,
      down: rows.filter((row) => row.actual_class === '下跌').length,
    },
    comparison_metrics: buildCommonMetrics(rows),
    exact_outcome: exact,
    closer_on_changed: closer,
    transition_matrix: groupedSummary('transition'),
    adjustment_effectiveness: groupedSummary('primary_factor'),
    changed_rows: changedRows,
  };
}

function compactVolumeImpact(model) {
  if (!model) return null;
  return {
    threshold: model.selected_threshold,
    volume_covered_count: model.volume_covered_count,
    baseline_hit_rate: model.baseline?.all_sample_hit_rate,
    after_excluding_low_volume_hit_rate: model.after_excluding_low_volume?.all_sample_hit_rate,
    hit_rate_delta: model.impact?.all_sample_hit_rate_delta,
    removed_count: model.impact?.removed_count,
    removed_hit_count: model.impact?.removed_hit_count,
    removed_miss_count: model.impact?.removed_miss_count,
    retained_coverage_rate: model.impact?.retained_coverage_rate,
    interpretation: model.impact?.interpretation,
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
  const volumeImpact = readJson(path.join(ROOT, 'data_prediction_analysis', date, 'volume-filter-impact.json'), null);
  const pairedEvaluation = buildPairedEvaluation(date, v1, v2);
  const payload = {
    comparison_version: '2.0.0',
    generated_at: new Date().toISOString(),
    forecast_date: date,
    shared_prediction_count: shared.length,
    prediction_universe: {
      comparison_policy: 'performance_uses_shared_evaluable_intersection',
      v1_prediction_count: v1.size,
      v2_prediction_count: v2.size,
      shared_prediction_count: shared.length,
      v1_only_count: [...v1.keys()].filter((code) => !v2.has(code)).length,
      v2_only_count: [...v2.keys()].filter((code) => !v1.has(code)).length,
      v1_only_stock_codes: [...v1.keys()].filter((code) => !v2.has(code)).sort(),
      v2_only_stock_codes: [...v2.keys()].filter((code) => !v1.has(code)).sort(),
    },
    forecast_difference: {
      changed_direction_count: changed.length,
      changed_direction_rate: round(shared.length ? changed.length / shared.length * 100 : null),
      average_score_delta: round(average(differences.map((row) => row.score_delta))),
      changed_examples: changed.slice(0, 200),
    },
    accuracy_comparison: pairedEvaluation?.comparison_metrics ? {
      ...pairedEvaluation.comparison_metrics,
      v1: {
        ...pairedEvaluation.comparison_metrics.v1,
        low_volume_filter_impact: compactVolumeImpact(volumeImpact?.models?.v1),
      },
      v2: {
        ...pairedEvaluation.comparison_metrics.v2,
        numeric_error: v2Replay?.numeric_error,
        low_volume_filter_impact: compactVolumeImpact(volumeImpact?.models?.v2),
      },
      deltas: {
        ...pairedEvaluation.comparison_metrics.deltas,
        low_volume_filtered_hit_rate: volumeImpact
          ? round(volumeImpact.models?.v2?.after_excluding_low_volume?.all_sample_hit_rate
            - volumeImpact.models?.v1?.after_excluding_low_volume?.all_sample_hit_rate)
          : null,
      },
    } : null,
    paired_evaluation: pairedEvaluation,
    volume_filter_comparison: volumeImpact ? {
      definition: volumeImpact.definition,
      v1: compactVolumeImpact(volumeImpact.models?.v1),
      v2: compactVolumeImpact(volumeImpact.models?.v2),
      source_file: `data_prediction_analysis/${date}/volume-filter-impact.json`,
    } : null,
    status: pairedEvaluation?.comparison_metrics ? 'accuracy_available_common_sample' : 'forecast_only_waiting_for_actual_market_data',
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
    pairedEvaluation
      ? '共同判分樣本 ' + pairedEvaluation.common_evaluable_count + ' 筆；方向改變 ' + pairedEvaluation.changed_evaluable_count + ' 筆，其中 V1 較接近 ' + pairedEvaluation.closer_on_changed.v1_closer + ' 筆、V2 較接近 ' + pairedEvaluation.closer_on_changed.v2_closer + ' 筆。'
      : '尚未產生共同判分分析。',
    '',
    payload.accuracy_comparison
      ? `V1 命中率 ${payload.accuracy_comparison.v1.hit_rate}%；V2 命中率 ${payload.accuracy_comparison.v2.hit_rate}%；差異 ${payload.accuracy_comparison.deltas.hit_rate >= 0 ? '+' : ''}${payload.accuracy_comparison.deltas.hit_rate}%。`
      : '尚未取得結果日行情；目前只比較兩版預測輸出差異。',
    '',
    payload.volume_filter_comparison
      ? `排除20日量比 ≤ ${payload.volume_filter_comparison.definition.selected_low_volume_threshold} 後：V1 ${payload.volume_filter_comparison.v1.after_excluding_low_volume_hit_rate}%（差 ${payload.volume_filter_comparison.v1.hit_rate_delta >= 0 ? '+' : ''}${payload.volume_filter_comparison.v1.hit_rate_delta}），V2 ${payload.volume_filter_comparison.v2.after_excluding_low_volume_hit_rate}%（差 ${payload.volume_filter_comparison.v2.hit_rate_delta >= 0 ? '+' : ''}${payload.volume_filter_comparison.v2.hit_rate_delta}）。`
      : '尚未產生成交量排除測試。',
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
