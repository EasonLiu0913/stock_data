#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const {
  ROOT,
  compactDate,
  finiteNumber,
  round,
} = require('./official_market_constraints');
const { stripHtml } = require('./taifex_date_query_probe');
const { fetchTaifexNightFuture: fetchOpenApiNightFuture } = require('./taifex_night_futures');

const TAIFEX_DATE_PAGE = 'https://www.taifex.com.tw/cht/3/futDailyMarketExcel';

function compactToSlash(date) {
  const compact = compactDate(date);
  if (!compact) throw new Error('date must be YYYYMMDD');
  return `${compact.slice(0, 4)}/${compact.slice(4, 6)}/${compact.slice(6, 8)}`;
}

function signedNumber(marker, value) {
  const number = finiteNumber(value);
  if (number === null) return null;
  return String(marker || '').includes('▼') ? -Math.abs(number) : number;
}

function parseFrontMonthTxFromHtml(html, date) {
  const target = compactDate(date);
  if (!target) throw new Error('date must be YYYYMMDD');
  const targetSlash = compactToSlash(target);
  const text = stripHtml(html);
  const containsTargetDate = text.includes(`日期： ${targetSlash}`)
    || text.includes(`日期: ${targetSlash}`)
    || text.includes(targetSlash);
  const containsAfterHours = /盤後交易時段行情表|15:00~次日05:00/.test(text);
  if (!containsTargetDate || !containsAfterHours) {
    return {
      available: false,
      calculation_status: 'unavailable',
      target_date: target,
      contract: 'TX',
      change_percent: null,
      warning: !containsTargetDate
        ? 'TAIFEX 指定日期頁未包含目標日期。'
        : 'TAIFEX 指定日期頁未標示盤後交易時段。',
      diagnostics: { contains_target_date: containsTargetDate, contains_after_hours: containsAfterHours },
    };
  }

  const rows = [];
  const pattern = /\bTX\s+(20\d{4}(?:W\d+)?)\s+([\d,.-]+)\s+([\d,.-]+)\s+([\d,.-]+)\s+([\d,.-]+)\s+([▲▼]?)([+-]?[\d,.]+)\s+([▲▼]?)([+-]?[\d,.]+)%\s+([\d,.-]+)/g;
  let match;
  while ((match = pattern.exec(text)) !== null) {
    const row = {
      contract_month: match[1],
      open: finiteNumber(match[2]),
      high: finiteNumber(match[3]),
      low: finiteNumber(match[4]),
      last: finiteNumber(match[5]),
      change: signedNumber(match[6], match[7]),
      change_percent: signedNumber(match[8], match[9]),
      volume: finiteNumber(match[10]),
    };
    if (row.last !== null && row.change_percent !== null && (row.volume ?? 0) > 0) rows.push(row);
  }
  rows.sort((left, right) => String(left.contract_month).localeCompare(String(right.contract_month))
    || (right.volume ?? 0) - (left.volume ?? 0));
  const selected = rows[0] || null;
  const sessionStart = text.match(/(20\d{2}\/\d{2}\/\d{2})\s+15:00~次日05:00/)?.[1] || null;
  return {
    schema_version: 1,
    target_date: target,
    contract: 'TX',
    calculation_status: selected ? 'completed' : 'unavailable',
    available: Boolean(selected),
    change_percent: selected ? round(selected.change_percent, 4) : null,
    selected_contract_month: selected?.contract_month || null,
    trading_session: selected ? '盤後交易時段' : null,
    session_start_date: sessionStart ? sessionStart.replaceAll('/', '') : null,
    session_time: selected ? '15:00~次日05:00' : null,
    open: selected?.open ?? null,
    high: selected?.high ?? null,
    low: selected?.low ?? null,
    last: selected?.last ?? null,
    change: selected?.change ?? null,
    volume: selected?.volume ?? null,
    candidate_count: rows.length,
    warning: selected ? null : 'TAIFEX 指定日期盤後頁找不到有成交的 TX 近月契約。',
    diagnostics: {
      contains_target_date: containsTargetDate,
      contains_after_hours: containsAfterHours,
    },
  };
}

async function fetchText(url, { timeoutMs = 45000, retries = 3 } = {}) {
  let lastError = null;
  for (let attempt = 1; attempt <= retries; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(url, {
        headers: {
          accept: 'text/html,application/xhtml+xml,application/vnd.ms-excel,*/*',
          'user-agent': 'Mozilla/5.0 (compatible; EasonLiu0913-stock_data/1.0)',
        },
        redirect: 'follow',
        signal: controller.signal,
      });
      const text = await response.text();
      if (!response.ok) throw new Error(`HTTP ${response.status}: ${text.slice(0, 200)}`);
      return {
        ok: true,
        status: response.status,
        attempt,
        fetched_at: new Date().toISOString(),
        content_type: response.headers.get('content-type'),
        final_url: response.url,
        text,
      };
    } catch (error) {
      lastError = error;
      if (attempt < retries) await new Promise((resolve) => setTimeout(resolve, attempt * 1500));
    } finally {
      clearTimeout(timer);
    }
  }
  return { ok: false, error: lastError?.message || 'unknown_fetch_error', text: null };
}

async function fetchOfficialTaifexNightFuture(date) {
  const target = compactDate(date);
  if (!target) throw new Error('date must be YYYYMMDD');
  const queryDate = compactToSlash(target);
  const url = `${TAIFEX_DATE_PAGE}?commodity_id=TX&marketCode=1&queryDate=${encodeURIComponent(queryDate)}`;
  const primary = await fetchText(url);
  if (primary.ok) {
    const parsed = parseFrontMonthTxFromHtml(primary.text, target);
    if (parsed.available) {
      return {
        ...parsed,
        generated_at: new Date().toISOString(),
        source: {
          provider: 'TAIFEX',
          endpoint: TAIFEX_DATE_PAGE,
          source_type: 'date_specific_after_hours_page',
          query: { commodity_id: 'TX', marketCode: '1', queryDate },
        },
        source_status: {
          ok: true,
          status: primary.status,
          fetched_at: primary.fetched_at,
          content_type: primary.content_type,
          final_url: primary.final_url,
        },
      };
    }
  }

  const fallback = await fetchOpenApiNightFuture(target);
  if (fallback.available) {
    return {
      ...fallback,
      fallback_used: true,
      primary_source_warning: primary.ok
        ? parseFrontMonthTxFromHtml(primary.text, target).warning
        : `TAIFEX 指定日期頁取得失敗：${primary.error || 'unknown error'}`,
    };
  }
  return {
    schema_version: 1,
    target_date: target,
    contract: 'TX',
    calculation_status: 'unavailable',
    available: false,
    change_percent: null,
    generated_at: new Date().toISOString(),
    source: {
      provider: 'TAIFEX',
      endpoint: TAIFEX_DATE_PAGE,
      source_type: 'date_specific_after_hours_page',
      query: { commodity_id: 'TX', marketCode: '1', queryDate },
    },
    source_status: {
      ok: primary.ok,
      status: primary.status || null,
      fetched_at: primary.fetched_at || null,
      error: primary.error || null,
    },
    fallback_source_status: fallback.source_status || null,
    warning: primary.ok
      ? parseFrontMonthTxFromHtml(primary.text, target).warning
      : `TAIFEX 指定日期頁取得失敗：${primary.error || 'unknown error'}`,
  };
}

function parseArgs(argv) {
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
  const options = parseArgs(argv);
  const result = await fetchOfficialTaifexNightFuture(options.date);
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
  TAIFEX_DATE_PAGE,
  compactToSlash,
  signedNumber,
  parseFrontMonthTxFromHtml,
  fetchText,
  fetchOfficialTaifexNightFuture,
  main,
};
