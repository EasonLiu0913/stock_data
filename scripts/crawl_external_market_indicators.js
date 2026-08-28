#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const CONFIG_PATH = path.join(ROOT, 'config', 'external_market_indicators.json');
const OUTPUT_DIR = path.join(ROOT, 'data_external_market');
const DEFAULT_TIMEOUT_MS = 30000;
const NEW_YORK_TIME_ZONE = 'America/New_York';
const US_MARKET_OPEN_MINUTES = 9 * 60 + 30;
const US_MARKET_CLOSE_MINUTES = 16 * 60;
const PRIMARY_MARKET_INDICATOR_IDS = new Set(['nasdaq', 'sp500', 'dow', 'sox', 'tsm_adr']);

function parseArgs(argv) {
  const args = new Map();
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (!arg.startsWith('--')) continue;
    const key = arg.slice(2);
    const next = argv[index + 1];
    if (!next || next.startsWith('--')) args.set(key, true);
    else {
      args.set(key, next);
      index += 1;
    }
  }
  return args;
}

function normalizeCompactDate(value) {
  const text = String(value || '').replace(/[^\d]/g, '');
  if (!/^\d{8}$/.test(text)) throw new Error(`Invalid --date: ${value}`);
  return text;
}

function compactToIso(value) {
  return `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}`;
}

function isoToCompact(value) {
  return String(value || '').replaceAll('-', '');
}

function addDaysIso(iso, days) {
  const date = new Date(`${iso}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function previousWeekday(dateCompact) {
  let iso = addDaysIso(compactToIso(dateCompact), -1);
  while ([0, 6].includes(new Date(`${iso}T00:00:00Z`).getUTCDay())) {
    iso = addDaysIso(iso, -1);
  }
  return isoToCompact(iso);
}

function rollBackWeekend(dateCompact) {
  let iso = compactToIso(dateCompact);
  while ([0, 6].includes(new Date(`${iso}T00:00:00Z`).getUTCDay())) {
    iso = addDaysIso(iso, -1);
  }
  return isoToCompact(iso);
}

function zonedDateTimeParts(now, timeZone) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    timeZoneName: 'short',
    hourCycle: 'h23'
  }).formatToParts(now);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return {
    dateCompact: `${values.year}${values.month}${values.day}`,
    hour: Number(values.hour),
    minute: Number(values.minute),
    second: Number(values.second),
    zone: values.timeZoneName || null,
    text: `${values.year}-${values.month}-${values.day} ${values.hour}:${values.minute}:${values.second}${values.timeZoneName ? ` ${values.timeZoneName}` : ''}`
  };
}

function resolveAutomaticTargetDate(now = new Date()) {
  const newYork = zonedDateTimeParts(now, NEW_YORK_TIME_ZONE);
  const minutes = newYork.hour * 60 + newYork.minute;
  const sessionDate = minutes >= US_MARKET_OPEN_MINUTES
    ? rollBackWeekend(newYork.dateCompact)
    : previousWeekday(newYork.dateCompact);

  return {
    targetDate: sessionDate,
    newYorkTime: newYork.text,
    rule: minutes >= US_MARKET_OPEN_MINUTES
      ? 'new_york_date_at_or_after_09_30'
      : 'previous_weekday_before_09_30'
  };
}

function unixSeconds(iso) {
  return Math.floor(new Date(`${iso}T00:00:00Z`).getTime() / 1000);
}

function round(value, digits = 4) {
  return Number.isFinite(value) ? Number(value.toFixed(digits)) : null;
}

async function fetchJson(url, timeoutMs = DEFAULT_TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        accept: 'application/json, text/plain, */*',
        'user-agent': 'Mozilla/5.0 (compatible; stock-external-market-crawler/1.0)'
      }
    });
    if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
    return await response.json();
  } finally {
    clearTimeout(timer);
  }
}

function yahooChartUrl(symbol, targetDate) {
  const targetIso = compactToIso(targetDate);
  const period1 = unixSeconds(addDaysIso(targetIso, -14));
  const period2 = unixSeconds(addDaysIso(targetIso, 2));
  return `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?period1=${period1}&period2=${period2}&interval=1d&events=history&includeAdjustedClose=true`;
}

function parseYahooRows(payload) {
  const result = payload?.chart?.result?.[0];
  const timestamps = result?.timestamp || [];
  const quote = result?.indicators?.quote?.[0] || {};
  const adjclose = result?.indicators?.adjclose?.[0]?.adjclose || [];
  const rows = [];
  for (let index = 0; index < timestamps.length; index += 1) {
    const close = quote.close?.[index] ?? adjclose[index];
    if (!Number.isFinite(close)) continue;
    rows.push({
      date: new Date(timestamps[index] * 1000).toISOString().slice(0, 10).replaceAll('-', ''),
      open: round(quote.open?.[index]),
      high: round(quote.high?.[index]),
      low: round(quote.low?.[index]),
      close: round(close),
      volume: Number.isFinite(quote.volume?.[index]) ? quote.volume[index] : null,
      adjclose: round(adjclose[index])
    });
  }
  return rows.sort((left, right) => left.date.localeCompare(right.date));
}

function pickLatestRows(rows, targetDate) {
  const available = rows.filter((row) => row.date <= targetDate);
  const latest = available.at(-1) || null;
  const previous = available.at(-2) || null;
  return { latest, previous };
}

async function crawlIndicator(indicator, targetDate) {
  const url = yahooChartUrl(indicator.symbol, targetDate);
  const payload = await fetchJson(url);
  const rows = parseYahooRows(payload);
  const { latest, previous } = pickLatestRows(rows, targetDate);
  if (!latest) throw new Error(`No price rows for ${indicator.symbol}`);
  const change = previous ? latest.close - previous.close : null;
  const changePercent = previous && previous.close !== 0 ? (latest.close / previous.close - 1) * 100 : null;
  return {
    ...indicator,
    source: 'yahoo_finance_chart',
    requested_date: targetDate,
    market_date: latest.date,
    previous_market_date: previous?.date || null,
    open: latest.open,
    high: latest.high,
    low: latest.low,
    close: latest.close,
    previous_close: previous?.close ?? null,
    change: round(change),
    change_percent: round(changePercent),
    volume: latest.volume,
    rows
  };
}

function resolveActualMarketDate(indicators, targetDate) {
  const primaryRows = indicators.filter((item) =>
    PRIMARY_MARKET_INDICATOR_IDS.has(item.id) && /^\d{8}$/.test(String(item.market_date || ''))
  );
  if (!primaryRows.length) {
    throw new Error('Unable to resolve the U.S. market date because no primary U.S. equity indicator succeeded.');
  }

  const counts = new Map();
  for (const item of primaryRows) counts.set(item.market_date, (counts.get(item.market_date) || 0) + 1);
  const ranked = [...counts.entries()].sort((left, right) => right[1] - left[1] || right[0].localeCompare(left[0]));
  const [marketDate, agreementCount] = ranked[0];

  if (marketDate > targetDate) throw new Error(`Resolved market date ${marketDate} is later than query target ${targetDate}.`);

  return {
    marketDate,
    agreementCount,
    primaryIndicatorCount: primaryRows.length,
    primaryMarketDates: Object.fromEntries(primaryRows.map((item) => [item.id, item.market_date]))
  };
}

function snapshotStatus(targetDate, marketDateResolution, errors, now = new Date()) {
  const newYork = zonedDateTimeParts(now, NEW_YORK_TIME_ZONE);
  const minutes = newYork.hour * 60 + newYork.minute;
  let marketPhase = 'future';
  let marketClosed = false;

  if (targetDate < newYork.dateCompact) {
    marketPhase = 'closed';
    marketClosed = true;
  } else if (targetDate === newYork.dateCompact) {
    if (minutes < US_MARKET_OPEN_MINUTES) marketPhase = 'premarket';
    else if (minutes < US_MARKET_CLOSE_MINUTES) marketPhase = 'intraday';
    else {
      marketPhase = 'closed';
      marketClosed = true;
    }
  }

  const exactPrimaryDate = marketDateResolution.marketDate === targetDate;
  const fullAgreement = marketDateResolution.agreementCount === PRIMARY_MARKET_INDICATOR_IDS.size
    && marketDateResolution.primaryIndicatorCount === PRIMARY_MARKET_INDICATOR_IDS.size;
  const isFinal = marketClosed && exactPrimaryDate && fullAgreement && errors.length === 0;
  const dataStatus = isFinal ? 'final' : marketPhase === 'intraday' ? 'intraday' : 'provisional';

  let noteZhTw = '資料尚未符合最終收盤快照條件，後續排程應繼續重抓。';
  if (dataStatus === 'intraday') noteZhTw = '此快照於美股盤中抓取，數值可能持續變動，後續排程應更新。';
  if (isFinal) noteZhTw = '目標交易日已收盤，五項主要指標日期一致，可作為最終快照。';

  return {
    data_status: dataStatus,
    market_phase: marketPhase,
    is_market_closed: marketClosed,
    is_final: isFinal,
    needs_refresh: !isFinal,
    target_market_date: targetDate,
    actual_market_date: marketDateResolution.marketDate,
    captured_at: now.toISOString(),
    captured_at_new_york: newYork.text,
    note_zh_tw: noteZhTw
  };
}

function existingSnapshotIsFinal(file, targetDate) {
  if (!fs.existsSync(file) || fs.statSync(file).size === 0) return false;
  try {
    const payload = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (payload?.snapshot_status?.is_final === true
      && payload?.snapshot_status?.needs_refresh === false
      && payload?.collection_date === targetDate) return true;

    // Backward compatibility: historical exact snapshots created before snapshot_status existed.
    const primary = (payload?.indicators || []).filter((item) => PRIMARY_MARKET_INDICATOR_IDS.has(item.id));
    return !payload?.snapshot_status
      && payload?.collection_date === targetDate
      && primary.length === PRIMARY_MARKET_INDICATOR_IDS.size
      && primary.every((item) => item.market_date === targetDate)
      && (payload?.errors || []).length === 0;
  } catch {
    return false;
  }
}

function writeGitHubOutput(name, value) {
  if (!process.env.GITHUB_OUTPUT) return;
  fs.appendFileSync(process.env.GITHUB_OUTPUT, `${name}=${String(value)}\n`, 'utf8');
}

function refreshIndexes(generatedAt) {
  const dateDirs = fs.readdirSync(OUTPUT_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && /^\d{8}$/.test(entry.name))
    .map((entry) => entry.name)
    .sort();
  fs.writeFileSync(
    path.join(OUTPUT_DIR, 'files.json'),
    `${JSON.stringify(dateDirs.map((date) => `${date}/external_market_indicators.json`), null, 2)}\n`,
    'utf8'
  );

  const latestDate = dateDirs.at(-1) || null;
  fs.writeFileSync(path.join(OUTPUT_DIR, 'manifest.json'), `${JSON.stringify({
    schemaVersion: 1,
    generated_at: generatedAt,
    latest_date: latestDate,
    latest_file: latestDate ? `data_external_market/${latestDate}/external_market_indicators.json` : null,
    available_dates: dateDirs
  }, null, 2)}\n`, 'utf8');
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const explicitDate = args.get('date') ? normalizeCompactDate(args.get('date')) : null;
  const automaticResolution = explicitDate ? null : resolveAutomaticTargetDate();
  const targetDate = explicitDate || automaticResolution.targetDate;

  if (args.has('resolve-date')) {
    process.stdout.write(targetDate);
    return;
  }

  const config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
  const indicators = [];
  const errors = [];

  for (const indicator of config.indicators || []) {
    try {
      indicators.push(await crawlIndicator(indicator, targetDate));
    } catch (error) {
      errors.push({ id: indicator.id, symbol: indicator.symbol, error: error.message });
    }
  }

  const marketDateResolution = resolveActualMarketDate(indicators, targetDate);
  const collectionDate = marketDateResolution.marketDate;

  // Always persist under the requested/target market date. A provisional file is intentionally
  // overwritten by later scheduled crawls until snapshot_status.is_final becomes true.
  const outputDir = path.join(OUTPUT_DIR, targetDate);
  const outputFile = path.join(outputDir, 'external_market_indicators.json');
  const relativeOutputFile = path.relative(ROOT, outputFile).replaceAll(path.sep, '/');
  const status = snapshotStatus(targetDate, marketDateResolution, errors);

  writeGitHubOutput('market_date', collectionDate);
  writeGitHubOutput('output_file', relativeOutputFile);
  writeGitHubOutput('data_status', status.data_status);
  writeGitHubOutput('is_final', status.is_final ? 'true' : 'false');
  writeGitHubOutput('needs_refresh', status.needs_refresh ? 'true' : 'false');

  if (args.has('skip-existing') && existingSnapshotIsFinal(outputFile, targetDate)) {
    writeGitHubOutput('skipped', 'true');
    console.log(JSON.stringify({
      requested_date: targetDate,
      market_date: collectionDate,
      skipped: true,
      reason: 'final exact-date snapshot already exists',
      output: relativeOutputFile
    }));
    return;
  }

  const payload = {
    schemaVersion: 3,
    generated_at: status.captured_at,
    collection_date: collectionDate,
    requested_date: targetDate,
    snapshot_status: status,
    date_resolution: {
      mode: explicitDate ? 'explicit_date' : 'automatic_new_york_session',
      new_york_time_at_resolution: automaticResolution?.newYorkTime || status.captured_at_new_york,
      automatic_rule: automaticResolution?.rule || null,
      market_open_time: '09:30 America/New_York',
      market_close_time: '16:00 America/New_York',
      primary_indicator_agreement: `${marketDateResolution.agreementCount}/${marketDateResolution.primaryIndicatorCount}`,
      primary_market_dates: marketDateResolution.primaryMarketDates
    },
    source_config: path.relative(ROOT, CONFIG_PATH),
    crawler: path.relative(ROOT, __filename),
    indicator_count: indicators.length,
    error_count: errors.length,
    indicators,
    errors
  };

  fs.mkdirSync(outputDir, { recursive: true });
  fs.writeFileSync(outputFile, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  refreshIndexes(payload.generated_at);
  writeGitHubOutput('skipped', 'false');

  console.log(JSON.stringify({
    requested_date: targetDate,
    collection_date: collectionDate,
    data_status: status.data_status,
    is_final: status.is_final,
    needs_refresh: status.needs_refresh,
    captured_at: status.captured_at,
    captured_at_new_york: status.captured_at_new_york,
    indicators: indicators.length,
    errors: errors.length,
    skipped: false,
    output: relativeOutputFile
  }));
}

main().catch((error) => {
  console.error(`Failed to crawl external market indicators: ${error.message}`);
  process.exitCode = 1;
});
