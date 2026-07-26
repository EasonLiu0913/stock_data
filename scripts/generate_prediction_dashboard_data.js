#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const PREDICTION_DIR = path.join(ROOT, 'data_predictions');
const INDUSTRY_FILE = path.join(ROOT, 'data_twse', 'twse_industry_Stock.json');
const PRICE_DIR = path.join(ROOT, 'data_fubon');
const MI_INDEX_DIR = path.join(ROOT, 'data_twse_mi_index');

function readJson(file, fallback = null) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return fallback;
  }
}

function round(value, digits = 2) {
  return Number.isFinite(value) ? Number(value.toFixed(digits)) : null;
}

function pct(current, previous) {
  return Number.isFinite(current) && Number.isFinite(previous) && previous !== 0
    ? (current / previous - 1) * 100
    : null;
}

function compactDate(iso) {
  return String(iso || '').replaceAll('-', '');
}

function latestPredictionDirectory() {
  const manifest = readJson(path.join(PREDICTION_DIR, 'manifest.json'), null);
  if (manifest?.output_directory) return path.join(ROOT, manifest.output_directory);
  const dirs = fs.readdirSync(PREDICTION_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && /^20\d{6}$/.test(entry.name))
    .map((entry) => entry.name)
    .sort();
  if (!dirs.length) throw new Error('No prediction date directory found');
  return path.join(PREDICTION_DIR, dirs.at(-1));
}

function num(value) {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(String(value).replaceAll(',', '').trim());
  return Number.isFinite(parsed) ? parsed : null;
}

function listFiles(dir, pattern) {
  try {
    return fs.readdirSync(dir).filter((file) => pattern.test(file)).sort();
  } catch {
    return [];
  }
}

function compactDateFromIso(iso) {
  return String(iso || '').replaceAll('-', '');
}

function parseMarketClose(file) {
  const payload = readJson(file, null);
  if (!payload) return null;
  for (const table of payload.tables || []) {
    const fields = table.fields || [];
    const nameIndex = fields.findIndex((field) => field === '指數' || field === '報酬指數');
    const closeIndex = fields.findIndex((field) => String(field).includes('收盤指數'));
    if (nameIndex < 0 || closeIndex < 0) continue;
    const row = (table.data || []).find((item) => String(item[nameIndex] || '').trim() === '發行量加權股價指數');
    if (!row) continue;
    const close = num(row[closeIndex]);
    if (Number.isFinite(close)) return close;
  }
  return null;
}

function loadMarketHistory(baseTradeDate) {
  const baseCompact = compactDateFromIso(baseTradeDate);
  return listFiles(MI_INDEX_DIR, /^\d{8}_twse_mi_index\.json$/)
    .map((file) => ({ file, date: file.slice(0, 8) }))
    .filter((item) => !baseCompact || item.date <= baseCompact)
    .map((item) => ({
      date: `${item.date.slice(0, 4)}-${item.date.slice(4, 6)}-${item.date.slice(6, 8)}`,
      close: parseMarketClose(path.join(MI_INDEX_DIR, item.file))
    }))
    .filter((item) => Number.isFinite(item.close))
    .sort((left, right) => left.date.localeCompare(right.date));
}

function windowReturn(rows, periods = 7) {
  if (!Array.isArray(rows) || rows.length <= periods) return null;
  const current = rows.at(-1);
  const previous = rows.at(-(periods + 1));
  return pct(current?.close, previous?.close);
}

function relativeStrength7d(stockRows, marketRows) {
  const stockReturn = windowReturn(stockRows, 7);
  const marketReturn = windowReturn(marketRows, 7);
  const spread = Number.isFinite(stockReturn) && Number.isFinite(marketReturn) ? stockReturn - marketReturn : null;
  const mode = Number.isFinite(marketReturn) && marketReturn < 0 ? '大盤跌勢抗跌' : '大盤漲勢領漲';
  const isStrong = Number.isFinite(spread) && spread >= 3 && (marketReturn < 0 ? stockReturn >= -3 : stockReturn > marketReturn);
  return {
    stock_return_7d: round(stockReturn),
    market_return_7d: round(marketReturn),
    relative_strength_7d: round(spread),
    relative_strength_mode: Number.isFinite(marketReturn) ? mode : '資料不足',
    relative_strength_strong: Boolean(isStrong),
  };
}

function loadPriceHistory() {
  const files = listFiles(PRICE_DIR, /^fubon_20\d{6}_sma\.json$/).slice(-90);
  const history = new Map();
  for (const file of files) {
    const data = readJson(path.join(PRICE_DIR, file), {});
    for (const [code, item] of Object.entries(data || {})) {
      const dateKeys = Object.keys(item || {}).filter((key) => /^20\d{2}[/-]\d{2}[/-]\d{2}$/.test(key)).sort();
      for (const dateKey of dateKeys) {
        const row = item[dateKey] || {};
        const parsed = {
          date: dateKey.replaceAll('/', '-'),
          close: num(row.Price ?? row.Close),
          open: num(row.Open),
          high: num(row.High),
          low: num(row.Low),
          volume: num(row.Volume),
          sma5: num(row.SMA5),
          sma20: num(row.SMA20),
          sma60: num(row.SMA60),
        };
        if ([parsed.close, parsed.high, parsed.low].every(Number.isFinite)) {
          if (!history.has(code)) history.set(code, new Map());
          history.get(code).set(parsed.date, parsed);
        }
      }
    }
  }
  return new Map([...history.entries()].map(([code, rows]) => [code, [...rows.values()].sort((a, b) => a.date.localeCompare(b.date))]));
}

function ema(values, period) {
  const output = [];
  const alpha = 2 / (period + 1);
  let previous = null;
  for (const value of values) {
    previous = previous === null ? value : value * alpha + previous * (1 - alpha);
    output.push(previous);
  }
  return output;
}

function calculateMacd(rows) {
  if (rows.length < 35) return null;
  const closes = rows.map((row) => row.close);
  const ema12 = ema(closes, 12);
  const ema26 = ema(closes, 26);
  const macd = closes.map((_, index) => ema12[index] - ema26[index]);
  const signal = ema(macd, 9);
  const histogram = macd.map((value, index) => value - signal[index]);
  const last = macd.length - 1;
  const prev = last - 1;
  return {
    macd: macd[last],
    signal: signal[last],
    histogram: histogram[last],
    bullish_cross: macd[prev] <= signal[prev] && macd[last] > signal[last],
    histogram_improving: histogram[last] > histogram[prev],
    histogram_positive_turn: histogram[prev] <= 0 && histogram[last] > 0,
  };
}

function calculateKd(rows) {
  if (rows.length < 10) return null;
  let k = 50;
  let d = 50;
  let previousK = k;
  let previousD = d;
  for (let index = 8; index < rows.length; index += 1) {
    previousK = k;
    previousD = d;
    const window = rows.slice(index - 8, index + 1);
    const high = Math.max(...window.map((row) => row.high));
    const low = Math.min(...window.map((row) => row.low));
    const rsv = high === low ? 50 : (rows[index].close - low) / (high - low) * 100;
    k = k * 2 / 3 + rsv / 3;
    d = d * 2 / 3 + k / 3;
  }
  return {
    k,
    d,
    bullish_cross: previousK <= previousD && k > d,
    oversold_turn: previousK < 25 && k > previousK,
  };
}

function calculateRsiValues(rows, period = 14) {
  if (!rows || rows.length <= period) return [];
  const output = Array(rows.length).fill(null);
  let gain = 0;
  let loss = 0;
  for (let index = 1; index <= period; index += 1) {
    const change = rows[index].close - rows[index - 1].close;
    if (change >= 0) gain += change;
    else loss -= change;
  }
  let averageGain = gain / period;
  let averageLoss = loss / period;
  output[period] = averageLoss === 0 ? 100 : 100 - 100 / (1 + averageGain / averageLoss);
  for (let index = period + 1; index < rows.length; index += 1) {
    const change = rows[index].close - rows[index - 1].close;
    averageGain = (averageGain * (period - 1) + Math.max(change, 0)) / period;
    averageLoss = (averageLoss * (period - 1) + Math.max(-change, 0)) / period;
    output[index] = averageLoss === 0 ? 100 : 100 - 100 / (1 + averageGain / averageLoss);
  }
  return output;
}

function averageNumber(values) {
  const valid = values.filter(Number.isFinite);
  return valid.length ? valid.reduce((sum, value) => sum + value, 0) / valid.length : null;
}

function rangePercent(rows) {
  if (!rows?.length) return null;
  const highs = rows.map((row) => row.high).filter(Number.isFinite);
  const lows = rows.map((row) => row.low).filter(Number.isFinite);
  if (!highs.length || !lows.length) return null;
  const high = Math.max(...highs);
  const low = Math.min(...lows);
  return low > 0 ? (high / low - 1) * 100 : null;
}

function averageDailyRange(rows) {
  return averageNumber(rows.map((row) => Number.isFinite(row.high) && Number.isFinite(row.low) && Number.isFinite(row.close) && row.close > 0
    ? (row.high - row.low) / row.close * 100
    : null));
}

function maCompressionPercent(row) {
  const values = [row?.sma5, row?.sma20, row?.sma60].filter(Number.isFinite);
  if (values.length < 3) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  return min > 0 ? (max / min - 1) * 100 : null;
}

function nearHighPercent(close, rows) {
  const highs = rows.map((row) => row.high).filter(Number.isFinite);
  if (!Number.isFinite(close) || !highs.length) return null;
  const high = Math.max(...highs);
  return high > 0 ? (high / close - 1) * 100 : null;
}

function consolidationStrength(rows, stock) {
  const empty = {
    tag: '多日盤整+趨勢轉強',
    matched: false,
    consolidation_score: 0,
    strengthening_score: 0,
    consolidation_reasons: [],
    strengthening_reasons: [],
  };
  if (!rows || rows.length < 25) return empty;

  const current = rows.at(-1);
  const previous = rows.at(-2);
  const fiveAgo = rows.at(-6);
  const recent5 = rows.slice(-5);
  const recent10 = rows.slice(-10);
  const recent20 = rows.slice(-20);
  const prior20 = rows.slice(-21, -1);
  const volumes5 = recent5.map((row) => row.volume);
  const volumes20 = recent20.map((row) => row.volume);
  const avgVolume5 = averageNumber(volumes5);
  const avgVolume20 = averageNumber(volumes20);
  const range5 = averageDailyRange(recent5);
  const range20Daily = averageDailyRange(recent20);
  const range10 = rangePercent(recent10);
  const range20 = rangePercent(recent20);
  const maCompression = maCompressionPercent(current);
  const sma20Slope5 = Number.isFinite(current.sma20) && Number.isFinite(fiveAgo?.sma20) && fiveAgo.sma20 > 0
    ? (current.sma20 / fiveAgo.sma20 - 1) * 100
    : null;
  const near20High = nearHighPercent(current.close, recent20);
  const rsiValues = calculateRsiValues(rows);
  const rsi = stock.features.rsi14 ?? rsiValues.at(-1);
  const rsi3Ago = rsiValues.at(-4);
  const macd = calculateMacd(rows);
  const kd = calculateKd(rows);
  const chip = chipBias(stock);
  const reasons = [];
  const strengthReasons = [];

  addReason(reasons, Number.isFinite(range20) && range20 <= 12, '20日區間收斂');
  addReason(reasons, Number.isFinite(range10) && range10 <= 8, '10日區間收斂');
  addReason(reasons, Number.isFinite(maCompression) && maCompression <= 6, 'SMA5/20/60均線糾結');
  addReason(reasons, Number.isFinite(sma20Slope5) && Math.abs(sma20Slope5) <= 1, 'SMA20斜率平坦');
  addReason(reasons, Number.isFinite(range5) && Number.isFinite(range20Daily) && range5 < range20Daily, '近5日波動收斂');
  addReason(reasons, Number.isFinite(avgVolume5) && Number.isFinite(avgVolume20) && avgVolume5 <= avgVolume20 * 0.9, '近5日量能收斂');
  addReason(reasons, Number.isFinite(rsi) && rsi >= 40 && rsi <= 60, 'RSI中性整理');
  addReason(reasons, !isRecentBreakoutOrBreakdown(current, prior20), '未明顯連續創高破底');

  addReason(strengthReasons, Number.isFinite(current.close) && Number.isFinite(current.sma20) && current.close > current.sma20, '收盤站上SMA20');
  addReason(strengthReasons, Number.isFinite(near20High) && near20High <= 3, '接近20日高點');
  addReason(strengthReasons, Number.isFinite(current.sma5) && Number.isFinite(fiveAgo?.sma5) && current.sma5 > fiveAgo.sma5, 'SMA5斜率轉正');
  addReason(strengthReasons, Number.isFinite(current.sma5) && Number.isFinite(current.sma20) && (current.sma5 > current.sma20 || (current.sma5 / current.sma20 - 1) * 100 >= -1), 'SMA5貼近或站上SMA20');
  addReason(strengthReasons, Number.isFinite(current.volume) && Number.isFinite(avgVolume5) && current.volume > avgVolume5, '成交量高於5日均量');
  addReason(strengthReasons, Number.isFinite(current.volume) && Number.isFinite(avgVolume20) && current.volume >= avgVolume20 * 1.2, '成交量高於20日均量1.2倍');
  addReason(strengthReasons, Boolean(macd?.bullish_cross), 'MACD黃金交叉');
  addReason(strengthReasons, Boolean(macd) && (macd.histogram_positive_turn || macd.histogram_improving || macd.histogram > 0), 'MACD柱狀改善');
  addReason(strengthReasons, Boolean(kd?.bullish_cross), 'KD黃金交叉');
  addReason(strengthReasons, Number.isFinite(rsi) && rsi >= 50, 'RSI站上50');
  addReason(strengthReasons, Number.isFinite(rsi) && Number.isFinite(rsi3Ago) && rsi > rsi3Ago, 'RSI近3日走升');
  addReason(strengthReasons, Boolean(stock.relative_strength_7d?.relative_strength_strong), '近7日相對大盤轉強');
  addReason(strengthReasons, chip !== '偏空', '籌碼未明顯偏空');

  const hasPriceStrength = strengthReasons.includes('收盤站上SMA20') || strengthReasons.includes('接近20日高點');
  const hasMomentumStrength = strengthReasons.includes('MACD黃金交叉')
    || strengthReasons.includes('MACD柱狀改善')
    || strengthReasons.includes('KD黃金交叉')
    || strengthReasons.includes('RSI站上50')
    || strengthReasons.includes('RSI近3日走升');
  const hasRangeCompression = reasons.includes('20日區間收斂') || reasons.includes('10日區間收斂');
  const matched = reasons.length >= 4
    && strengthReasons.length >= 5
    && stock.direction_score >= 0
    && !isBearish(stock.final_direction_label)
    && hasRangeCompression
    && hasPriceStrength
    && hasMomentumStrength
    && stock.data_completeness >= 80
    && stock.risk_label !== '高風險'
    && (!Number.isFinite(rsi) || rsi < 70)
    && (!Number.isFinite(stock.features.gap_sma20) || stock.features.gap_sma20 <= 8);

  return {
    tag: empty.tag,
    matched,
    consolidation_score: reasons.length,
    strengthening_score: strengthReasons.length,
    consolidation_reasons: reasons,
    strengthening_reasons: strengthReasons,
    metrics: {
      range_10d: round(range10),
      range_20d: round(range20),
      ma_compression: round(maCompression),
      sma20_slope_5d: round(sma20Slope5),
      average_range_5d: round(range5),
      average_range_20d: round(range20Daily),
      volume_ratio_5d_to_20d: round(Number.isFinite(avgVolume5) && Number.isFinite(avgVolume20) && avgVolume20 !== 0 ? avgVolume5 / avgVolume20 : null),
      near_20d_high: round(near20High),
      rsi14: round(rsi),
    },
  };
}

function addReason(reasons, condition, reason) {
  if (condition) reasons.push(reason);
}

function isRecentBreakoutOrBreakdown(current, priorRows) {
  const highs = priorRows.map((row) => row.high).filter(Number.isFinite);
  const lows = priorRows.map((row) => row.low).filter(Number.isFinite);
  if (!Number.isFinite(current?.close) || !highs.length || !lows.length) return false;
  return current.close >= Math.max(...highs) || current.close <= Math.min(...lows);
}

function reversalSignals(rows) {
  if (!rows || rows.length < 2) return { tags: [] };
  const current = rows.at(-1);
  const previous = rows.at(-2);
  const macd = calculateMacd(rows);
  const kd = calculateKd(rows);
  const tags = [];
  const crossedSma20 = Number.isFinite(previous.sma20) && Number.isFinite(current.sma20) && previous.close <= previous.sma20 && current.close > current.sma20;
  const crossedSma60 = Number.isFinite(previous.sma60) && Number.isFinite(current.sma60) && previous.close <= previous.sma60 && current.close > current.sma60;
  if (crossedSma20) tags.push('重新站上20MA');
  if (crossedSma60) tags.push('重新站上60MA');
  if (macd?.bullish_cross) tags.push('MACD翻多');
  if (macd?.histogram_positive_turn) tags.push('MACD柱狀翻正');
  if (kd?.bullish_cross) tags.push('KD黃金交叉');
  if (kd?.oversold_turn) tags.push('KD低檔轉折');
  return {
    tags,
    crossed_sma20: crossedSma20,
    crossed_sma60: crossedSma60,
    macd_bullish_cross: Boolean(macd?.bullish_cross),
    macd_histogram_positive_turn: Boolean(macd?.histogram_positive_turn),
    kd_bullish_cross: Boolean(kd?.bullish_cross),
    kd_oversold_turn: Boolean(kd?.oversold_turn),
    macd: round(macd?.macd),
    macd_signal: round(macd?.signal),
    macd_histogram: round(macd?.histogram),
    k9: round(kd?.k),
    d9: round(kd?.d),
  };
}

function average(items, getter) {
  const values = items.map(getter).filter(Number.isFinite);
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
}

function ratio(items, predicate) {
  return items.length ? items.filter(predicate).length / items.length * 100 : 0;
}

function isBullish(label) {
  return label === '偏多' || label === '中性偏多';
}

function isBearish(label) {
  return label === '偏空' || label === '中性偏空';
}

function chipBias(stock) {
  const institutional = stock.features.institutional_ratio;
  const main = stock.features.main_net_ratio;
  const institutionalScore = Number.isFinite(institutional) ? (institutional >= 3 ? 1 : institutional <= -3 ? -1 : 0) : 0;
  const mainScore = Number.isFinite(main) ? (main >= 2 ? 1 : main <= -2 ? -1 : 0) : 0;
  const score = institutionalScore + mainScore;
  if (score > 0) return '偏多';
  if (score < 0) return '偏空';
  return '中性或不足';
}

function strategyTags(stock) {
  const tags = [];
  const f = stock.features;
  const bullish = isBullish(stock.final_direction_label);
  const bearish = isBearish(stock.final_direction_label);
  const chip = chipBias(stock);
  if (bullish && stock.risk_label !== '高風險' && stock.data_completeness >= 50) tags.push('優先觀察');
  if (bullish && (stock.risk_label === '高風險' || f.rsi14 >= 70 || Math.abs(f.gap_sma20 ?? 0) >= 15)) tags.push('強勢但過熱');
  if (chip === '偏多') tags.push('籌碼同步偏多');
  if (chip === '偏空') tags.push('籌碼同步偏空');
  if (bearish && (stock.risk_label === '高風險' || stock.direction_score <= -2)) tags.push('弱勢避開');
  if (stock.data_completeness < 50 || stock.missing_data.length >= 3) tags.push('資料不足');
  if ((bullish && chip === '偏空') || (bearish && chip === '偏多')) tags.push('訊號矛盾');
  if ((f.r1 ?? 0) >= 3 || (f.r3 ?? 0) >= 8) tags.push('技術強勢');
  if ((f.r1 ?? 0) <= -3 || (f.r3 ?? 0) <= -8) tags.push('技術弱勢');
  if (stock.reversal_signals.tags.length) tags.push('弱勢翻轉觀察');
  if (stock.relative_strength_7d?.relative_strength_strong) {
    tags.push(stock.relative_strength_7d.relative_strength_mode === '大盤跌勢抗跌' ? '七日抗跌強勢' : '七日領漲強勢');
  }
  if (stock.consolidation_strength?.matched) tags.push(stock.consolidation_strength.tag);
  return tags.length ? tags : ['一般觀察'];
}

function summarizeStocks(stocks) {
  const directions = {};
  const risks = {};
  const marketContextRisks = {};
  const completenessBands = { '高完整度': 0, '中完整度': 0, '低完整度': 0 };
  for (const stock of stocks) {
    directions[stock.final_direction_label] = (directions[stock.final_direction_label] || 0) + 1;
    risks[stock.risk_label] = (risks[stock.risk_label] || 0) + 1;
    marketContextRisks[stock.market_context_risk_label] = (marketContextRisks[stock.market_context_risk_label] || 0) + 1;
    if (stock.data_completeness >= 80) completenessBands['高完整度'] += 1;
    else if (stock.data_completeness >= 50) completenessBands['中完整度'] += 1;
    else completenessBands['低完整度'] += 1;
  }
  return {
    count: stocks.length,
    average_direction_score: round(average(stocks, (stock) => stock.direction_score)),
    average_completeness: round(average(stocks, (stock) => stock.data_completeness)),
    average_r1: round(average(stocks, (stock) => stock.features.r1)),
    average_r3: round(average(stocks, (stock) => stock.features.r3)),
    average_gap_sma20: round(average(stocks, (stock) => stock.features.gap_sma20)),
    average_rsi14: round(average(stocks, (stock) => stock.features.rsi14)),
    bullish_ratio: round(ratio(stocks, (stock) => isBullish(stock.final_direction_label))),
    bearish_ratio: round(ratio(stocks, (stock) => isBearish(stock.final_direction_label))),
    high_risk_ratio: round(ratio(stocks, (stock) => stock.risk_label === '高風險')),
    market_high_risk_ratio: round(ratio(stocks, (stock) => stock.market_context_risk_label === '高風險')),
    low_completeness_ratio: round(ratio(stocks, (stock) => stock.data_completeness < 50)),
    volume_expansion_ratio: round(ratio(stocks, (stock) => stock.features.volume_ratio_1d >= 1.2)),
    overheated_ratio: round(ratio(stocks, (stock) => stock.features.rsi14 >= 70)),
    oversold_ratio: round(ratio(stocks, (stock) => stock.features.rsi14 <= 30)),
    chip_bullish_ratio: round(ratio(stocks, (stock) => chipBias(stock) === '偏多')),
    chip_bearish_ratio: round(ratio(stocks, (stock) => chipBias(stock) === '偏空')),
    reversal_ratio: round(ratio(stocks, (stock) => stock.reversal_signals.tags.length > 0)),
    reclaim_sma20_ratio: round(ratio(stocks, (stock) => stock.reversal_signals.crossed_sma20)),
    reclaim_sma60_ratio: round(ratio(stocks, (stock) => stock.reversal_signals.crossed_sma60)),
    macd_bullish_ratio: round(ratio(stocks, (stock) => stock.reversal_signals.macd_bullish_cross || stock.reversal_signals.macd_histogram_positive_turn)),
    kd_bullish_ratio: round(ratio(stocks, (stock) => stock.reversal_signals.kd_bullish_cross || stock.reversal_signals.kd_oversold_turn)),
    relative_strength_7d_ratio: round(ratio(stocks, (stock) => stock.relative_strength_7d?.relative_strength_strong)),
    relative_strength_7d_market_return: round(stocks.find((stock) => Number.isFinite(stock.relative_strength_7d?.market_return_7d))?.relative_strength_7d?.market_return_7d),
    directions,
    risks,
    market_context_risks: marketContextRisks,
    completeness_bands: completenessBands,
  };
}

function industryInterpretation(summary) {
  const notes = [];
  if (summary.bullish_ratio >= 45) notes.push('偏多比例高');
  if (summary.bearish_ratio >= 35) notes.push('偏空壓力較明顯');
  if (summary.high_risk_ratio >= 25) notes.push('高風險占比偏高');
  if (summary.average_r3 >= 3) notes.push('三日動能較強');
  if (summary.average_r3 <= -3) notes.push('三日動能偏弱');
  if (summary.volume_expansion_ratio >= 35) notes.push('放量股票較多');
  if (summary.chip_bullish_ratio > summary.chip_bearish_ratio + 10) notes.push('籌碼偏多較集中');
  if (summary.chip_bearish_ratio > summary.chip_bullish_ratio + 10) notes.push('籌碼偏空較集中');
  if (summary.reversal_ratio >= 20) notes.push('翻轉訊號較多');
  if (summary.low_completeness_ratio >= 40) notes.push('資料完整度偏低');
  return notes.length ? notes.join('、') : '結構中性，暫無明顯單向訊號';
}

function main() {
  const predictionDir = latestPredictionDirectory();
  const stockMeta = readJson(INDUSTRY_FILE, {});
  const priceHistory = loadPriceHistory();
  const files = fs.readdirSync(predictionDir).filter((file) => /^\d+\.json$/.test(file)).sort();
  const firstPayload = files.length ? readJson(path.join(predictionDir, files[0]), {}) : {};
  const marketHistory = loadMarketHistory(firstPayload.base_trade_date);
  const stocks = files.map((file) => {
    const payload = readJson(path.join(predictionDir, file), {});
    const meta = stockMeta[payload.stock_code] || {};
    const forecastCompact = compactDate(payload.forecast_date);
    const reversal = reversalSignals(priceHistory.get(payload.stock_code));
    const rs7d = relativeStrength7d(priceHistory.get(payload.stock_code), marketHistory);
    const stock = {
      stock_code: payload.stock_code,
      stock_name: payload.stock_name || meta.Name || payload.stock_code,
      industry: meta.Industry || '未分類',
      forecast_date: payload.forecast_date,
      base_trade_date: payload.base_trade_date,
      report_file: `prediction-stock.html?date=${forecastCompact}&code=${payload.stock_code}`,
      json_file: `${forecastCompact}/${payload.stock_code}.json`,
      final_direction_label: payload.final_direction_label,
      raw_direction_label: payload.raw_direction_label,
      direction_score: payload.direction_score,
      risk_score: payload.stock_risk_score ?? payload.risk_score,
      risk_label: payload.stock_risk_label ?? payload.risk_label,
      market_context_risk_score: payload.market_context_risk_score ?? null,
      market_context_risk_label: payload.market_context_risk_label ?? payload.market_risk?.risk_label ?? 'NA',
      combined_risk_score: payload.combined_risk_score ?? payload.risk_score,
      combined_risk_label: payload.combined_risk_label ?? payload.risk_label,
      data_completeness: payload.data_completeness,
      missing_data: payload.missing_data || [],
      features: {
        r1: payload.features?.r1 ?? null,
        r3: payload.features?.r3 ?? null,
        volume_ratio_1d: payload.features?.volume_ratio_1d ?? null,
        volume_ratio_5d: payload.features?.volume_ratio_5d ?? null,
        gap_sma20: payload.features?.gap_sma20 ?? null,
        rsi14: payload.features?.rsi14 ?? null,
        institutional_ratio: payload.features?.institutional_ratio ?? null,
        main_net_ratio: payload.features?.main_net_ratio ?? null,
        margin_change_rate: payload.features?.margin_change_rate ?? null,
      },
      reversal_signals: reversal,
      relative_strength_7d: rs7d,
    };
    stock.chip_bias = chipBias(stock);
    const consolidation = consolidationStrength(priceHistory.get(payload.stock_code), stock);
    if (consolidation.matched) stock.consolidation_strength = consolidation;
    stock.strategy_tags = strategyTags(stock);
    return stock;
  });

  const byIndustry = new Map();
  const byGroup = new Map();
  for (const stock of stocks) {
    if (!byIndustry.has(stock.industry)) byIndustry.set(stock.industry, []);
    byIndustry.get(stock.industry).push(stock);
    for (const tag of stock.strategy_tags) {
      if (!byGroup.has(tag)) byGroup.set(tag, []);
      byGroup.get(tag).push(stock);
    }
  }

  const industry_summary = [...byIndustry.entries()].map(([industry, members]) => {
    const summary = summarizeStocks(members);
    return {
      industry,
      ...summary,
      interpretation: industryInterpretation(summary),
      leaders: [...members].sort((a, b) => b.direction_score - a.direction_score).slice(0, 5).map((stock) => stock.stock_code),
      laggards: [...members].sort((a, b) => a.direction_score - b.direction_score).slice(0, 5).map((stock) => stock.stock_code),
    };
  }).sort((a, b) => b.average_direction_score - a.average_direction_score || b.count - a.count);

  const group_summary = [...byGroup.entries()].map(([group, members]) => ({
    group,
    ...summarizeStocks(members),
    members: members.map((stock) => stock.stock_code),
  })).sort((a, b) => b.count - a.count);

  const manifest = readJson(path.join(PREDICTION_DIR, 'manifest.json'), {});
  const dashboard = {
    generated_at: new Date().toISOString(),
    methodology_version: manifest.methodology_version,
    forecast_date: manifest.forecast_date || stocks[0]?.forecast_date,
    base_trade_date: manifest.base_trade_date || stocks[0]?.base_trade_date,
    source_directory: path.relative(ROOT, predictionDir),
    market_summary: summarizeStocks(stocks),
    stocks,
    industry_summary,
    group_summary,
  };

  fs.writeFileSync(path.join(predictionDir, 'summary.json'), JSON.stringify(dashboard, null, 2), 'utf8');
  fs.writeFileSync(path.join(predictionDir, 'industry-summary.json'), JSON.stringify({
    generated_at: dashboard.generated_at,
    forecast_date: dashboard.forecast_date,
    base_trade_date: dashboard.base_trade_date,
    industries: industry_summary,
  }, null, 2), 'utf8');
  fs.writeFileSync(path.join(predictionDir, 'group-summary.json'), JSON.stringify({
    generated_at: dashboard.generated_at,
    forecast_date: dashboard.forecast_date,
    base_trade_date: dashboard.base_trade_date,
    groups: group_summary,
  }, null, 2), 'utf8');
  fs.writeFileSync(path.join(PREDICTION_DIR, 'manifest.json'), JSON.stringify({
    ...manifest,
    latest_summary: path.relative(ROOT, path.join(predictionDir, 'summary.json')),
    latest_industry_summary: path.relative(ROOT, path.join(predictionDir, 'industry-summary.json')),
    latest_group_summary: path.relative(ROOT, path.join(predictionDir, 'group-summary.json')),
  }, null, 2), 'utf8');
  console.log(JSON.stringify({ stocks: stocks.length, industries: industry_summary.length, groups: group_summary.length }));
}

main();
