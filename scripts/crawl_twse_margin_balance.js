#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const LATEST_API_URL = 'https://www.twse.com.tw/exchangeReport/MI_MARGN?response=open_data&selectType=ALL';
const HISTORICAL_API_URL = 'https://www.twse.com.tw/rwd/zh/marginTrading/MI_MARGN';
const OUTPUT_DIR = path.join(__dirname, '../data_twse_margin_balance');
const OUTPUT_SUFFIX = 'twse_margin_balance';
const CSV_HEADERS = Object.freeze([
  '股票代號', '股票名稱',
  '融資買進', '融資賣出', '融資現金償還', '融資前日餘額', '融資今日餘額', '融資限額',
  '融券買進', '融券賣出', '融券現券償還', '融券前日餘額', '融券今日餘額', '融券限額',
  '資券互抵', '註記',
]);

function getArg(argv, flag, fallback = null) {
  const index = argv.indexOf(flag);
  return index >= 0 && argv[index + 1] !== undefined ? argv[index + 1] : fallback;
}

function hasFlag(argv, flag) {
  return argv.includes(flag);
}

function getNonNegativeInteger(argv, flag, fallback) {
  const value = Number(getArg(argv, flag, fallback));
  if (!Number.isInteger(value) || value < 0) throw new Error(`Invalid ${flag}: ${value}`);
  return value;
}

function normalizeDate(value) {
  if (!value) return '';
  const normalized = String(value).replace(/[^\d]/g, '');
  if (!/^20\d{6}$/.test(normalized)) {
    throw new Error(`Invalid date: ${value}. Expected YYYYMMDD, YYYY-MM-DD, or YYYY/MM/DD.`);
  }
  return normalized;
}

function normalizePayloadDate(value) {
  const text = String(value || '').trim();
  const western = text.match(/(20\d{2})\D?(\d{1,2})\D?(\d{1,2})/);
  if (western) return `${western[1]}${western[2].padStart(2, '0')}${western[3].padStart(2, '0')}`;
  const roc = text.match(/(\d{3})\D?(\d{1,2})\D?(\d{1,2})/);
  if (roc) return `${Number(roc[1]) + 1911}${roc[2].padStart(2, '0')}${roc[3].padStart(2, '0')}`;
  return '';
}

function getDateFromContentDisposition(value) {
  const match = String(value || '').match(/MI_MARGN_ALL_(\d{8})\.csv/i);
  return match ? match[1] : '';
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = '';
  let quoted = false;
  const input = String(text || '').replace(/^\uFEFF/, '');
  for (let index = 0; index < input.length; index += 1) {
    const char = input[index];
    const next = input[index + 1];
    if (quoted && char === '"' && next === '"') {
      cell += '"';
      index += 1;
    } else if (char === '"') quoted = !quoted;
    else if (char === ',' && !quoted) {
      row.push(cell);
      cell = '';
    } else if ((char === '\n' || char === '\r') && !quoted) {
      if (char === '\r' && next === '\n') index += 1;
      row.push(cell);
      if (row.some(value => value !== '')) rows.push(row);
      row = [];
      cell = '';
    } else cell += char;
  }
  if (cell !== '' || row.length) {
    row.push(cell);
    if (row.some(value => value !== '')) rows.push(row);
  }
  return rows;
}

function validateCsv(csvText) {
  const rows = parseCsv(csvText);
  if (rows.length < 2) throw new Error('TWSE margin balance CSV does not contain any data rows.');
  for (const header of ['股票代號', '股票名稱', '融資今日餘額', '融券今日餘額']) {
    if (!rows[0].includes(header)) throw new Error(`TWSE margin balance CSV missing header: ${header}`);
  }
  return rows.length - 1;
}

function csvEscape(value) {
  const text = String(value ?? '').replace(/<br\s*\/?\s*>/gi, '').trim();
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function normalizeField(value) {
  return String(value || '')
    .replace(/<br\s*\/?\s*>/gi, '')
    .replace(/\s+/g, '')
    .replace(/[（）()]/g, '')
    .trim();
}

function findStockTable(payload) {
  return (payload?.tables || []).find(table => {
    const fields = (table?.fields || []).map(normalizeField);
    return fields.includes('代號') && fields.includes('名稱') && fields.length >= 16 && Array.isArray(table?.data);
  }) || null;
}

function buildOpenDataCsv(payload, expectedDate = '') {
  if (!payload || payload.stat !== 'OK') {
    throw new Error(`TWSE historical margin response is not OK: ${payload?.stat || 'missing stat'}`);
  }
  const payloadDate = normalizePayloadDate(payload.date || payload.title || '');
  if (expectedDate && payloadDate && payloadDate !== expectedDate) {
    throw new Error(`TWSE returned ${payloadDate} for requested ${expectedDate}`);
  }
  const table = findStockTable(payload);
  if (!table) throw new Error('TWSE historical margin payload is missing the stock detail table.');
  const rows = (table.data || [])
    .filter(row => {
      const code = String(row?.[0] || '').trim();
      const name = String(row?.[1] || '').trim();
      return code && name && name !== '合計';
    })
    .map(row => CSV_HEADERS.map((_, index) => csvEscape(row[index])).join(','));
  if (!rows.length) throw new Error('TWSE historical margin payload contains no stock rows.');
  return `${CSV_HEADERS.join(',')}\n${rows.join('\n')}\n`;
}

function refreshFilesJson(outputDir = OUTPUT_DIR) {
  fs.mkdirSync(outputDir, { recursive: true });
  const files = fs.readdirSync(outputDir)
    .filter(file => new RegExp(`^\\d{8}_${OUTPUT_SUFFIX}\\.csv$`).test(file))
    .sort();
  fs.writeFileSync(path.join(outputDir, 'files.json'), `${JSON.stringify(files, null, 2)}\n`, 'utf8');
}

function randomDelay(minMs, maxMs, randomFn = Math.random) {
  if (!Number.isInteger(minMs) || !Number.isInteger(maxMs) || minMs < 0 || maxMs < minMs) {
    throw new Error(`Invalid delay range: ${minMs}-${maxMs}`);
  }
  return minMs === maxMs ? minMs : minMs + Math.floor(randomFn() * (maxMs - minMs + 1));
}

function sleep(milliseconds) {
  return new Promise(resolve => setTimeout(resolve, milliseconds));
}

async function fetchLatestCsv(fetchImpl = fetch) {
  const response = await fetchImpl(LATEST_API_URL, {
    headers: {
      accept: 'text/csv,*/*',
      'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/122.0 Safari/537.36',
    },
  });
  if (!response.ok) throw new Error(`TWSE margin balance request failed: ${response.status} ${response.statusText}`);
  const date = getDateFromContentDisposition(response.headers.get('content-disposition'));
  if (!date) throw new Error('TWSE margin balance response filename did not include a YYYYMMDD date.');
  return { date, text: await response.text(), source: LATEST_API_URL };
}

async function fetchHistoricalCsv(expectedDate, fetchImpl = fetch) {
  const url = `${HISTORICAL_API_URL}?date=${expectedDate}&selectType=ALL&response=json`;
  const response = await fetchImpl(url, {
    headers: {
      accept: 'application/json, text/plain, */*',
      'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/122.0 Safari/537.36',
    },
  });
  if (!response.ok) throw new Error(`TWSE historical margin request failed: ${response.status} ${response.statusText}`);
  const payload = await response.json();
  return { date: expectedDate, text: buildOpenDataCsv(payload, expectedDate), source: url };
}

async function crawlDate(options = {}) {
  const expectedDate = normalizeDate(options.date);
  const outputDir = path.resolve(options.outputDir || OUTPUT_DIR);
  const force = Boolean(options.force);
  const maxRetries = Number.isInteger(options.maxRetries) ? options.maxRetries : 3;
  const minDelayMs = Number.isInteger(options.minDelayMs) ? options.minDelayMs : 0;
  const maxDelayMs = Number.isInteger(options.maxDelayMs) ? options.maxDelayMs : minDelayMs;
  const retryCooldownMs = Number.isInteger(options.retryCooldownMs) ? options.retryCooldownMs : 60000;
  const fetchImpl = options.fetchImpl || fetch;
  const sleepImpl = options.sleepImpl || sleep;
  const logger = options.logger || console;

  if (expectedDate) {
    const existing = path.join(outputDir, `${expectedDate}_${OUTPUT_SUFFIX}.csv`);
    if (!force && fs.existsSync(existing)) {
      try {
        validateCsv(fs.readFileSync(existing, 'utf8'));
        return { status: 'skipped-existing', date: expectedDate, outputPath: existing };
      } catch {
        logger.warn(`Existing margin file is invalid and will be replaced: ${existing}`);
      }
    }
  }

  let lastError = null;
  for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
    try {
      if (minDelayMs || maxDelayMs) {
        const delay = randomDelay(minDelayMs, maxDelayMs, options.randomFn || Math.random);
        if (delay) {
          logger.log(`🕒 Waiting ${delay}ms before TWSE margin request`);
          await sleepImpl(delay);
        }
      }
      const payload = expectedDate
        ? await fetchHistoricalCsv(expectedDate, fetchImpl)
        : await fetchLatestCsv(fetchImpl);
      if (expectedDate && payload.date !== expectedDate) {
        throw new Error(`TWSE returned ${payload.date} for requested ${expectedDate}`);
      }
      const rowCount = validateCsv(payload.text);
      fs.mkdirSync(outputDir, { recursive: true });
      const outputFile = `${payload.date}_${OUTPUT_SUFFIX}.csv`;
      const outputPath = path.join(outputDir, outputFile);
      const temporary = `${outputPath}.tmp-${process.pid}`;
      fs.writeFileSync(temporary, payload.text, 'utf8');
      fs.renameSync(temporary, outputPath);
      refreshFilesJson(outputDir);
      return { status: 'created', date: payload.date, outputPath, rowCount, source: payload.source };
    } catch (error) {
      lastError = error;
      if (attempt >= maxRetries) break;
      const cooldown = retryCooldownMs * (2 ** attempt);
      logger.warn(`TWSE margin attempt ${attempt + 1} failed: ${error.message}; retry in ${cooldown}ms`);
      await sleepImpl(cooldown);
    }
  }
  throw lastError;
}

async function main(argv = process.argv.slice(2)) {
  const result = await crawlDate({
    date: getArg(argv, '--date', ''),
    outputDir: getArg(argv, '--output-dir', OUTPUT_DIR),
    force: hasFlag(argv, '--force'),
    maxRetries: getNonNegativeInteger(argv, '--max-retries', 3),
    minDelayMs: getNonNegativeInteger(argv, '--min-delay-ms', 0),
    maxDelayMs: getNonNegativeInteger(argv, '--max-delay-ms', 0),
    retryCooldownMs: getNonNegativeInteger(argv, '--retry-cooldown-ms', 60000),
  });
  console.log(`${result.status === 'created' ? 'Saved' : 'Skipped'} ${path.basename(result.outputPath)}`);
  if (result.rowCount) console.log(`Rows: ${result.rowCount}`);
  if (result.source) console.log(`Source: ${result.source}`);
}

if (require.main === module) {
  main().catch(error => {
    console.error(`Failed to crawl TWSE margin balance data: ${error.message}`);
    process.exit(1);
  });
}

module.exports = {
  CSV_HEADERS,
  LATEST_API_URL,
  HISTORICAL_API_URL,
  normalizeDate,
  normalizePayloadDate,
  getDateFromContentDisposition,
  parseCsv,
  validateCsv,
  csvEscape,
  findStockTable,
  buildOpenDataCsv,
  refreshFilesJson,
  randomDelay,
  fetchLatestCsv,
  fetchHistoricalCsv,
  crawlDate,
  main,
};
