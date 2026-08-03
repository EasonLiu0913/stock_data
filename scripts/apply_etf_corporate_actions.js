#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const DEFAULT_DATA_PATH = path.join(ROOT, 'public', 'data', 'etf-market-regime-analysis', 'data.json');

const CORPORATE_ACTIONS = Object.freeze([
  Object.freeze({
    id: '0052-split-20251126',
    etfId: '0052',
    etfName: '富邦科技',
    type: 'split',
    factor: 7,
    lastTradingDate: '20251118',
    suspendedFrom: '20251119',
    suspendedTo: '20251125',
    effectiveDate: '20251126',
    officialReferencePriceBefore: 239.69,
    officialReferencePriceAfter: 34.24,
    source: '臺灣證券交易所 ETF e添富－富邦科技分割公告',
    sourceUrl: 'https://www.twse.com.tw/zh/ETFortune/announcement?company=A00010&date=20251125&fund=0052&seq=1&type=other'
  })
]);

function round(value, digits = 6) {
  return Number.isFinite(value) ? Number(value.toFixed(digits)) : null;
}

function fieldNames(etfId) {
  if (etfId === '0052') {
    return { closeField: 'etf0052Close', adjustedCloseField: 'etf0052AdjustedClose' };
  }
  throw new Error(`Unsupported corporate-action ETF: ${etfId}`);
}

function splitAwareHoldingReturnPct(startPrice, endPrice, splitFactor = 1) {
  if (!(startPrice > 0) || !(endPrice > 0) || !(splitFactor > 0)) return null;
  return round((endPrice * splitFactor / startPrice - 1) * 100, 4);
}

function detectProviderSplitBoundary(rows, action) {
  const { closeField } = fieldNames(action.etfId);
  const expectedRatio = 1 / action.factor;
  const candidates = [];
  for (let index = 1; index < rows.length; index += 1) {
    const previous = rows[index - 1];
    const current = rows[index];
    const previousPrice = Number(previous?.[closeField]);
    const currentPrice = Number(current?.[closeField]);
    if (!(previousPrice > 0) || !(currentPrice > 0)) continue;
    if (current.date > action.effectiveDate || current.date < '20251001') continue;
    const ratio = currentPrice / previousPrice;
    const relativeError = Math.abs(ratio - expectedRatio) / expectedRatio;
    if (relativeError <= 0.2) {
      candidates.push({
        index,
        date: current.date,
        previousDate: previous.date,
        previousPrice,
        currentPrice,
        observedRatio: round(ratio, 8),
        relativeError: round(relativeError, 8)
      });
    }
  }
  return candidates.sort((left, right) => left.relativeError - right.relativeError || right.date.localeCompare(left.date))[0] || null;
}

function applySplitToRows(rows, action) {
  const { closeField, adjustedCloseField } = fieldNames(action.etfId);
  const boundary = detectProviderSplitBoundary(rows, action);
  if (!boundary) {
    return {
      applied: false,
      reason: 'no_inconsistent_provider_split_boundary_detected',
      officialEffectiveDate: action.effectiveDate,
      factor: action.factor,
      adjustedRowCount: 0
    };
  }

  let adjustedRowCount = 0;
  for (const row of rows) {
    if (row.date >= boundary.date) continue;
    const close = Number(row[closeField]);
    const adjustedClose = Number(row[adjustedCloseField]);
    if (close > 0) row[closeField] = round(close / action.factor);
    if (adjustedClose > 0) row[adjustedCloseField] = round(adjustedClose / action.factor);
    adjustedRowCount += 1;
  }

  const previous = rows[boundary.index - 1];
  const current = rows[boundary.index];
  const repairedReturnPct = previous && current
    ? round((Number(current[adjustedCloseField]) / Number(previous[adjustedCloseField]) - 1) * 100, 4)
    : null;

  if (!Number.isFinite(repairedReturnPct) || Math.abs(repairedReturnPct) > 50) {
    throw new Error(`0052 split repair still leaves an implausible boundary return: ${repairedReturnPct}`);
  }

  return {
    applied: true,
    method: 'divide_pre_boundary_prices_by_official_split_factor',
    factor: action.factor,
    officialEffectiveDate: action.effectiveDate,
    providerBoundaryDate: boundary.date,
    providerBoundaryPreviousDate: boundary.previousDate,
    providerObservedRatio: boundary.observedRatio,
    adjustedRowCount,
    repairedBoundaryReturnPct: repairedReturnPct
  };
}

function applyCorporateActions(payload) {
  if (!payload || !Array.isArray(payload.rows)) throw new Error('ETF research payload is missing rows');
  const details = {};
  for (const action of CORPORATE_ACTIONS) {
    details[action.id] = applySplitToRows(payload.rows, action);
  }

  const actionMetadata = CORPORATE_ACTIONS.map((action) => ({
    ...action,
    holdingReturnFormula: '報酬率 =（期末價格 × 分割後單位數倍數 ÷ 期初價格）－1；本資料改以分割後單位基準回溯調整分割前價格，因此可直接使用期末還原價 ÷ 期初還原價－1。',
    adjustment: details[action.id]
  }));
  payload.corporateActions = actionMetadata;

  const etf0052 = (payload.etfs || []).find((etf) => etf.id === '0052');
  if (etf0052) {
    etf0052.description = '台灣科技產業集中型 ETF；2025-11-26 完成 7：1 分割，跨分割日報酬已按分割後單位基準修正';
  }

  payload.priceBasis = payload.priceBasis || {};
  payload.priceBasis.corporateActionMethod = '所有報酬使用同一單位基準；0052 分割前價格依官方 7：1 比例除以 7，等價於持有單位數在分割日乘以 7。';
  payload.priceBasis.explanation = `${payload.priceBasis.explanation || '持有報酬使用還原收盤價。'} 另依證交所官方公司行動修正 0052 於 2025-11-26 的 7：1 分割，避免將單位價格下降誤認為投資損失。`;

  payload.sources = payload.sources || {};
  payload.sources.corporateActions = actionMetadata.map(({ source, sourceUrl, ...action }) => ({ ...action, source, sourceUrl }));
  payload.sources.etfPriceDetails = payload.sources.etfPriceDetails || {};
  payload.sources.etfPriceDetails['0052'] = {
    ...(payload.sources.etfPriceDetails['0052'] || {}),
    corporateActionAdjustment: details['0052-split-20251126']
  };
  return payload;
}

function updateFile(filePath = DEFAULT_DATA_PATH) {
  const payload = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  const updated = applyCorporateActions(payload);
  fs.writeFileSync(filePath, `${JSON.stringify(updated, null, 2)}\n`, 'utf8');
  return updated;
}

if (require.main === module) {
  try {
    const target = process.argv[2] ? path.resolve(process.argv[2]) : DEFAULT_DATA_PATH;
    const updated = updateFile(target);
    const detail = updated.corporateActions?.find((action) => action.id === '0052-split-20251126')?.adjustment;
    console.log(`Applied ETF corporate actions to ${path.relative(ROOT, target)}: ${JSON.stringify(detail)}`);
  } catch (error) {
    console.error(error?.stack || error);
    process.exitCode = 1;
  }
}

module.exports = {
  CORPORATE_ACTIONS,
  splitAwareHoldingReturnPct,
  detectProviderSplitBoundary,
  applySplitToRows,
  applyCorporateActions,
  updateFile
};
