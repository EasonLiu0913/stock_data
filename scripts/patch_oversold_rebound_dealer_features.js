#!/usr/bin/env node
'use strict';

const {
  finiteNumber,
  buildStockProfile,
  enrichEvent,
  summarizeResearch,
  DEFAULT_THRESHOLDS,
} = require('./oversold_rebound_research_lib');
const { loadJsonDailyMaps } = require('./mine_oversold_rebound_events');

function parseDealerPayload(payload) {
  const result = new Map();
  const rows = Array.isArray(payload?.data) ? payload.data : [];
  for (const row of rows) {
    if (!Array.isArray(row)) continue;
    const code = String(row[0] || '').trim().toUpperCase();
    const stockName = String(row[1] || '').trim();
    if (!code || !/^\d{4,6}[A-Z]?$/.test(code)) continue;
    let net = null;
    for (let cursor = row.length - 1; cursor >= 2; cursor -= 1) {
      const value = finiteNumber(row[cursor]);
      if (Number.isFinite(value)) {
        net = value;
        break;
      }
    }
    if (!Number.isFinite(net)) continue;
    result.set(code, { stock_name: stockName, net_shares: net });
  }
  return result;
}

function applyDealerFeatureFix(result, root, options) {
  const dealers = loadJsonDailyMaps(
    root,
    'data_twse_dealers',
    /^(20\d{6})_twse_dealers\.json$/,
    parseDealerPayload,
    options,
  );
  const allDates = [...new Set(
    [...result.sources.prices.byStock.values()].flatMap(stock => stock.rows.map(row => row.date)),
  )].sort();
  const context = {
    allDates,
    foreign: result.sources.foreign.daily,
    trust: result.sources.trust.daily,
    dealers: dealers.daily,
    margin: result.sources.margin.daily,
    brokers: result.sources.brokers.daily,
  };

  for (const stock of result.stockResults) {
    stock.events = stock.events.map(event => enrichEvent(event, context));
    stock.profile = buildStockProfile(stock.stock_code, stock.stock_name, stock.events);
  }
  result.sources.dealers = dealers;
  const dataQuality = {
    price: result.sources.prices.quality,
    foreign: result.sources.foreign.quality,
    investment_trust: result.sources.trust.quality,
    dealer: dealers.quality,
    margin: result.sources.margin.quality,
    broker: result.sources.brokers.quality,
  };
  result.summary = summarizeResearch(result.stockResults, dataQuality, DEFAULT_THRESHOLDS);
  result.manifest.generated_at = result.summary.generated_at;
  result.manifest.stock_count = result.summary.stock_count;
  result.manifest.event_count = result.summary.event_count;
  return result;
}

module.exports = { parseDealerPayload, applyDealerFeatureFix };
