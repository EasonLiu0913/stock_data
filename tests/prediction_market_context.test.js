'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
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
