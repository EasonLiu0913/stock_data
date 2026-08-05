'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const {
  selectRealtimeTxQuote,
  quoteTimestamp,
} = require('../scripts/taifex_realtime_night_futures');
const {
  buildIndicatorSnapshot,
  marketStatus,
} = require('../scripts/external_market_intraday_snapshot');
const {
  snapshotId,
} = require('../scripts/capture_prediction_market_context');
const {
  nightCondition,
  updatePayload,
} = require('../scripts/apply_prediction_context_to_readiness');

const ROOT = path.resolve(__dirname, '..');

function chartPayload({ timestamps, close, open, high, low, volume, previousClose = 100, periods = null }) {
  return {
    chart: {
      result: [{
        timestamp: timestamps,
        meta: {
          chartPreviousClose: previousClose,
          currency: 'USD',
          exchangeTimezoneName: 'America/New_York',
          currentTradingPeriod: periods || {},
        },
        indicators: {
          quote: [{ close, open, high, low, volume }],
          adjclose: [{ adjclose: close }],
        },
      }],
    },
  };
}

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function preserveFile(file) {
  return fs.existsSync(file) ? fs.readFileSync(file) : null;
}

function restoreFile(file, content) {
  if (content === null) fs.rmSync(file, { force: true });
  else fs.writeFileSync(file, content);
}

test('realtime TX selector chooses the liquid near-month quote', () => {
  const selected = selectRealtimeTxQuote([
    { SymbolID: 'TXFI6-M', DispCName: '臺指期096', CLastPrice: '44517', CTotalVolume: '384', CDate: '20260805', CTime: '021244' },
    { SymbolID: 'TXFH6-M', DispCName: '臺指期086', CLastPrice: '44394', CTotalVolume: '42268', CDate: '20260805', CTime: '025125' },
    { SymbolID: 'TXF-P', DispCName: '臺指現貨', CLastPrice: '', CTotalVolume: '', CDate: '20260805', CTime: '' },
  ]);
  assert.equal(selected.symbol_id, 'TXFH6-M');
  assert.equal(selected.last_price, 44394);
  assert.equal(selected.volume_so_far, 42268);
});

test('after-midnight TAIFEX quote timestamp advances from source calendar date', () => {
  assert.equal(quoteTimestamp({ source_calendar_date: '20260805', source_time: '025125' }), '2026-08-06T02:51:25+08:00');
  assert.equal(quoteTimestamp({ source_calendar_date: '20260805', source_time: '231500' }), '2026-08-05T23:15:00+08:00');
});

test('intraday external indicator compares latest quote with previous close', () => {
  const regularStart = 1785965400;
  const intraday = chartPayload({
    timestamps: [regularStart, regularStart + 60],
    open: [101, 101.5], high: [102, 103], low: [100.5, 101], close: [102, 103], volume: [10, 20],
    previousClose: 100,
    periods: { regular: { start: regularStart - 10, end: regularStart + 3600 } },
  });
  const daily = chartPayload({
    timestamps: [regularStart - 86400, regularStart],
    open: [98, 101], high: [101, 103], low: [97, 100], close: [100, 103], volume: [1000, 30],
    previousClose: 98,
  });
  const observedAt = new Date((regularStart + 120) * 1000);
  const result = buildIndicatorSnapshot({ id: 'sox', symbol: '^SOX', name: 'SOX' }, intraday, daily, observedAt);
  assert.equal(result.last_price, 103);
  assert.equal(result.previous_close, 100);
  assert.equal(result.change_percent, 3);
  assert.equal(result.high, 103);
  assert.equal(result.low, 100.5);
  assert.equal(result.volume, 30);
  assert.equal(result.is_final, false);
});

test('market status identifies regular session using provider periods', () => {
  assert.equal(marketStatus({ currentTradingPeriod: { regular: { start: 100, end: 200 } } }, 150), 'regular');
  assert.equal(marketStatus({ currentTradingPeriod: { regular: { start: 100, end: 200 } } }, 50), 'pre_open');
  assert.equal(marketStatus({ currentTradingPeriod: { regular: { start: 100, end: 200 } } }, 250), 'closed');
});

test('snapshot id is stable in Taipei time', () => {
  assert.equal(snapshotId(new Date('2026-08-05T18:52:19Z')), '20260806T025219+0800');
});

test('prediction-time night signal is marked as non-final context', () => {
  const condition = nightCondition(1.2, '2026-08-06T02:30:00+08:00', 'in_progress');
  assert.equal(condition.status, 'partial');
  assert.equal(condition.points, 8);
  assert.match(condition.note, /不是完整夜盤收盤值/);
});

test('readiness payload replaces missing night data and recalculates score', () => {
  const payload = {
    forecast_date_compact: '20260806',
    conditions: [
      { id: 'other', weight: 85, points: 20, status: 'full' },
      { id: 'night_futures_open_signal', weight: 15, points: 0, status: 'na', value: null },
    ],
    inputs: { night_futures_change_pct: null },
    warnings: ['缺台指期夜盤結構化資料。'],
    source_files: {},
  };
  const updated = updatePayload(payload, {
    change_percent: 2.1,
    observed_at: '2026-08-06T02:30:00+08:00',
    session_status: 'in_progress',
  }, {
    forecast_date: '20260806',
    captured_at: '2026-08-05T18:30:00Z',
    snapshot_id: 'snapshot-1',
    snapshot_hash: 'hash-1',
    night_futures_file: 'data_prediction_context/20260806/snapshots/snapshot-1/night-futures.json',
    manifest_file: 'data_prediction_context/20260806/snapshots/snapshot-1/manifest.json',
  });
  assert.equal(updated.score, 35);
  assert.equal(updated.effective_data_weight, 100);
  assert.equal(updated.inputs.night_futures_change_pct, 2.1);
  assert.equal(updated.warnings.length, 0);
  assert.equal(updated.conditions.at(-1).status, 'full');
});

test('market risk generator reads and records the immutable prediction-time external snapshot', () => {
  const baseDate = '20991230';
  const forecastDate = '20991231';
  const contextDir = path.join(ROOT, 'data_prediction_context', forecastDate);
  const snapshotDir = path.join(contextDir, 'snapshots', 'test-risk-context');
  const externalFile = path.join(snapshotDir, 'external-market.json');
  const manifestFile = path.join(snapshotDir, 'manifest.json');
  const latestFile = path.join(contextDir, 'latest.json');
  const riskDir = path.join(ROOT, 'data_market_risk', baseDate);
  const riskFile = path.join(riskDir, 'market_risk_snapshot.json');
  const riskFilesIndex = path.join(ROOT, 'data_market_risk', 'files.json');
  const riskManifest = path.join(ROOT, 'data_market_risk', 'manifest.json');
  const filesBackup = preserveFile(riskFilesIndex);
  const manifestBackup = preserveFile(riskManifest);
  const relativeExternal = path.relative(ROOT, externalFile).replaceAll(path.sep, '/');
  const relativeManifest = path.relative(ROOT, manifestFile).replaceAll(path.sep, '/');

  try {
    writeJson(externalFile, {
      schemaVersion: 3,
      snapshot_type: 'prediction_intraday',
      generated_at: '2099-12-30T15:00:00.000Z',
      observed_at: '2099-12-30T15:00:00.000Z',
      collection_date: baseDate,
      expected_market_date: baseDate,
      primary_ready: true,
      indicator_count: 8,
      error_count: 0,
      indicators: [
        { id: 'nasdaq', symbol: '^IXIC', name: 'Nasdaq', category: 'us_equity', market_date: baseDate, close: 98, change_percent: -2 },
        { id: 'sp500', symbol: '^GSPC', name: 'S&P 500', category: 'us_equity', market_date: baseDate, close: 99, change_percent: -1 },
        { id: 'dow', symbol: '^DJI', name: 'Dow', category: 'us_equity', market_date: baseDate, close: 100, change_percent: 0 },
        { id: 'sox', symbol: '^SOX', name: 'SOX', category: 'semiconductor', market_date: baseDate, close: 97, change_percent: -3 },
        { id: 'tsm_adr', symbol: 'TSM', name: 'TSM ADR', category: 'semiconductor_adr', market_date: baseDate, close: 99, change_percent: -1 },
        { id: 'usd_twd', symbol: 'TWD=X', name: 'USD/TWD', category: 'fx', market_date: baseDate, close: 32, change_percent: 0.5 },
        { id: 'wti_crude_oil', symbol: 'CL=F', name: 'WTI', category: 'oil_futures', market_date: baseDate, close: 70, change_percent: 2 },
        { id: 'brent_crude_oil', symbol: 'BZ=F', name: 'Brent', category: 'oil_futures', market_date: baseDate, close: 74, change_percent: 2.5 },
      ],
      errors: [],
    });
    writeJson(manifestFile, {
      schema_version: 1,
      snapshot_id: 'test-risk-context',
      forecast_date: forecastDate,
      base_trade_date: baseDate,
      captured_at: '2099-12-30T15:00:00.000Z',
      snapshot_hash: 'test-risk-hash',
    });
    writeJson(latestFile, {
      schema_version: 1,
      forecast_date: forecastDate,
      base_trade_date: baseDate,
      snapshot_id: 'test-risk-context',
      snapshot_hash: 'test-risk-hash',
      captured_at: '2099-12-30T15:00:00.000Z',
      manifest_file: relativeManifest,
      external_market_file: relativeExternal,
      external_primary_ready: true,
    });

    const preload = path.join(ROOT, 'scripts', 'prediction_market_context_preload.js');
    const result = spawnSync(process.execPath, [
      path.join(ROOT, 'scripts', 'generate_market_risk_snapshot.js'),
      '--date', baseDate,
    ], {
      cwd: ROOT,
      encoding: 'utf8',
      env: {
        ...process.env,
        FORECAST_TARGET_DATE: forecastDate,
        FORECAST_BASE_DATE: baseDate,
        PREDICTION_MARKET_CONTEXT_EXTERNAL_FILE: externalFile,
        NODE_OPTIONS: `--require=${preload}`,
      },
    });
    assert.equal(result.status, 0, result.stderr || result.stdout);
    const risk = JSON.parse(fs.readFileSync(riskFile, 'utf8'));
    assert.equal(risk.source_files.external_market, relativeExternal);
    assert.equal(risk.source_files.prediction_market_context, relativeManifest);
    assert.equal(risk.prediction_market_context.snapshot_hash, 'test-risk-hash');
    assert.equal(risk.data_freshness.status, 'intraday_live');
    assert.ok(risk.external_market.external_market_risk_score > 0);
    const nasdaq = risk.external_market.tracked_indicators.find((item) => item.id === 'nasdaq');
    assert.equal(nasdaq.change_percent, -2);
  } finally {
    fs.rmSync(contextDir, { recursive: true, force: true });
    fs.rmSync(riskDir, { recursive: true, force: true });
    restoreFile(riskFilesIndex, filesBackup);
    restoreFile(riskManifest, manifestBackup);
  }
});
