#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const TWSE_DISPOSITION_URL = 'https://openapi.twse.com.tw/v1/announcement/punish';
const TPEX_DISPOSITION_URL = 'https://www.tpex.org.tw/openapi/v1/tpex_disposal_information';
const TAIFEX_DAILY_FUTURES_URL = 'https://openapi.taifex.com.tw/v1/DailyMarketReportFut';

function compactDate(value) {
  const digits = String(value || '').replace(/\D/g, '');
  if (/^20\d{6}$/.test(digits)) return digits;
  return '';
}

function finiteNumber(value) {
  if (value === null || value === undefined || value === '') return null;
  const normalized = String(value)
    .replaceAll(',', '')
    .replaceAll('%', '')
    .replace(/[▲▼+]/g, '')
    .trim();
  if (!normalized || normalized === '-' || normalized === '--') return null;
  const number = Number(normalized);
  return Number.isFinite(number) ? number : null;
}

function round(value, digits = 2) {
  return Number.isFinite(value) ? Number(value.toFixed(digits)) : null;
}

function normalizedKey(value) {
  return String(value || '')
    .normalize('NFKC')
    .replace(/[\s_()（）/％%\-]/g, '')
    .toLowerCase();
}

function pick(record, aliases) {
  if (!record || typeof record !== 'object') return null;
  const lookup = new Map(Object.entries(record).map(([key, value]) => [normalizedKey(key), value]));
  for (const alias of aliases) {
    const value = lookup.get(normalizedKey(alias));
    if (value !== undefined && value !== null && value !== '') return value;
  }
  return null;
}

function rocDateToCompact(value) {
  const text = String(value || '').trim();
  if (!text) return '';
  const digits = text.replace(/\D/g, '');
  if (/^20\d{6}$/.test(digits)) return digits;
  if (/^\d{7}$/.test(digits)) {
    const year = Number(digits.slice(0, 3)) + 1911;
    return `${year}${digits.slice(3)}`;
  }
  const parts = text.match(/^(\d{2,4})\D+(\d{1,2})\D+(\d{1,2})$/);
  if (parts) {
    let year = Number(parts[1]);
    if (year < 1911) year += 1911;
    const month = String(Number(parts[2])).padStart(2, '0');
    const day = String(Number(parts[3])).padStart(2, '0');
    const compact = `${year}${month}${day}`;
    return /^20\d{6}$/.test(compact) ? compact : '';
  }
  return '';
}

function parseDispositionPeriod(value) {
  const text = String(value || '').trim();
  if (!text) return { start: '', end: '', raw: text };
  const parts = text.split(/\s*(?:～|~|至|－|—)\s*/).filter(Boolean);
  if (parts.length < 2) return { start: '', end: '', raw: text };
  return {
    start: rocDateToCompact(parts[0]),
    end: rocDateToCompact(parts[1]),
    raw: text,
  };
}

function isActiveOnDate(record, date) {
  const target = compactDate(date);
  return Boolean(target && record.period_start && record.period_end
    && record.period_start <= target && target <= record.period_end);
}

function detectBoardType(measures, detail) {
  const text = `${measures || ''}\n${detail || ''}`;
  if (/二十\s*分鐘|20\s*分鐘|每二十分鐘|第二次處置/.test(text)) return '20分鐘撮合';
  if (/五\s*分鐘|5\s*分鐘|每五分鐘|第一次處置/.test(text)) return '5分鐘撮合';
  return '處置交易';
}

function normalizeTwseDispositionRows(rows) {
  if (!Array.isArray(rows)) return [];
  return rows.map((row) => {
    const period = parseDispositionPeriod(row.DispositionPeriod ?? row['處置起迄時間']);
    const measures = row.DispositionMeasures ?? row['處置措施'] ?? '';
    const detail = row.Detail ?? row['處置內容'] ?? '';
    return {
      market: 'TWSE',
      announcement_date: rocDateToCompact(row.Date ?? row['公布日期']),
      code: String(row.Code ?? row['證券代號'] ?? '').trim(),
      name: String(row.Name ?? row['證券名稱'] ?? '').trim(),
      announcement_count: finiteNumber(row.NumberOfAnnouncement ?? row['累計']),
      reason: String(row.ReasonsOfDisposition ?? row['處置條件'] ?? '').trim(),
      measures: String(measures).trim(),
      detail: String(detail).trim(),
      board_type: detectBoardType(measures, detail),
      period_start: period.start,
      period_end: period.end,
      period_raw: period.raw,
    };
  }).filter((row) => row.code && row.period_start && row.period_end);
}

function normalizeTpexDispositionRows(rows) {
  if (!Array.isArray(rows)) return [];
  return rows.map((row) => {
    const periodRaw = pick(row, [
      'DispositionPeriod', 'DispositionDate', 'DispositionDuration',
      '處置期間', '處置起迄時間',
    ]);
    const measures = pick(row, [
      'DispositionMeasures', 'DispositionMeasure', 'DisposalMeasures', 'DisposalMeasure',
      '處置措施',
    ]) || '';
    const reason = pick(row, [
      'DisposalCondition', 'DispositionCondition', 'ReasonsOfDisposition',
      '處置條件', '處置原因',
    ]) || '';
    const detail = pick(row, [
      'Detail', 'DispositionContent', 'DisposalContent', '處置內容',
    ]) || '';
    const period = parseDispositionPeriod(periodRaw);
    return {
      market: 'TPEX',
      announcement_date: rocDateToCompact(pick(row, [
        'DateOfAnnouncement', 'AnnouncementDate', 'Date', '公布日期',
      ])),
      code: String(pick(row, [
        'SecuritiesCompanyCode', 'SecuritiesCode', 'SecurityCode', 'Code',
        '證券代號',
      ]) || '').trim(),
      name: String(pick(row, [
        'CompanyName', 'SecuritiesName', 'SecurityName', 'Name', '證券名稱',
      ]) || '').trim(),
      announcement_count: finiteNumber(pick(row, [
        'NumberOfAnnouncement', 'AnnouncementCount', '累計',
      ])),
      reason: String(reason).trim(),
      measures: String(measures).trim(),
      detail: String(detail).trim(),
      board_type: detectBoardType(measures, `${reason}\n${detail}`),
      period_start: period.start,
      period_end: period.end,
      period_raw: period.raw,
    };
  }).filter((row) => row.code && row.period_start && row.period_end);
}

function buildDispositionSnapshot({ date, twseRows, tpexRows, sourceStatus = {} }) {
  const target = compactDate(date);
  if (!target) throw new Error('date must be YYYYMMDD');
  const records = [
    ...normalizeTwseDispositionRows(twseRows),
    ...normalizeTpexDispositionRows(tpexRows),
  ].map((row) => ({ ...row, active_on_target_date: isActiveOnDate(row, target) }));
  const active = records.filter((row) => row.active_on_target_date);
  const activeStocks = active.filter((row) => /^\d{4}$/.test(row.code));
  const complete = sourceStatus.twse?.ok === true && sourceStatus.tpex?.ok === true;
  const warnings = [];
  if (sourceStatus.twse?.ok !== true) warnings.push('TWSE 處置有價證券來源取得失敗。');
  if (sourceStatus.tpex?.ok !== true) warnings.push('TPEx 處置有價證券來源取得失敗。');
  if (!complete) warnings.push('上市與上櫃來源未同時成功，不能宣稱已完成全市場處置股排除。');
  return {
    schema_version: 1,
    target_date: target,
    generated_at: new Date().toISOString(),
    calculation_status: complete ? 'completed' : 'partial',
    complete_market_coverage: complete,
    source_status: sourceStatus,
    record_count: records.length,
    active_record_count: active.length,
    active_stock_count: activeStocks.length,
    active_stock_codes: [...new Set(activeStocks.map((row) => row.code))].sort(),
    active_records: active,
    warnings,
  };
}

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
      'ChangePercent', 'Change%', 'ChangeRate', '漲跌%', '漲跌百分比',
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
      raw: row,
    };
  });
}

function isAfterHoursSession(value) {
  const text = String(value || '').normalize('NFKC').trim().toLowerCase();
  if (!text) return false;
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
  const matchingDateContract = normalized.filter((row) => row.trade_date === target && row.contract === contract);
  const sessions = [...new Set(matchingDateContract.map((row) => row.trading_session).filter(Boolean))];
  const afterHours = matchingDateContract
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
    candidate_count: afterHours.length,
    observed_session_values: sessions,
    warning: selected ? null : '找不到目標日期、TX、盤後交易時段且有成交的近月契約。',
  };
}

async function fetchJson(url, { timeoutMs = 30000, retries = 3 } = {}) {
  let lastError = null;
  for (let attempt = 1; attempt <= retries; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(url, {
        headers: {
          accept: 'application/json,text/plain,*/*',
          'user-agent': 'EasonLiu0913-stock_data/official-market-constraints-v1',
        },
        signal: controller.signal,
      });
      const text = await response.text();
      if (!response.ok) throw new Error(`HTTP ${response.status}: ${text.slice(0, 200)}`);
      const data = JSON.parse(text.replace(/^\uFEFF/, ''));
      return {
        ok: true,
        status: response.status,
        attempt,
        fetched_at: new Date().toISOString(),
        content_type: response.headers.get('content-type'),
        data,
      };
    } catch (error) {
      lastError = error;
      if (attempt < retries) await new Promise((resolve) => setTimeout(resolve, attempt * 1500));
    } finally {
      clearTimeout(timer);
    }
  }
  return {
    ok: false,
    status: null,
    fetched_at: new Date().toISOString(),
    error: lastError?.message || 'unknown_fetch_error',
    data: null,
  };
}

async function probeOfficialSources({ date }) {
  const target = compactDate(date);
  if (!target) throw new Error('date must be YYYYMMDD');
  const [twse, tpex, taifex] = await Promise.all([
    fetchJson(TWSE_DISPOSITION_URL),
    fetchJson(TPEX_DISPOSITION_URL),
    fetchJson(TAIFEX_DAILY_FUTURES_URL, { timeoutMs: 60000, retries: 3 }),
  ]);
  const disposition = buildDispositionSnapshot({
    date: target,
    twseRows: twse.data,
    tpexRows: tpex.data,
    sourceStatus: {
      twse: { ok: twse.ok, status: twse.status, error: twse.error || null, url: TWSE_DISPOSITION_URL },
      tpex: { ok: tpex.ok, status: tpex.status, error: tpex.error || null, url: TPEX_DISPOSITION_URL },
    },
  });
  const nightFutures = taifex.ok
    ? selectTaifexNightFuture(taifex.data, target, 'TX')
    : {
      schema_version: 1,
      target_date: target,
      contract: 'TX',
      calculation_status: 'unavailable',
      available: false,
      change_percent: null,
      warning: `TAIFEX 來源取得失敗：${taifex.error || 'unknown error'}`,
    };
  nightFutures.source_status = {
    ok: taifex.ok,
    status: taifex.status,
    error: taifex.error || null,
    url: TAIFEX_DAILY_FUTURES_URL,
  };
  return {
    schema_version: 1,
    target_date: target,
    generated_at: new Date().toISOString(),
    disposition,
    night_futures: nightFutures,
    source_shapes: {
      twse_first_row_keys: Array.isArray(twse.data) && twse.data[0] ? Object.keys(twse.data[0]) : [],
      tpex_first_row_keys: Array.isArray(tpex.data) && tpex.data[0] ? Object.keys(tpex.data[0]) : [],
      taifex_first_row_keys: Array.isArray(taifex.data) && taifex.data[0] ? Object.keys(taifex.data[0]) : [],
      twse_row_count: Array.isArray(twse.data) ? twse.data.length : 0,
      tpex_row_count: Array.isArray(tpex.data) ? tpex.data.length : 0,
      taifex_row_count: Array.isArray(taifex.data) ? taifex.data.length : 0,
    },
  };
}

function parseCliArgs(argv) {
  const options = { date: '', output: '', allowPartial: false };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--date') options.date = argv[++index] || '';
    else if (arg === '--output') options.output = argv[++index] || '';
    else if (arg === '--allow-partial') options.allowPartial = true;
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return options;
}

async function main(argv = process.argv.slice(2)) {
  const options = parseCliArgs(argv);
  const result = await probeOfficialSources({ date: options.date });
  if (options.output) {
    const output = path.resolve(ROOT, options.output);
    fs.mkdirSync(path.dirname(output), { recursive: true });
    fs.writeFileSync(output, `${JSON.stringify(result, null, 2)}\n`, 'utf8');
  }
  console.log(JSON.stringify({
    target_date: result.target_date,
    disposition_status: result.disposition.calculation_status,
    disposition_active_stock_count: result.disposition.active_stock_count,
    night_futures_status: result.night_futures.calculation_status,
    night_futures_change_percent: result.night_futures.change_percent,
    source_shapes: result.source_shapes,
  }));
  if (!options.allowPartial) {
    if (!result.disposition.complete_market_coverage) process.exitCode = 2;
    if (!result.night_futures.available) process.exitCode = 3;
  }
  return result;
}

if (require.main === module) {
  main().catch((error) => {
    console.error(`Error: ${error.stack || error.message}`);
    process.exitCode = 1;
  });
}

module.exports = {
  ROOT,
  TWSE_DISPOSITION_URL,
  TPEX_DISPOSITION_URL,
  TAIFEX_DAILY_FUTURES_URL,
  compactDate,
  finiteNumber,
  round,
  normalizedKey,
  pick,
  rocDateToCompact,
  parseDispositionPeriod,
  isActiveOnDate,
  detectBoardType,
  normalizeTwseDispositionRows,
  normalizeTpexDispositionRows,
  buildDispositionSnapshot,
  normalizeTaifexFuturesRows,
  isAfterHoursSession,
  contractMonthSortKey,
  selectTaifexNightFuture,
  fetchJson,
  probeOfficialSources,
  main,
};
