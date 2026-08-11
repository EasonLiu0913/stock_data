'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  EVENT_TYPES,
  parseRocDate,
  parseTime,
  taipeiIso,
  resolveEffectiveTradingDate,
  classifyMaterialInformation,
  finalizeEvent,
} = require('../scripts/fundamental_event_timeline');
const {
  normalizeMonthlyRevenue,
  normalizeMaterial,
  normalizePeriod,
  inferMonthlyRevenuePeriod,
  dedupeEvents,
} = require('../scripts/build_fundamental_event_timeline');

const tradingDates = ['2026-08-10', '2026-08-11', '2026-08-12', '2026-08-13', '2026-08-14', '2026-08-17'];

test('ROC dates and MOPS times normalize to Taipei timestamps', () => {
  assert.equal(parseRocDate('115/08/10'), '2026-08-10');
  assert.equal(parseRocDate('1150810'), '2026-08-10');
  assert.equal(parseRocDate('2026-08-10'), '2026-08-10');
  assert.equal(parseTime('08:35:12'), '08:35:12');
  assert.equal(parseTime('142245'), '14:22:45');
  assert.equal(taipeiIso('2026-08-10', '14:22:45'), '2026-08-10T14:22:45+08:00');
});

test('exact pre-open publication is available same trading date', () => {
  assert.equal(resolveEffectiveTradingDate({
    publishedAt: '2026-08-10T08:35:00+08:00',
    timestampPrecision: 'minute',
    tradingDates,
  }), '2026-08-10');
});

test('intraday publication is conservatively effective next trading date', () => {
  assert.equal(resolveEffectiveTradingDate({
    publishedAt: '2026-08-10T10:30:00+08:00',
    timestampPrecision: 'minute',
    tradingDates,
  }), '2026-08-11');
});

test('date-only publication is conservatively effective next trading date', () => {
  assert.equal(resolveEffectiveTradingDate({
    publishedDate: '2026-08-10',
    timestampPrecision: 'date',
    tradingDates,
  }), '2026-08-11');
});

test('Friday after-market publication advances to Monday', () => {
  assert.equal(resolveEffectiveTradingDate({
    publishedAt: '2026-08-14T17:30:00+08:00',
    timestampPrecision: 'minute',
    tradingDates,
  }), '2026-08-17');
});

test('material information classifier separates event families', () => {
  assert.equal(classifyMaterialInformation('台積公司2026年7月營收報告'), EVENT_TYPES.MONTHLY_REVENUE);
  assert.equal(classifyMaterialInformation('本公司受邀參加法人說明會'), EVENT_TYPES.INVESTOR_CONFERENCE);
  assert.equal(classifyMaterialInformation('公告本公司2026年第二季自結損益'), EVENT_TYPES.PRELIMINARY_EARNINGS);
  assert.equal(classifyMaterialInformation('董事會通過第二季財務報告'), EVENT_TYPES.PRELIMINARY_EARNINGS);
  assert.equal(classifyMaterialInformation('公告取得機器設備'), EVENT_TYPES.MATERIAL_INFORMATION);
});

test('monthly revenue aggregate treats 出表日期 as snapshot fallback, not actual publication date', () => {
  const event = normalizeMonthlyRevenue({
    '出表日期': '115/08/10',
    '資料年月': '11507',
    '公司代號': '2330',
    '公司名稱': '台積電',
    '營業收入-當月營收': '300,000,000',
    '營業收入-去年同月增減(%)': '18.5',
  }, 'TWSE', 'TWSE OpenAPI', tradingDates);
  assert.equal(event.stock_id, '2330');
  assert.equal(event.period, '202607');
  assert.equal(event.timestamp_precision, 'fallback');
  assert.equal(event.published_date, null);
  assert.equal(event.fallback_known_date, '2026-08-10');
  assert.equal(event.availability_confidence, 'aggregate_snapshot_date');
  assert.equal(event.effective_trading_date, '2026-08-11');
  assert.equal(event.metrics.revenue, 300000000);
  assert.equal(event.metrics.yoy_pct, 18.5);
});

test('material normalizer trims source keys and promotes monthly revenue disclosure to exact timestamp', () => {
  const event = normalizeMaterial({
    '發言日期': '1150810',
    '發言時間': '135109',
    '公司代號': '2330',
    '公司名稱': '台積電',
    '主旨 ': '台積公司2026年7月營收報告',
    '說明': '台積公司今（10）日公佈2026年7月營收報告。',
  }, 'TWSE', 'TWSE OpenAPI', ['2026-08-10', '2026-08-11']);
  assert.equal(event.title, '台積公司2026年7月營收報告');
  assert.equal(event.event_type, EVENT_TYPES.MONTHLY_REVENUE);
  assert.equal(event.period, '202607');
  assert.equal(event.published_at, '2026-08-10T13:51:09+08:00');
  assert.equal(event.availability_confidence, 'official_timestamp');
  assert.equal(event.effective_trading_date, '2026-08-11');
});

test('material normalizer uses official second-level timestamp for investor conference', () => {
  const event = normalizeMaterial({
    '發言日期': '115/07/16',
    '發言時間': '142245',
    '公司代號': '2330',
    '公司名稱': '台積電',
    '主旨': '本公司召開法人說明會並公布第二季營運成果',
    '說明': '第二季 earnings results',
  }, 'TWSE', 'TWSE OpenAPI', ['2026-07-16', '2026-07-17']);
  assert.equal(event.event_type, EVENT_TYPES.INVESTOR_CONFERENCE);
  assert.equal(event.published_at, '2026-07-16T14:22:45+08:00');
  assert.equal(event.timestamp_precision, 'second');
  assert.equal(event.effective_trading_date, '2026-07-17');
});

test('formal report fallback remains explicitly fallback rather than pretending to be actual filing time', () => {
  const event = finalizeEvent({
    stock_id: '2330',
    event_type: EVENT_TYPES.FORMAL_FINANCIAL_REPORT,
    fiscal_period: '2026Q2',
    fallback_known_date: '2026-08-14',
    timestamp_precision: 'fallback',
    availability_confidence: 'fallback_deadline',
  }, tradingDates);
  assert.equal(event.published_at, null);
  assert.equal(event.published_date, null);
  assert.equal(event.fallback_known_date, '2026-08-14');
  assert.equal(event.effective_trading_date, '2026-08-17');
});

test('duplicate events prefer exact disclosure over aggregate snapshot', () => {
  const snapshot = finalizeEvent({
    stock_id: '2330', event_type: EVENT_TYPES.MONTHLY_REVENUE, period: '202607',
    fallback_known_date: '2026-08-11', timestamp_precision: 'fallback',
    availability_confidence: 'aggregate_snapshot_date', event_id: 'same',
  }, ['2026-08-11','2026-08-12']);
  const exact = finalizeEvent({
    stock_id: '2330', event_type: EVENT_TYPES.MONTHLY_REVENUE, period: '202607',
    published_at: '2026-08-10T13:51:09+08:00', timestamp_precision: 'second',
    availability_confidence: 'official_timestamp', event_id: 'same',
  }, ['2026-08-10','2026-08-11']);
  const result = dedupeEvents([snapshot, exact]);
  assert.equal(result.length, 1);
  assert.equal(result[0].availability_confidence, 'official_timestamp');
});

test('ROC monthly periods normalize correctly', () => {
  assert.equal(normalizePeriod('11507'), '202607');
  assert.equal(normalizePeriod('202607'), '202607');
  assert.equal(inferMonthlyRevenuePeriod('台積公司2026年7月營收報告'), '202607');
});
