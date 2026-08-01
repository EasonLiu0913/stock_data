'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {
  DEFAULT_THRESHOLDS,
  computeRsi,
  buildOversoldObservation,
  buildEventsForSeries,
  parseMarginCsv,
  parseInstitutionalPayload,
  parseBrokerPayload,
  enrichEvent,
  buildStockProfile,
} = require('../scripts/oversold_rebound_research_lib');
const {
  parseArgs,
  loadPriceSeries,
  runResearch,
  writeResearch,
} = require('../scripts/mine_oversold_rebound_events');

function row(date, close, volume = 1000) {
  return {
    date,
    open: close,
    high: close * 1.01,
    low: close * 0.99,
    close,
    volume,
    sma5: null,
    sma20: null,
    sma60: null,
  };
}

function tradingDates(count, start = '20260101') {
  const date = new Date(`${start.slice(0, 4)}-${start.slice(4, 6)}-${start.slice(6, 8)}T00:00:00Z`);
  const values = [];
  while (values.length < count) {
    const day = date.getUTCDay();
    if (day !== 0 && day !== 6) values.push(date.toISOString().slice(0, 10).replaceAll('-', ''));
    date.setUTCDate(date.getUTCDate() + 1);
  }
  return values;
}

function sampleSeries() {
  const dates = tradingDates(36);
  const closes = [
    100, 101, 102, 103, 102, 104, 103, 105, 104, 106,
    105, 107, 106, 108, 107, 109, 108, 110, 109, 108,
    104, 99, 94, 91, 89, 90, 92, 95, 99, 103,
    106, 108, 109, 110, 111, 112,
  ];
  return dates.map((date, index) => row(date, closes[index], index >= 20 && index <= 24 ? 2500 : 1000));
}

test('RSI and oversold observation only use current and past rows', () => {
  const series = sampleSeries();
  const index = 24;
  const rsi = computeRsi(series, index, 14);
  assert.ok(rsi <= 25);
  const observation = buildOversoldObservation(series, index, DEFAULT_THRESHOLDS);
  assert.equal(observation.is_oversold, true);
  assert.ok(observation.triggers.length >= 1);
  assert.equal(observation.date, series[index].date);
  assert.equal(observation.price_volume.return_3d, -10.101);
});

test('nearby oversold observations become one episode and future prices are outcomes only', () => {
  const series = sampleSeries();
  const events = buildEventsForSeries('2330', '測試股', series, DEFAULT_THRESHOLDS, { maxGap: 3, maxEpisodeSpan: 20 });
  assert.equal(events.length, 1);
  const event = events[0];
  assert.equal(event.signal_date, series[21].date);
  assert.ok(event.deepest_signal_date >= event.signal_date);
  assert.ok(event.outcome_from_signal.future_return_10d > 0);
  assert.equal(event.signal.price_volume.close, series[21].close);
  assert.equal(Object.hasOwn(event.signal.price_volume, 'future_return_5d'), false);
});

test('institutional, margin and broker parsers preserve missing data instead of converting it to zero', () => {
  const institutional = parseInstitutionalPayload({
    data: [[' ', '2330  ', '台積電 ', '100', '40', '60']],
  });
  assert.equal(institutional.get('2330').net_shares, 60);

  const margin = parseMarginCsv('股票代號,股票名稱,融資買進,融資賣出,融資現金償還,融資前日餘額,融資今日餘額,融資限額,融券買進,融券賣出,融券現券償還,融券前日餘額,融券今日餘額,融券限額,資券互抵,註記\n"2330","台積電","10","5","","100","105","1000","","2","","8","10","1000","",""\n');
  assert.equal(margin.get('2330').margin_change, 5);
  assert.equal(margin.get('2330').short_change, 2);

  assert.equal(parseBrokerPayload({}).size, 0);
  const broker = parseBrokerPayload({ stocks: { '2330': {
    buyBrokers: [{ brokerName: 'A', netBuy: 20, sharePercent: 10 }],
    sellBrokers: [{ brokerName: 'B', netSell: 5, sharePercent: 2 }],
    totals: { netBuy: 20, netSell: 5, net: 15 },
  } } });
  assert.equal(broker.get('2330').top5_net_concentration_lots, 15);
});

test('event enrichment treats external market as optional and reports source coverage', () => {
  const series = sampleSeries();
  const event = buildEventsForSeries('2330', '測試股', series)[0];
  const allDates = series.map(item => item.date);
  const foreign = new Map([[event.signal_date, new Map([['2330', { net_shares: 50000 }]])]]);
  const empty = new Map();
  const enriched = enrichEvent(event, {
    allDates,
    foreign,
    trust: empty,
    dealers: empty,
    margin: empty,
    brokers: empty,
  });
  assert.equal(enriched.features.market_optional, null);
  assert.equal(enriched.data_availability.foreign, true);
  assert.equal(enriched.data_availability.margin, false);
  assert.equal(enriched.features.institutional.foreign.current_net_shares, 50000);
});

test('stock profile does not claim a stock-specific pattern with too few events', () => {
  const series = sampleSeries();
  const event = enrichEvent(buildEventsForSeries('2330', '測試股', series)[0], {
    allDates: series.map(item => item.date),
    foreign: new Map(),
    trust: new Map(),
    dealers: new Map(),
    margin: new Map(),
    brokers: new Map(),
  });
  const profile = buildStockProfile('2330', '測試股', [event]);
  assert.equal(profile.evidence_level, 'insufficient');
  assert.equal(profile.event_count, 1);
});

test('CLI options validate date ranges and episode settings', () => {
  assert.deepEqual(parseArgs(['--from', '20260101', '--to', '20260131', '--stocks', '2330, 6443']).stocks, ['2330', '6443']);
  assert.throws(() => parseArgs(['--from', '20260201', '--to', '20260101']), /不可晚於/);
  assert.throws(() => parseArgs(['--max-gap', '0']), /max-gap/);
});

test('price loader and research writer generate isolated per-stock outputs', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'oversold-research-'));
  const dataDir = path.join(root, 'data_fubon');
  fs.mkdirSync(dataDir, { recursive: true });
  const series = sampleSeries();
  for (const item of series) {
    const displayDate = `${item.date.slice(0, 4)}/${item.date.slice(4, 6)}/${item.date.slice(6, 8)}`;
    fs.writeFileSync(path.join(dataDir, `fubon_${item.date}_sma.json`), JSON.stringify({
      '2330': {
        StockName: '測試股',
        [displayDate]: {
          Price: String(item.close),
          Open: String(item.open),
          High: String(item.high),
          Low: String(item.low),
          Volume: String(item.volume),
        },
      },
    }));
  }
  const options = parseArgs(['--from', series[0].date, '--to', series.at(-1).date, '--stocks', '2330', '--output-root', path.join(root, 'output')]);
  const loaded = loadPriceSeries(root, options);
  assert.equal(loaded.byStock.get('2330').rows.length, series.length);
  const result = runResearch(root, options);
  assert.equal(result.summary.stock_count, 1);
  assert.ok(result.summary.event_count >= 1);
  writeResearch(options.outputRoot, result);
  assert.ok(fs.existsSync(path.join(options.outputRoot, 'manifest.json')));
  assert.ok(fs.existsSync(path.join(options.outputRoot, 'events', '2330.json')));
  assert.ok(fs.existsSync(path.join(options.outputRoot, 'profiles', '2330.json')));
});
