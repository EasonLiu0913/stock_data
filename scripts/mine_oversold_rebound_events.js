#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const {
  DEFAULT_THRESHOLDS,
  finiteNumber,
  parseMarginCsv,
  parseInstitutionalPayload,
  parseBrokerPayload,
  buildEventsForSeries,
  enrichEvent,
  buildStockProfile,
  summarizeResearch,
} = require('./oversold_rebound_research_lib');

const ROOT = path.resolve(__dirname, '..');
const DEFAULT_OUTPUT_ROOT = path.join(ROOT, 'data_research', 'oversold-rebound');

function parseArgs(argv) {
  const options = {
    from: null,
    to: null,
    stocks: [],
    outputRoot: DEFAULT_OUTPUT_ROOT,
    dryRun: false,
    maxGap: 3,
    maxEpisodeSpan: 20,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = argv[index + 1];
    if (arg === '--from' || arg === '--to' || arg === '--stocks' || arg === '--output-root' || arg === '--max-gap' || arg === '--max-episode-span') {
      if (next === undefined) throw new Error(`${arg} 缺少值`);
      if (arg === '--from') options.from = compactDate(next, '--from');
      else if (arg === '--to') options.to = compactDate(next, '--to');
      else if (arg === '--stocks') options.stocks = next.split(',').map(value => value.trim().toUpperCase()).filter(Boolean);
      else if (arg === '--output-root') options.outputRoot = path.resolve(next);
      else if (arg === '--max-gap') options.maxGap = Number(next);
      else if (arg === '--max-episode-span') options.maxEpisodeSpan = Number(next);
      index += 1;
    } else if (arg === '--dry-run') options.dryRun = true;
    else if (arg === '--help' || arg === '-h') options.help = true;
    else throw new Error(`未知參數：${arg}`);
  }
  if (options.from && options.to && options.from > options.to) throw new Error('--from 不可晚於 --to');
  if (!Number.isInteger(options.maxGap) || options.maxGap < 1 || options.maxGap > 20) throw new Error('--max-gap 必須是 1 到 20 的整數');
  if (!Number.isInteger(options.maxEpisodeSpan) || options.maxEpisodeSpan < options.maxGap || options.maxEpisodeSpan > 120) {
    throw new Error('--max-episode-span 必須大於等於 max-gap，且不超過 120');
  }
  return options;
}

function printHelp() {
  console.log(`
個股跌深反彈歷史事件挖掘

用法：
  node scripts/mine_oversold_rebound_events.js [options]

選項：
  --from YYYYMMDD          只讀取此日期起的資料
  --to YYYYMMDD            只讀取此日期止的資料
  --stocks 2330,6443       僅分析指定股票
  --max-gap N              同一跌深事件允許的候選間隔，預設 3 個交易日
  --max-episode-span N     單一事件最長跨度，預設 20 個交易日
  --output-root PATH       輸出位置
  --dry-run                只分析與顯示摘要，不寫檔
  --help                   顯示說明

事件成立只使用個股歷史價量，不依賴外部市場預測資料。
`);
}

function compactDate(value, label = 'date') {
  const match = String(value || '').match(/^(20\d{2})[-/]?(\d{2})[-/]?(\d{2})$/);
  if (!match) throw new Error(`${label} 日期格式錯誤：${value}`);
  const compact = `${match[1]}${match[2]}${match[3]}`;
  const iso = `${match[1]}-${match[2]}-${match[3]}`;
  const parsed = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== iso) throw new Error(`${label} 日期不存在：${value}`);
  return compact;
}

function inRange(date, options) {
  return (!options.from || date >= options.from) && (!options.to || date <= options.to);
}

function listMatchingFiles(directory, regex, options) {
  if (!fs.existsSync(directory)) return [];
  return fs.readdirSync(directory, { withFileTypes: true })
    .filter(entry => entry.isFile())
    .map(entry => {
      const match = entry.name.match(regex);
      return match ? { file: path.join(directory, entry.name), name: entry.name, date: match[1] } : null;
    })
    .filter(item => item && inRange(item.date, options))
    .sort((left, right) => left.date.localeCompare(right.date));
}

function sourceQuality(files) {
  return {
    discovered_files: files.length,
    loaded_files: 0,
    empty_files: 0,
    invalid_files: 0,
    unsupported_files: 0,
    first_date: files[0]?.date || null,
    last_date: files.at(-1)?.date || null,
    dates: [],
  };
}

function readNonEmpty(file, quality) {
  const text = fs.readFileSync(file, 'utf8');
  if (!text.trim()) {
    quality.empty_files += 1;
    return null;
  }
  return text;
}

function loadPriceSeries(root, options) {
  const directory = path.join(root, 'data_fubon');
  const files = listMatchingFiles(directory, /^fubon_(20\d{6})_sma\.json$/, options);
  const quality = sourceQuality(files);
  const byStock = new Map();
  const requested = new Set(options.stocks || []);

  for (const item of files) {
    try {
      const text = readNonEmpty(item.file, quality);
      if (text === null) continue;
      const payload = JSON.parse(text);
      let accepted = 0;
      for (const [codeRaw, stock] of Object.entries(payload || {})) {
        const code = String(codeRaw).trim().toUpperCase();
        if (!code || (requested.size && !requested.has(code))) continue;
        const expectedKey = `${item.date.slice(0, 4)}/${item.date.slice(4, 6)}/${item.date.slice(6, 8)}`;
        const dateKey = stock && typeof stock === 'object' && stock[expectedKey]
          ? expectedKey
          : Object.keys(stock || {}).find(key => /^20\d{2}\/\d{2}\/\d{2}$/.test(key));
        const row = dateKey ? stock[dateKey] : null;
        const close = finiteNumber(row?.Price ?? row?.Close ?? row?.close);
        if (!Number.isFinite(close)) continue;
        const series = byStock.get(code) || {
          stock_code: code,
          stock_name: String(stock?.StockName || stock?.stock_name || '').trim(),
          rows: [],
        };
        series.rows.push({
          date: item.date,
          open: finiteNumber(row?.Open ?? row?.open) ?? close,
          high: finiteNumber(row?.High ?? row?.high) ?? close,
          low: finiteNumber(row?.Low ?? row?.low) ?? close,
          close,
          volume: finiteNumber(row?.Volume ?? row?.volume),
          sma5: finiteNumber(row?.SMA5 ?? row?.sma5),
          sma20: finiteNumber(row?.SMA20 ?? row?.sma20),
          sma60: finiteNumber(row?.SMA60 ?? row?.sma60),
          source_file: path.relative(root, item.file).replaceAll(path.sep, '/'),
        });
        if (!series.stock_name) series.stock_name = String(stock?.StockName || '').trim();
        byStock.set(code, series);
        accepted += 1;
      }
      if (accepted > 0) {
        quality.loaded_files += 1;
        quality.dates.push(item.date);
      } else quality.unsupported_files += 1;
    } catch (error) {
      quality.invalid_files += 1;
      console.warn(`[price] ${item.name}: ${error.message}`);
    }
  }

  for (const series of byStock.values()) {
    series.rows.sort((left, right) => left.date.localeCompare(right.date));
    series.rows = series.rows.filter((row, index, rows) => index === 0 || row.date !== rows[index - 1].date);
  }
  quality.stock_count = byStock.size;
  quality.trading_date_count = new Set(quality.dates).size;
  return { byStock, quality };
}

function loadJsonDailyMaps(root, directoryName, regex, parser, options) {
  const directory = path.join(root, directoryName);
  const files = listMatchingFiles(directory, regex, options);
  const quality = sourceQuality(files);
  const daily = new Map();
  for (const item of files) {
    try {
      const text = readNonEmpty(item.file, quality);
      if (text === null) continue;
      const parsed = parser(JSON.parse(text));
      if (!(parsed instanceof Map) || parsed.size === 0) {
        quality.unsupported_files += 1;
        continue;
      }
      daily.set(item.date, parsed);
      quality.loaded_files += 1;
      quality.dates.push(item.date);
    } catch (error) {
      quality.invalid_files += 1;
      console.warn(`[${directoryName}] ${item.name}: ${error.message}`);
    }
  }
  quality.trading_date_count = daily.size;
  return { daily, quality };
}

function loadMarginDailyMaps(root, options) {
  const directory = path.join(root, 'data_twse_margin_balance');
  const files = listMatchingFiles(directory, /^(20\d{6})_twse_margin_balance\.csv$/, options);
  const quality = sourceQuality(files);
  const daily = new Map();
  for (const item of files) {
    try {
      const text = readNonEmpty(item.file, quality);
      if (text === null) continue;
      const parsed = parseMarginCsv(text);
      if (!parsed.size) {
        quality.unsupported_files += 1;
        continue;
      }
      daily.set(item.date, parsed);
      quality.loaded_files += 1;
      quality.dates.push(item.date);
    } catch (error) {
      quality.invalid_files += 1;
      console.warn(`[margin] ${item.name}: ${error.message}`);
    }
  }
  quality.trading_date_count = daily.size;
  return { daily, quality };
}

function loadAllSources(root, options) {
  const prices = loadPriceSeries(root, options);
  const foreign = loadJsonDailyMaps(
    root,
    'data_twse_foreign_investors',
    /^(20\d{6})_twse_foreign_investors\.json$/,
    parseInstitutionalPayload,
    options,
  );
  const trust = loadJsonDailyMaps(
    root,
    'data_twse_investment_trust',
    /^(20\d{6})_twse_investment_trust\.json$/,
    parseInstitutionalPayload,
    options,
  );
  const dealers = loadJsonDailyMaps(
    root,
    'data_twse_dealers',
    /^(20\d{6})_twse_dealers\.json$/,
    parseInstitutionalPayload,
    options,
  );
  const margin = loadMarginDailyMaps(root, options);
  const brokers = loadJsonDailyMaps(
    root,
    'data_fubon_broker_details',
    /^fubon_(20\d{6})_券商分點進出明細\.json$/,
    parseBrokerPayload,
    options,
  );
  return { prices, foreign, trust, dealers, margin, brokers };
}

function atomicWriteJson(file, payload) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const temporary = `${file}.tmp-${process.pid}`;
  fs.writeFileSync(temporary, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  fs.renameSync(temporary, file);
}

function cleanGeneratedDirectories(outputRoot) {
  for (const directory of ['events', 'profiles']) {
    fs.rmSync(path.join(outputRoot, directory), { recursive: true, force: true });
  }
}

function buildManifest(options, summary, stockResults) {
  return {
    schema_version: 1,
    generated_at: summary.generated_at,
    research_id: summary.research_id,
    label: summary.label,
    date_range: {
      requested_from: options.from,
      requested_to: options.to,
      actual_from: summary.data_quality.price.first_date,
      actual_to: summary.data_quality.price.last_date,
    },
    filters: {
      stocks: options.stocks,
      max_gap: options.maxGap,
      max_episode_span: options.maxEpisodeSpan,
    },
    stock_count: summary.stock_count,
    event_count: summary.event_count,
    files: {
      summary: 'summary.json',
      data_quality: 'data-quality.json',
      event_index: 'event-index.json',
      events_directory: 'events',
      profiles_directory: 'profiles',
    },
    stocks: stockResults.map(result => ({
      stock_code: result.stock_code,
      stock_name: result.stock_name,
      event_count: result.events.length,
      event_file: `events/${result.stock_code}.json`,
      profile_file: `profiles/${result.stock_code}.json`,
    })),
  };
}

function compactEvent(event) {
  return {
    event_id: event.event_id,
    stock_code: event.stock_code,
    stock_name: event.stock_name,
    signal_date: event.signal_date,
    episode_end_date: event.episode_end_date,
    deepest_signal_date: event.deepest_signal_date,
    trigger_ids: event.trigger_ids,
    return_3d: event.signal?.price_volume?.return_3d ?? null,
    return_5d: event.signal?.price_volume?.return_5d ?? null,
    return_10d: event.signal?.price_volume?.return_10d ?? null,
    drawdown_20d: event.signal?.price_volume?.drawdown_20d ?? null,
    rsi14: event.signal?.price_volume?.rsi14 ?? null,
    future_return_1d: event.outcome_from_signal?.future_return_1d ?? null,
    future_return_3d: event.outcome_from_signal?.future_return_3d ?? null,
    future_return_5d: event.outcome_from_signal?.future_return_5d ?? null,
    future_return_10d: event.outcome_from_signal?.future_return_10d ?? null,
    max_return_5d: event.outcome_from_signal?.max_return_5d ?? null,
    max_adverse_5d: event.outcome_from_signal?.max_adverse_5d ?? null,
    labels: event.outcome_from_signal?.labels || {},
    data_availability: event.data_availability,
  };
}

function runResearch(root, options) {
  const sources = loadAllSources(root, options);
  if (!sources.prices.byStock.size) throw new Error('找不到可用的 data_fubon/fubon_YYYYMMDD_sma.json 價量資料');
  const allDates = [...new Set([...sources.prices.byStock.values()].flatMap(stock => stock.rows.map(row => row.date)))].sort();
  const context = {
    allDates,
    foreign: sources.foreign.daily,
    trust: sources.trust.daily,
    dealers: sources.dealers.daily,
    margin: sources.margin.daily,
    brokers: sources.brokers.daily,
  };

  const stockResults = [];
  for (const stock of [...sources.prices.byStock.values()].sort((a, b) => a.stock_code.localeCompare(b.stock_code, 'en', { numeric: true }))) {
    const rawEvents = buildEventsForSeries(
      stock.stock_code,
      stock.stock_name,
      stock.rows,
      DEFAULT_THRESHOLDS,
      { maxGap: options.maxGap, maxEpisodeSpan: options.maxEpisodeSpan },
    );
    if (!rawEvents.length) continue;
    const events = rawEvents.map(event => enrichEvent(event, context));
    const profile = buildStockProfile(stock.stock_code, stock.stock_name, events);
    stockResults.push({
      stock_code: stock.stock_code,
      stock_name: stock.stock_name,
      history: {
        first_date: stock.rows[0]?.date || null,
        last_date: stock.rows.at(-1)?.date || null,
        trading_days: stock.rows.length,
      },
      events,
      profile,
    });
  }

  const dataQuality = {
    price: sources.prices.quality,
    foreign: sources.foreign.quality,
    investment_trust: sources.trust.quality,
    dealer: sources.dealers.quality,
    margin: sources.margin.quality,
    broker: sources.brokers.quality,
  };
  const summary = summarizeResearch(stockResults, dataQuality, DEFAULT_THRESHOLDS);
  const manifest = buildManifest(options, summary, stockResults);
  return { sources, stockResults, summary, manifest };
}

function writeResearch(outputRoot, result) {
  cleanGeneratedDirectories(outputRoot);
  for (const stock of result.stockResults) {
    atomicWriteJson(path.join(outputRoot, 'events', `${stock.stock_code}.json`), {
      schema_version: 1,
      research_id: result.summary.research_id,
      stock_code: stock.stock_code,
      stock_name: stock.stock_name,
      history: stock.history,
      event_count: stock.events.length,
      events: stock.events,
    });
    atomicWriteJson(path.join(outputRoot, 'profiles', `${stock.stock_code}.json`), stock.profile);
  }
  atomicWriteJson(path.join(outputRoot, 'summary.json'), result.summary);
  atomicWriteJson(path.join(outputRoot, 'data-quality.json'), result.summary.data_quality);
  atomicWriteJson(path.join(outputRoot, 'event-index.json'), {
    schema_version: 1,
    generated_at: result.summary.generated_at,
    research_id: result.summary.research_id,
    event_count: result.summary.event_count,
    events: result.stockResults.flatMap(stock => stock.events.map(compactEvent)),
  });
  atomicWriteJson(path.join(outputRoot, 'manifest.json'), result.manifest);
}

function main() {
  try {
    const options = parseArgs(process.argv.slice(2));
    if (options.help) {
      printHelp();
      return;
    }
    const result = runResearch(ROOT, options);
    if (!options.dryRun) writeResearch(options.outputRoot, result);
    console.log(JSON.stringify({
      research_id: result.summary.research_id,
      date_range: result.manifest.date_range,
      stock_count: result.summary.stock_count,
      event_count: result.summary.event_count,
      outcome_counts: result.summary.outcome_counts,
      feature_coverage: result.summary.feature_coverage,
      output_root: options.dryRun ? null : path.relative(ROOT, options.outputRoot).replaceAll(path.sep, '/'),
      dry_run: options.dryRun,
    }, null, 2));
  } catch (error) {
    console.error(`[oversold-rebound-research] ${error.stack || error.message}`);
    process.exitCode = 1;
  }
}

if (require.main === module) main();

module.exports = {
  ROOT,
  DEFAULT_OUTPUT_ROOT,
  parseArgs,
  compactDate,
  listMatchingFiles,
  loadPriceSeries,
  loadJsonDailyMaps,
  loadMarginDailyMaps,
  loadAllSources,
  runResearch,
  writeResearch,
};
