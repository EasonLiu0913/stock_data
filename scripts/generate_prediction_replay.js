#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

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

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function loadForecastSnapshot(stock, predictionDate) {
  const relativeFile = stock.json_file || `${compactDate(predictionDate)}/${stock.stock_code}.json`;
  const file = path.resolve(PREDICTION_DIR, relativeFile);
  const relativeToPredictionDir = path.relative(PREDICTION_DIR, file);
  if (relativeToPredictionDir.startsWith('..') || path.isAbsolute(relativeToPredictionDir)) {
    throw new Error(`Forecast JSON escapes data_predictions: ${relativeFile}`);
  }
  const raw = fs.readFileSync(file, 'utf8');
  const payload = JSON.parse(raw);
  const actualHash = sha256(raw);
  const expectedHash = stock.forecast_source_sha256 || null;
  return {
    source_file: path.relative(ROOT, file),
    source_sha256: actualHash,
    expected_source_sha256: expectedHash,
    integrity_status: expectedHash === null
      ? 'unavailable_preexisting_summary'
      : expectedHash === actualHash
        ? 'verified'
        : 'mismatch',
    captured_at: new Date().toISOString(),
    payload,
  };
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

function rawDirectionLabel(score) {
  if (!Number.isFinite(score)) return null;
  if (score >= 5) return '偏多';
  if (score >= 2) return '中性偏多';
  if (score >= -1) return '中性';
  if (score >= -4) return '中性偏空';
  return '偏空';
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

function matchPrediction(stock, metrics, mood) {
  const side = directionSide(stock.final_direction_label);
  let directionAccuracy = 'neutral';
  let moodAccuracy = 'neutral';
  let label = '中性難判';

  if (side === 'bullish') {
    directionAccuracy = metrics.close_return > 0 ? 'hit' : metrics.close_return < 0 ? 'miss' : 'neutral';
    moodAccuracy = mood.score >= 2 ? 'hit' : mood.score <= -2 ? 'miss' : 'neutral';
  } else if (side === 'bearish') {
    directionAccuracy = metrics.close_return < 0 ? 'hit' : metrics.close_return > 0 ? 'miss' : 'neutral';
    moodAccuracy = mood.score <= -2 ? 'hit' : mood.score >= 2 ? 'miss' : 'neutral';
  } else {
    directionAccuracy = Math.abs(metrics.close_return) <= 0.3 ? 'hit' : 'miss';
    moodAccuracy = Math.abs(mood.score) <= 1 ? 'hit' : 'neutral';
  }

  if (directionAccuracy === 'hit' && moodAccuracy === 'hit') label = '明顯準確';
  else if (directionAccuracy === 'hit') label = '大致準確';
  else if (directionAccuracy === 'miss' && moodAccuracy === 'miss') label = '明顯不準';
  else if (directionAccuracy === 'miss') label = '大致不準';
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

function numericValues(value) {
  return String(value ?? '')
    .match(/-?\d[\d,]*(?:\.\d+)?/g)
    ?.map((item) => Number(item.replaceAll(',', '')))
    .filter(Number.isFinite) || [];
}

function forecastTargets(snapshotPayload, actualRow) {
  const scenarios = (snapshotPayload?.view?.scenarios || []).map((scenario) => {
    const values = numericValues(scenario.target);
    const lower = values.length >= 2 ? Math.min(values[0], values[1]) : null;
    const upper = values.length >= 2 ? Math.max(values[0], values[1]) : null;
    return {
      ...scenario,
      lower,
      upper,
      close_inside: Number.isFinite(lower) && Number.isFinite(upper)
        ? actualRow.close >= lower && actualRow.close <= upper
        : null,
      actual_range_overlaps: Number.isFinite(lower) && Number.isFinite(upper)
        ? actualRow.high >= lower && actualRow.low <= upper
        : null,
      close_distance_to_range_percent: Number.isFinite(lower) && Number.isFinite(upper)
        ? round(actualRow.close < lower
          ? (lower - actualRow.close) / lower * 100
          : actualRow.close > upper
            ? (actualRow.close - upper) / upper * 100
            : 0)
        : null,
    };
  });

  const levels = (snapshotPayload?.view?.levels || []).map((level) => {
    const price = numericValues(level.price)[0] ?? null;
    const isSupport = String(level.type || '').includes('支撐') || String(level.type || '').includes('下緣');
    const isResistance = String(level.type || '').includes('壓力') || String(level.type || '').includes('上緣');
    const touched = Number.isFinite(price) ? actualRow.low <= price && actualRow.high >= price : null;
    return {
      ...level,
      numeric_price: price,
      touched,
      held: isSupport && Number.isFinite(price) ? actualRow.low <= price && actualRow.close >= price : null,
      broken: isSupport && Number.isFinite(price) ? actualRow.close < price : null,
      rejected: isResistance && Number.isFinite(price) ? actualRow.high >= price && actualRow.close < price : null,
      closed_above: isResistance && Number.isFinite(price) ? actualRow.close > price : null,
    };
  });

  return {
    scenarios,
    levels,
    any_scenario_close_hit: scenarios.some((item) => item.close_inside === true),
    any_scenario_range_overlap: scenarios.some((item) => item.actual_range_overlaps === true),
  };
}

function scoreAttribution(snapshotPayload) {
  const directionScore = snapshotPayload?.direction_score;
  const predictedSide = directionSide(snapshotPayload?.final_direction_label);
  return (snapshotPayload?.view?.scores || [])
    .filter((item) => Number.isFinite(item.score) && item.score !== 0)
    .map((item) => {
      const factorSide = item.score > 0 ? 'bullish' : 'bearish';
      const scoreWithoutFactor = Number.isFinite(directionScore) ? directionScore - item.score : null;
      return {
        item: item.item,
        observed_value: item.value,
        rule: item.rule,
        score: item.score,
        factor_side: factorSide,
        relationship_to_prediction: factorSide === predictedSide ? 'supports' : 'contradicts',
        score_without_factor: scoreWithoutFactor,
        raw_label_without_factor: rawDirectionLabel(scoreWithoutFactor),
        raw_label_changed: Number.isFinite(scoreWithoutFactor)
          ? rawDirectionLabel(scoreWithoutFactor) !== snapshotPayload.raw_direction_label
          : null,
      };
    });
}

function predictionTimeFactorStates(stock) {
  const states = [];
  const side = directionSide(stock.final_direction_label);
  if (stock.chip_bias === '偏多' && side === 'bullish') states.push('chip_aligned');
  if (stock.chip_bias === '偏空' && side === 'bearish') states.push('chip_aligned');
  if (stock.chip_bias === '偏空' && side === 'bullish') states.push('chip_conflicted');
  if (stock.chip_bias === '偏多' && side === 'bearish') states.push('chip_conflicted');
  if (stock.market_context_risk_label === '高風險' || stock.combined_risk_label === '高風險') states.push('high_risk_context');
  if (stock.data_completeness >= 80 && !(stock.missing_data || []).length) states.push('high_data_completeness');
  if (stock.relative_strength_7d?.relative_strength_strong) states.push('relative_strength_strong');
  if ((stock.reversal_signals?.tags || []).length) states.push('reversal_signal_present');
  if (stock.features?.rsi14 >= 70 || Math.abs(stock.features?.gap_sma20 ?? 0) >= 15) states.push('overextended_before_forecast');
  return states;
}

const CAUSAL_HYPOTHESES = {
  '技術轉強後續強': {
    factor_id: 'reversal_signal_persistence',
    mechanism: '預測日前的技術翻轉延續到下一交易日。',
    counterfactual_test: '移除翻轉訊號分數後重算方向，並比較跨多日命中率。',
  },
  '放量配合方向': {
    factor_id: 'realized_volume_confirmation',
    mechanism: '預測方向在結果日得到成交量確認。',
    counterfactual_test: '分層比較有無結果日放量時的命中率；此項是結果日中介機制，不可作為事前可用因子。',
  },
  '籌碼同步偏多': {
    factor_id: 'chip_alignment',
    mechanism: '預測日前籌碼方向與技術方向一致，可能提高延續性。',
    counterfactual_test: '比較同方向樣本中籌碼一致與不一致的跨日命中率，並控制產業與市場日。',
  },
  '籌碼同步偏空': {
    factor_id: 'chip_alignment',
    mechanism: '預測日前籌碼方向與技術方向一致，可能提高延續性。',
    counterfactual_test: '比較同方向樣本中籌碼一致與不一致的跨日命中率，並控制產業與市場日。',
  },
  '相對強勢有效': {
    factor_id: 'relative_strength_persistence',
    mechanism: '預測日前相對強勢在下一交易日持續。',
    counterfactual_test: '移除相對強弱因子後重算，並比較相同市場環境下的命中差。',
  },
  '低風險高完整度樣本命中': {
    factor_id: 'data_quality_and_low_risk',
    mechanism: '資料完整且個股風險較低時，規則訊號可能較穩定。',
    counterfactual_test: '跨多日比較高完整度低風險與其他樣本，並分開完整度及風險兩個變數。',
  },
  '開高出貨': {
    factor_id: 'intraday_selloff',
    mechanism: '結果日開高後遭遇賣壓，推翻偏多預測。',
    counterfactual_test: '這是已觀察到的直接價格路徑；下一步需連結當日法人、分點、新聞，辨識賣壓來源。',
  },
  '開低承接轉強': {
    factor_id: 'intraday_reversal',
    mechanism: '結果日低開後買盤承接，推翻偏空預測。',
    counterfactual_test: '這是已觀察到的直接價格路徑；下一步需連結當日法人、分點、新聞，辨識承接來源。',
  },
  '放量反殺': {
    factor_id: 'adverse_volume_shock',
    mechanism: '結果日放量朝預測反方向運動，可能代表新資訊或資金流衝擊。',
    counterfactual_test: '連結結果日事件與籌碼資料，並比較無事件的同類樣本。',
  },
  '量能不足': {
    factor_id: 'insufficient_volume_confirmation',
    mechanism: '結果日量能不足，原預測方向沒有足夠交易動能延續。',
    counterfactual_test: '比較相同方向與波動條件下，量比高低組的命中率。',
  },
  '高風險環境干擾': {
    factor_id: 'high_risk_context',
    mechanism: '高市場或綜合風險可能使個股訊號被共同市場衝擊蓋過。',
    counterfactual_test: '跨多個市場日做市場日固定效果或配對比較，避免把同一天的共同跌漲誤認為個股因果。',
  },
  '籌碼與技術矛盾': {
    factor_id: 'chip_technical_conflict',
    mechanism: '預測日前籌碼與技術方向不一致，反向籌碼可能使技術訊號失效。',
    counterfactual_test: '比較技術方向相同但籌碼一致／衝突的樣本，並做移除籌碼因子的重算。',
  },
  '預測時資料缺漏': {
    factor_id: 'missing_prediction_inputs',
    mechanism: '預測輸入缺漏可能讓分數低估關鍵反向資訊。',
    counterfactual_test: '只在後續可補回當時可得資料時重建預測，禁止使用截止時間後資料。',
  },
  '前一日過熱反轉': {
    factor_id: 'pre_forecast_overextension',
    mechanism: '預測日前乖離或 RSI 過熱，隔日均值回歸可能推翻延續預測。',
    counterfactual_test: '在相同方向分數內比較過熱與非過熱樣本，並測試過熱降級規則。',
  },
};

function causalAnalysis(stock, snapshotPayload, patternTags, match) {
  const reasons = reasonTags(stock, patternTags, match);
  const isAccurate = match.prediction_match_label.includes('準確');
  const isInaccurate = match.prediction_match_label.includes('不準');
  const attribution = scoreAttribution(snapshotPayload);
  const contradictingScores = attribution
    .filter((item) => item.relationship_to_prediction === 'contradicts')
    .map((item) => `${item.item}（${item.score > 0 ? '+' : ''}${item.score}）`);
  const candidates = reasons
    .map((tag) => ({ tag, ...CAUSAL_HYPOTHESES[tag] }))
    .filter((item) => item.factor_id)
    .map((item) => ({
      ...item,
      role: isAccurate ? 'success_candidate' : isInaccurate ? 'failure_candidate' : 'unresolved',
      evidence_status: item.factor_id === 'intraday_selloff' || item.factor_id === 'intraday_reversal'
        ? 'observed_immediate_mechanism'
        : 'hypothesis',
      causal_confidence: item.factor_id === 'intraday_selloff' || item.factor_id === 'intraday_reversal'
        ? 'medium_for_immediate_path_low_for_root_cause'
        : 'low_until_cross_day_test',
      supporting_evidence: [
        `覆盤規則觀察到「${item.tag}」`,
        `方向判定：${match.direction_accuracy}；氛圍判定：${match.mood_accuracy}`,
      ],
      counterevidence: contradictingScores.length
        ? [`事前有反向計分：${contradictingScores.join('、')}`]
        : ['目前未從逐項計分找到明確反證；仍可能有未觀測混淆因素。'],
      missing_evidence: [
        '結果日法人、券商分點、產業與市場同步資料的時間序列連結',
        '跨多個預測日的配對樣本或因子移除結果',
      ],
    }));
  return {
    claim_level: 'causal_hypotheses_not_proven_causes',
    prediction_time_factor_states: predictionTimeFactorStates(stock),
    score_attribution: attribution,
    candidate_causes: candidates,
    limitations: [
      '單一股票單一交易日只能提出候選機制，不能單獨識別根本因果。',
      '結果日型態是結果或中介機制，不可倒灌成事前預測特徵。',
      '需要跨多個預測日、配對或因子移除實驗，才能提高因果可信度。',
    ],
  };
}

function buildReplayRow(stock, forecastSnapshot, baseRow, actualRow, volumeHistory, actualDate) {
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
  const match = matchPrediction(stock, metrics, mood);
  const targets = forecastTargets(forecastSnapshot.payload, actualRow);

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
    prediction_snapshot: forecastSnapshot,
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
    forecast_target_evaluation: targets,
    ...match,
    reason_tags: reasonTags(stock, patternTags, match),
    causal_analysis: causalAnalysis(stock, forecastSnapshot.payload, patternTags, match),
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

function factorAssociations(rows) {
  const verified = rows.filter((row) => row.verified);
  const factors = [...new Set(verified.flatMap((row) => row.causal_analysis?.prediction_time_factor_states || []))];
  return factors.map((factor) => {
    const exposed = verified.filter((row) => row.causal_analysis.prediction_time_factor_states.includes(factor));
    const unexposed = verified.filter((row) => !row.causal_analysis.prediction_time_factor_states.includes(factor));
    const exposedHitRate = ratio(exposed, (row) => row.prediction_match_label.includes('準確'));
    const unexposedHitRate = ratio(unexposed, (row) => row.prediction_match_label.includes('準確'));
    return {
      factor,
      exposed_count: exposed.length,
      unexposed_count: unexposed.length,
      exposed_hit_rate: round(exposedHitRate),
      unexposed_hit_rate: round(unexposedHitRate),
      hit_rate_difference: Number.isFinite(exposedHitRate) && Number.isFinite(unexposedHitRate)
        ? round(exposedHitRate - unexposedHitRate)
        : null,
      evidence_status: exposed.length >= 30 && unexposed.length >= 30
        ? 'exploratory_association'
        : 'insufficient_sample',
      causal_interpretation: '不可直接解讀為因果；須累積跨日資料並進行配對或因子移除測試。',
    };
  }).sort((left, right) => Math.abs(right.hit_rate_difference ?? 0) - Math.abs(left.hit_rate_difference ?? 0));
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
    loadForecastSnapshot(stock, predictionDate),
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
    snapshot_integrity: {
      verified_count: rows.filter((row) => row.prediction_snapshot?.integrity_status === 'verified').length,
      mismatch_count: rows.filter((row) => row.prediction_snapshot?.integrity_status === 'mismatch').length,
      unavailable_count: rows.filter((row) => row.prediction_snapshot?.integrity_status === 'unavailable_preexisting_summary').length,
    },
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
    prediction_time_factor_associations: factorAssociations(verified),
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
    causal_hypotheses: groupBy(obviousMisses, (row) => (row.causal_analysis?.candidate_causes || [])
      .map((item) => item.factor_id)),
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

if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
}

module.exports = {
  actualMood,
  actualPattern,
  buildReplayRow,
  causalAnalysis,
  factorAssociations,
  forecastTargets,
  matchPrediction,
  scoreAttribution,
};
