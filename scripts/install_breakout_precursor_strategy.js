#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const target = path.resolve(__dirname, 'generate_prediction_dashboard_data.js');
let source = fs.readFileSync(target, 'utf8');

if (!source.includes('function breakoutPrecursorProfile(')) {
  const marker = 'function strategyTags(stock) {';
  const helper = `function breakoutPrecursorProfile(rows, stock) {
  const empty = {
    tag: '三日突破前兆候選',
    matched: false,
    score: 0,
    reasons: [],
    metrics: {},
  };
  if (!rows || rows.length < 6) return empty;

  const current = rows.at(-1);
  const recent2 = rows.slice(-2);
  const prior3 = rows.slice(-5, -2);
  const recent2Volume = averageNumber(recent2.map((row) => row.volume));
  const prior3Volume = averageNumber(prior3.map((row) => row.volume));
  const volumeLeadRatio = Number.isFinite(recent2Volume) && Number.isFinite(prior3Volume) && prior3Volume > 0
    ? recent2Volume / prior3Volume
    : null;
  const institutionalRatio = stock.features.institutional_ratio;
  const mainNetRatio = stock.features.main_net_ratio;
  const r1 = stock.features.r1;
  const r3 = stock.features.r3;

  const institutionalBullish = Number.isFinite(institutionalRatio) && institutionalRatio > 0;
  const volumeLeading = Number.isFinite(volumeLeadRatio) && volumeLeadRatio >= 1.5;
  const aboveSma5 = Number.isFinite(current.close) && Number.isFinite(current.sma5) && current.close > current.sma5;
  const strengtheningNotSurged = Number.isFinite(r1) && Number.isFinite(r3)
    && r1 > 0 && r1 < 3 && r3 > 0 && r3 < 10;
  const mainBullish = Number.isFinite(mainNetRatio) && mainNetRatio > 0;

  const reasons = [];
  addReason(reasons, institutionalBullish, '三大法人提前偏多');
  addReason(reasons, volumeLeading, '近兩日量能至少為前期1.5倍');
  addReason(reasons, aboveSma5, '收盤站上SMA5');
  addReason(reasons, strengtheningNotSurged, '已轉強但尚未明顯噴出');
  addReason(reasons, mainBullish, '主力／券商籌碼偏多');

  const score = (institutionalBullish ? 25 : 0)
    + (volumeLeading ? 25 : 0)
    + (aboveSma5 ? 25 : 0)
    + (strengtheningNotSurged ? 25 : 0)
    + (mainBullish ? 10 : 0);

  return {
    tag: empty.tag,
    matched: institutionalBullish && volumeLeading && aboveSma5 && strengtheningNotSurged,
    score,
    reasons,
    metrics: {
      institutional_ratio: round(institutionalRatio),
      main_net_ratio: round(mainNetRatio),
      volume_lead_ratio: round(volumeLeadRatio),
      close: round(current.close),
      sma5: round(current.sma5),
      r1: round(r1),
      r3: round(r3),
    },
  };
}

`;
  if (!source.includes(marker)) throw new Error('strategyTags marker not found');
  source = source.replace(marker, helper + marker);
}

if (!source.includes("stock.breakout_precursor?.matched")) {
  const marker = "  if (stock.consolidation_strength?.matched) tags.push(stock.consolidation_strength.tag);";
  const replacement = `${marker}\n  if (stock.breakout_precursor?.matched) tags.push(stock.breakout_precursor.tag);`;
  if (!source.includes(marker)) throw new Error('strategy tag insertion marker not found');
  source = source.replace(marker, replacement);
}

if (!source.includes('stock.breakout_precursor = breakoutPrecursorProfile')) {
  const marker = '    stock.chip_bias = chipBias(stock);';
  const replacement = `${marker}\n    stock.breakout_precursor = breakoutPrecursorProfile(priceHistory.get(payload.stock_code), stock);`;
  if (!source.includes(marker)) throw new Error('stock profile insertion marker not found');
  source = source.replace(marker, replacement);
}

fs.writeFileSync(target, source, 'utf8');
console.log('Installed 三日突破前兆候選 strategy.');
