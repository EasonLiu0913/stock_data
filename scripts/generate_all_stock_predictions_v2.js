#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const V1_DIR = path.join(ROOT, 'data_predictions');
const V2_DIR = path.join(ROOT, 'data_predictions_v2');
const STOCK_LIST = path.join(ROOT, 'data_twse', 'twse_industry_Stock.json');
const METHOD_VERSION = '2.0.0-experimental';

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

function round(value, digits = 2) {
  return Number.isFinite(value) ? Number(value.toFixed(digits)) : null;
}

function sign(value, threshold = 0) {
  if (!Number.isFinite(value) || Math.abs(value) <= threshold) return 0;
  return value > 0 ? 1 : -1;
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

function v2DirectionLabel(score) {
  if (!Number.isFinite(score)) return null;
  if (score >= 6) return '偏多';
  if (score >= 3) return '中性偏多';
  if (score >= -2) return '中性';
  if (score >= -5) return '中性偏空';
  return '偏空';
}

function directionSide(label) {
  if (String(label || '').includes('偏多')) return 1;
  if (String(label || '').includes('偏空')) return -1;
  return 0;
}

function isOverextended(features, side) {
  const rsi = Number(features?.rsi14);
  const gap = Number(features?.gap_sma20);
  if (side > 0) return (Number.isFinite(rsi) && rsi >= 70) || (Number.isFinite(gap) && gap >= 15);
  if (side < 0) return (Number.isFinite(rsi) && rsi <= 30) || (Number.isFinite(gap) && gap <= -15);
  return false;
}

function relativeStrengthBucket(value) {
  if (!Number.isFinite(value)) return 'missing';
  if (value <= -6) return 'extreme_weak';
  if (value <= -3) return 'moderate_weak';
  if (value < 3) return 'neutral';
  if (value < 6) return 'moderate_strong';
  return 'extreme_strong';
}

function relativeStrengthAdjustment(features) {
  const value = Number(features?.relative_strength);
  const bucket = relativeStrengthBucket(value);
  if (!Number.isFinite(value) || bucket === 'neutral') return { score: 0, bucket, rule: 'no_relative_strength_adjustment' };

  const side = value > 0 ? 1 : -1;
  const overextended = isOverextended(features, side);
  if (bucket === 'moderate_strong' || bucket === 'moderate_weak') {
    return {
      score: overextended ? 0 : side,
      bucket,
      rule: overextended ? 'confirmation_blocked_by_overextension' : 'relative_strength_confirmation_only',
    };
  }
  return {
    score: overextended ? -side : 0,
    bucket,
    rule: overextended ? 'extreme_relative_strength_mean_reversion_penalty' : 'extreme_relative_strength_no_direct_bonus',
  };
}

function sumScoreItems(payload, names) {
  return (payload?.view?.scores || [])
    .filter((item) => names.includes(item.item) && Number.isFinite(Number(item.score)))
    .reduce((sum, item) => sum + Number(item.score), 0);
}

function technicalSignal(payload) {
  return sumScoreItems(payload, ['單日報酬', 'SMA20', '日內報酬', '量價', '三日報酬']);
}

function chipSignal(payload) {
  const institutional = Number(payload?.features?.institutional_ratio);
  const main = Number(payload?.features?.main_net_ratio);
  let score = 0;
  if (Number.isFinite(institutional)) score += institutional >= 3 ? 1 : institutional <= -3 ? -1 : 0;
  if (Number.isFinite(main)) score += main >= 2 ? 1 : main <= -2 ? -1 : 0;
  return score;
}

function chipTechnicalInteraction(payload) {
  const technical = technicalSignal(payload);
  const chip = chipSignal(payload);
  const technicalSide = sign(technical, 0.5);
  const chipSide = sign(chip, 0);
  let quadrant = 'neither';
  if (chipSide && technicalSide) quadrant = chipSide === technicalSide ? 'both_aligned' : 'conflict';
  else if (chipSide) quadrant = 'chip_only';
  else if (technicalSide) quadrant = 'technical_only';

  if (quadrant === 'both_aligned' && Math.abs(technical) >= 2 && !isOverextended(payload.features, technicalSide)) {
    return { score: technicalSide, quadrant, chip_score: chip, technical_score: technical, rule: 'strong_independent_alignment_bonus' };
  }
  if (quadrant === 'conflict') {
    return { score: chipSide, quadrant, chip_score: chip, technical_score: technical, rule: 'chip_counterweight_for_technical_conflict' };
  }
  return { score: 0, quadrant, chip_score: chip, technical_score: technical, rule: 'no_interaction_bonus' };
}

function removeLegacyRelativeStrengthScore(payload) {
  return (payload?.view?.scores || [])
    .filter((item) => item.item === '相對強弱')
    .reduce((sum, item) => sum + (Number(item.score) || 0), 0);
}

function downgradeForRisk(label, combinedRisk) {
  if (!Number.isFinite(Number(combinedRisk)) || Number(combinedRisk) < 4) return label;
  if (label === '偏多') return '中性偏多';
  if (label === '偏空') return '中性偏空';
  return label;
}

function transformPrediction(source) {
  const sourceScore = Number(source.direction_score) || 0;
  const legacyRelative = removeLegacyRelativeStrengthScore(source);
  const relative = relativeStrengthAdjustment(source.features || {});
  const interaction = chipTechnicalInteraction(source);
  const score = sourceScore - legacyRelative + relative.score + interaction.score;
  const raw = v2DirectionLabel(score);
  const final = downgradeForRisk(raw, source.combined_risk_score);
  const adjustments = [
    {
      id: 'remove_legacy_relative_strength',
      score: -legacyRelative,
      explanation: '移除 V1 對相對強弱直接給予的線性分數。',
    },
    {
      id: 'nonlinear_relative_strength',
      score: relative.score,
      explanation: relative.rule,
    },
    {
      id: 'chip_technical_interaction',
      score: interaction.score,
      explanation: interaction.rule,
    },
  ].filter((item) => item.score !== 0 || item.id !== 'remove_legacy_relative_strength');

  const v2Scores = [
    ...(source?.view?.scores || []).filter((item) => item.item !== '相對強弱'),
    {
      item: 'V2 相對強勢校準',
      value: `${round(Number(source?.features?.relative_strength)) ?? 'NA'}% / ${relative.bucket}`,
      rule: relative.rule,
      score: relative.score,
    },
    {
      item: 'V2 籌碼技術交互',
      value: `${interaction.quadrant}；chip=${interaction.chip_score}；technical=${interaction.technical_score}`,
      rule: interaction.rule,
      score: interaction.score,
    },
  ];

  return {
    ...source,
    methodology_version: METHOD_VERSION,
    source_methodology_version: source.methodology_version || null,
    source_prediction_path: `data_predictions/${compactDate(source.forecast_date)}/${source.stock_code}.json`,
    generated_at: new Date().toISOString(),
    direction_score: score,
    raw_direction_label: raw,
    final_direction_label: final,
    experimental_v2: {
      status: 'shadow_only_do_not_replace_v1',
      threshold_policy: 'symmetric_6_3_2_5',
      source_direction_score: sourceScore,
      score_delta: score - sourceScore,
      relative_strength_bucket: relative.bucket,
      relative_strength_rule: relative.rule,
      chip_technical_quadrant: interaction.quadrant,
      chip_signal_score: interaction.chip_score,
      technical_signal_score: interaction.technical_score,
      adjustments,
    },
    view: {
      ...(source.view || {}),
      lead: `V2 shadow experiment ${METHOD_VERSION}；以 V1 同一份截止資料獨立重算，不覆寫正式預測。`,
      scores: v2Scores,
      forecast_cards: (source?.view?.forecast_cards || []).map((card) => card.label === '方向分數'
        ? { ...card, value: String(score), description: `${raw}；V1=${sourceScore}` }
        : card),
      data_note: `${source?.view?.data_note || ''} V2 採對稱門檻、相對強勢非線性校準與籌碼×技術交互效果。`.trim(),
    },
  };
}

function countBy(rows, selector) {
  const counts = {};
  for (const row of rows) {
    const key = selector(row) || 'unknown';
    counts[key] = (counts[key] || 0) + 1;
  }
  return counts;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log('Usage: node scripts/generate_all_stock_predictions_v2.js [--date YYYYMMDD]');
    return;
  }
  const rootManifest = readJson(path.join(V1_DIR, 'manifest.json'), null);
  const date = args.date || compactDate(rootManifest?.latest_date || rootManifest?.forecast_date_compact);
  if (!/^20\d{6}$/.test(date)) throw new Error('Unable to resolve V1 forecast date');
  const sourceDir = path.join(V1_DIR, date);
  const sourceManifest = readJson(path.join(sourceDir, 'manifest.json'), rootManifest);
  if (!sourceManifest) throw new Error(`Missing V1 manifest for ${date}`);

  const outputDir = path.join(V2_DIR, date);
  fs.rmSync(outputDir, { recursive: true, force: true });
  fs.mkdirSync(outputDir, { recursive: true });
  const stockList = readJson(STOCK_LIST, {});
  const files = fs.readdirSync(sourceDir).filter((file) => /^\d{4,6}\.json$/.test(file)).sort();
  const transformed = [];

  for (const file of files) {
    const source = readJson(path.join(sourceDir, file), null);
    if (!source?.stock_code) continue;
    const output = transformPrediction(source);
    output.industry = stockList?.[String(output.stock_code)]?.Industry || stockList?.[String(output.stock_code)]?.industry || null;
    writeJson(path.join(outputDir, file), output);
    transformed.push(output);
  }

  for (const supporting of ['market-snapshot.json', 'missing-data-stocks.json', 'input-validation.json', 'generation-status.txt', 'generation.log']) {
    const source = path.join(sourceDir, supporting);
    if (fs.existsSync(source)) fs.copyFileSync(source, path.join(outputDir, supporting));
  }

  const changed = transformed.filter((row) => row.final_direction_label !== readJson(path.join(sourceDir, `${row.stock_code}.json`), {})?.final_direction_label);
  const summary = {
    methodology_version: METHOD_VERSION,
    generated_at: new Date().toISOString(),
    forecast_date: sourceManifest.forecast_date,
    base_trade_date: sourceManifest.base_trade_date,
    source_methodology_version: sourceManifest.methodology_version,
    source_directory: `data_predictions/${date}`,
    output_directory: `data_predictions_v2/${date}`,
    total_predictions: transformed.length,
    changed_direction_count: changed.length,
    changed_direction_rate: round(transformed.length ? changed.length / transformed.length * 100 : null),
    direction_distribution: countBy(transformed, (row) => row.final_direction_label),
    relative_strength_buckets: countBy(transformed, (row) => row.experimental_v2.relative_strength_bucket),
    chip_technical_quadrants: countBy(transformed, (row) => row.experimental_v2.chip_technical_quadrant),
    score_delta_distribution: countBy(transformed, (row) => {
      const delta = row.experimental_v2.score_delta;
      return delta < -1 ? 'below_-1' : delta === -1 ? '-1' : delta === 0 ? '0' : delta === 1 ? '+1' : 'above_+1';
    }),
    changed_examples: changed.slice(0, 100).map((row) => ({
      stock_code: row.stock_code,
      stock_name: row.stock_name,
      v1_score: row.experimental_v2.source_direction_score,
      v2_score: row.direction_score,
      v2_direction: row.final_direction_label,
      adjustments: row.experimental_v2.adjustments,
    })),
  };
  writeJson(path.join(outputDir, 'summary-v2.json'), summary);

  const previous = readJson(path.join(V2_DIR, 'manifest.json'), {});
  const availableDates = [...new Set([...(previous.available_dates || []), date])].sort();
  const manifest = {
    methodology_version: METHOD_VERSION,
    generated_at: summary.generated_at,
    base_trade_date: sourceManifest.base_trade_date,
    forecast_date: sourceManifest.forecast_date,
    forecast_date_compact: date,
    latest_date: date,
    available_dates: availableDates,
    total_stocks: transformed.length,
    generated_reports: transformed.length,
    source_directory: `data_predictions/${date}`,
    output_directory: `data_predictions_v2/${date}`,
    latest_summary: `data_predictions_v2/${date}/summary-v2.json`,
  };
  writeJson(path.join(outputDir, 'manifest.json'), manifest);
  writeJson(path.join(V2_DIR, 'manifest.json'), manifest);
  console.log(JSON.stringify({ date, generated: transformed.length, changed: changed.length }, null, 2));
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
  chipSignal,
  chipTechnicalInteraction,
  directionSide,
  isOverextended,
  relativeStrengthAdjustment,
  relativeStrengthBucket,
  technicalSignal,
  transformPrediction,
  v2DirectionLabel,
};
