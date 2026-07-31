#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const {
  ROOT,
  TAIFEX_DAILY_FUTURES_URL,
  compactDate,
  finiteNumber,
  round,
  pick,
  rocDateToCompact,
  fetchJson,
} = require('./official_market_constraints');

function normalizeTaifexFuturesRows(rows) {
  if (!Array.isArray(rows)) return [];
  return rows.map((row) => {
    const last = finiteNumber(pick(row, [
      'Last', 'LastPrice', 'Close', '最後成交價',
    ]));
    const change = finiteNumber(pick(row, [
      'Change', 'ChangePrice', '漲跌價',
    ]));
    let changePercent = finiteNumber(pick(row, [
      '%', 'ChangePercent', 'Change%', 'ChangeRate', '漲跌%', '漲跌百分比',
    ]));
    if (changePercent === null && last !== null && change !== null && last - change !== 0) {
      changePercent = change / (last - change) * 100;
    }
    return {
      trade_date: rocDateToCompact(pick(row, ['Date', 'TradeDate', '日期'])),
      contract: String(pick(row, ['Contract', 'CommodityId', 'CommodityID', '契約']) || '').trim().toUpperCase(),
      contract_month: String(pick(row, [
        'ContractMonth(Week)', 'ContractMonth', 'DeliveryMonth', '到期月份(週別)', '到期月份',
      ]) || '').trim(),
      trading_session: String(pick(row, [
        'TradingSession', 'Session', 'MarketCode', '交易時段',
      ]) || '').trim(),
      open: finiteNumber(pick(row, ['Open', 'OpenPrice', '開盤價'])),
      high: finiteNumber(pick(row, ['High', 'HighPrice', '最高價'])),
      low: finiteNumber(pick(row, ['Low', 'LowPrice', '最低價'])),
      last,
      change,
      change_percent: round(changePercent, 4),
      volume: finiteNumber(pick(row, ['Volume', 'TotalVolume', '成交量', '合計成交量'])),
      settlement_price: finiteNumber(pick(row, ['SettlementPrice', '結算價'])),
      raw: row,
    };
  });
}

function isAfterHoursSession(value) {
  const text = String(value || '').normalize('NFKC').trim().toLowerCase();
  return text.includes('盤後')
    || text.includes('夜盤')
    || text.includes('after')
    || text === '1'
    || text === 'ah';
}

function contractMonthSortKey(value) {
  const text = String(value || '').replace(/\D/g, '');
  if (/^20\d{4}$/.test(text)) return `${text}00`;
  if (/^20\d{4}\d+$/.test(text)) return text.padEnd(10, '0');
  return '9999999999';
}

function selectTaifexNightFuture(rows, date, contract = 'TX') {
  const target = compactDate(date);
  if (!target) throw new Error('date must be YYYYMMDD');
  const normalized = normalizeTaifexFuturesRows(rows);
  const matching = normalized.filter((row) => row.trade_date === target && row.contract === contract);
  const sessions = [...new Set(matching.map((row) => row.trading_session).filter(Boolean))];
  const afterHours = matching
    .filter((row) => isAfterHoursSession(row.trading_session))
    .filter((row) => row.last !== null && row.change_percent !== null && (row.volume ?? 0) > 0)
    .sort((left, right) => contractMonthSortKey(left.contract_month).localeCompare(contractMonthSortKey(right.contract_month))
      || (right.volume ?? 0) - (left.volume ?? 0));
  const selected = afterHours[0] || null;
  return {
    schema_version: 1,
    target_date: target,
    contract,
    calculation_status: selected ? 'completed' : 'unavailable',
    available: Boolean(selected),
    change_percent: selected?.change_percent ?? null,
    selected_contract_month: selected?.contract_month || null,
    trading_session: selected?.trading_session || null,
    open: selected?.open ?? null,
    high: selected?.high ?? null,
    low: selected?.low ?? null,
    last: selected?.last ?? null,
    change: selected?.change ?? null,
    volume: selected?.volume ?? null,
    settlement_price: selected?.settlement_price ?? null,
    candidate_count: afterHours.length,
    observed_session_values: sessions,
    warning: selected ? null : '找不到目標日期、TX、盤後交易時段且有成交的近月契約。',
    source: {
      provider: 'TAIFEX',
      endpoint: TAIFEX_DAILY_FUTURES_URL,
      dataset: 'DailyMarketReportFut',
    },
  };
}

async function fetchTaifexNightFuture(date) {
  const result = await fetchJson(TAIFEX_DAILY_FUTURES_URL, { timeoutMs: 60000, retries: 3 });
  if (!result.ok) {
    return {
      schema_version: 1,
      target_date: compactDate(date),
      contract: 'TX',
      calculation_status: 'unavailable',
      available: false,
      change_percent: null,
      warning: `TAIFEX 來源取得失敗：${result.error || 'unknown error'}`,
      source_status: result,
    };
  }
  return {
    ...selectTaifexNightFuture(result.data, date, 'TX'),
    generated_at: new Date().toISOString(),
    source_status: {
      ok: true,
      status: result.status,
      fetched_at: result.fetched_at,
      row_count: Array.isArray(result.data) ? result.data.length : 0,
      first_row_keys: Array.isArray(result.data) && result.data[0] ? Object.keys(result.data[0]) : [],
    },
  };
}

function parseCliArgs(argv) {
  const options = { date: '', output: '' };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--date') options.date = argv[++index] || '';
    else if (arg === '--output') options.output = argv[++index] || '';
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return options;
}

async function main(argv = process.argv.slice(2)) {
  const options = parseCliArgs(argv);
  const result = await fetchTaifexNightFuture(options.date);
  if (options.output) {
    const output = path.resolve(ROOT, options.output);
    fs.mkdirSync(path.dirname(output), { recursive: true });
    fs.writeFileSync(output, `${JSON.stringify(result, null, 2)}\n`, 'utf8');
  }
  console.log(JSON.stringify(result));
  if (!result.available) process.exitCode = 3;
  return result;
}

if (require.main === module) {
  main().catch((error) => {
    console.error(`Error: ${error.stack || error.message}`);
    process.exitCode = 1;
  });
}

module.exports = {
  normalizeTaifexFuturesRows,
  isAfterHoursSession,
  contractMonthSortKey,
  selectTaifexNightFuture,
  fetchTaifexNightFuture,
  main,
};
