#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const DEFAULT_ROOT = path.resolve(__dirname, '../..');

function normalizeDate(value) {
  const compact = String(value || '').replace(/[^\d]/g, '');
  if (!/^20\d{6}$/.test(compact)) throw new Error(`Invalid trading date: ${value}`);
  return compact;
}

function slashDate(date) {
  const compact = normalizeDate(date);
  return `${compact.slice(0, 4)}/${compact.slice(4, 6)}/${compact.slice(6, 8)}`;
}

function dashDate(date) {
  const compact = normalizeDate(date);
  return `${compact.slice(0, 4)}-${compact.slice(4, 6)}-${compact.slice(6, 8)}`;
}

function parseNumber(value) {
  if (value == null) return null;
  const text = String(value).replaceAll(',', '').trim();
  if (!text || text === '--' || text === '---' || text === '除權' || text === '除息') return null;
  const number = Number(text);
  return Number.isFinite(number) ? number : null;
}

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
}

function buildPriceRecord(values, metadata = {}) {
  if (!values) return null;
  const record = {
    open: parseNumber(values.open),
    high: parseNumber(values.high),
    low: parseNumber(values.low),
    close: parseNumber(values.close),
    volume: parseNumber(values.volume),
    source: metadata.source || null,
    source_file: metadata.source_file || null,
  };
  if (!Number.isFinite(record.close) || record.close <= 0) return null;
  return record;
}

function findTwseQuoteTable(payload) {
  return (payload?.tables || []).find(table => {
    const fields = table?.fields || [];
    return fields.includes('證券代號')
      && fields.includes('開盤價')
      && fields.includes('最高價')
      && fields.includes('最低價')
      && fields.includes('收盤價');
  }) || null;
}

function loadFromTwseMiIndex(stockCode, date, root = DEFAULT_ROOT) {
  const compact = normalizeDate(date);
  const file = path.join(root, 'data_twse_mi_index', `${compact}_twse_mi_index.json`);
  const payload = readJson(file);
  if (!payload) return null;
  const table = findTwseQuoteTable(payload);
  if (!table) return null;

  const fields = table.fields || [];
  const codeIndex = fields.indexOf('證券代號');
  const openIndex = fields.indexOf('開盤價');
  const highIndex = fields.indexOf('最高價');
  const lowIndex = fields.indexOf('最低價');
  const closeIndex = fields.indexOf('收盤價');
  const volumeIndex = fields.indexOf('成交股數');
  const row = (table.data || []).find(item => String(item?.[codeIndex] || '').trim() === String(stockCode));
  if (!row) return null;

  return buildPriceRecord({
    open: row[openIndex],
    high: row[highIndex],
    low: row[lowIndex],
    close: row[closeIndex],
    volume: volumeIndex >= 0 ? row[volumeIndex] : null,
  }, {
    source: 'twse_mi_index',
    source_file: path.relative(root, file).replaceAll(path.sep, '/'),
  });
}

function loadFromHistorySma(stockCode, date, root = DEFAULT_ROOT) {
  const compact = normalizeDate(date);
  const file = path.join(root, 'data_history_sma', `${stockCode}.json`);
  const payload = readJson(file);
  if (!payload || typeof payload !== 'object') return null;
  const point = payload[slashDate(compact)] || payload[dashDate(compact)] || payload[compact];
  if (!point) return null;
  return buildPriceRecord({
    open: point.open ?? point.Open,
    high: point.high ?? point.High,
    low: point.low ?? point.Low,
    close: point.price ?? point.close ?? point.Price ?? point.Close,
    volume: point.volume ?? point.Volume,
  }, {
    source: 'data_history_sma',
    source_file: path.relative(root, file).replaceAll(path.sep, '/'),
  });
}

function loadFromLegacyFubon(stockCode, date, root = DEFAULT_ROOT) {
  const compact = normalizeDate(date);
  const file = path.join(root, 'data_fubon', `fubon_${compact}_sma.json`);
  const payload = readJson(file);
  const item = payload?.[stockCode];
  if (!item || typeof item !== 'object') return null;
  const point = item[slashDate(compact)] || item[dashDate(compact)] || item[compact];
  if (!point) return null;
  return buildPriceRecord({
    open: point.Open ?? point.open,
    high: point.High ?? point.high,
    low: point.Low ?? point.low,
    close: point.Price ?? point.Close ?? point.price ?? point.close,
    volume: point.Volume ?? point.volume,
  }, {
    source: 'legacy_data_fubon',
    source_file: path.relative(root, file).replaceAll(path.sep, '/'),
  });
}

function getDailyPrice(stockCode, date, options = {}) {
  const root = path.resolve(options.root || DEFAULT_ROOT);
  const loaders = options.loaders || [loadFromTwseMiIndex, loadFromHistorySma, loadFromLegacyFubon];
  for (const loader of loaders) {
    const result = loader(String(stockCode), date, root);
    if (result) return result;
  }
  return null;
}

function getClose(stockCode, date, options = {}) {
  return getDailyPrice(stockCode, date, options)?.close ?? null;
}

module.exports = {
  DEFAULT_ROOT,
  buildPriceRecord,
  findTwseQuoteTable,
  getClose,
  getDailyPrice,
  loadFromHistorySma,
  loadFromLegacyFubon,
  loadFromTwseMiIndex,
  normalizeDate,
  parseNumber,
};
