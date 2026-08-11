'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  eventAvailableByCutoff,
  resolveFundamentalState,
} = require('../scripts/fundamental_state_resolver');
const {
  EVENT_TYPES,
} = require('../scripts/fundamental_event_timeline');
const {
  deriveFiscalPeriod,
  deriveRevenuePeriod,
} = require('../scripts/crawl_mops_historical_fundamental_events');

function event(overrides) {
  return {
    schema_version: 1,
    event_id: overrides.event_id,
    stock_id: '2330',
    event_type: overrides.event_type,
    period: overrides.period || null,
    fiscal_period: overrides.fiscal_period || null,
    published_at: overrides.published_at || null,
    published_date: overrides.published_date || null,
    timestamp_precision: overrides.timestamp_precision || 'date',
    effective_trading_date: overrides.effective_trading_date,
    fallback_known_date: overrides.fallback_known_date || null,
    availability_confidence: overrides.availability_confidence || 'official_date',
    metrics: overrides.metrics || null,
  };
}

test('daily cutoff uses effective trading date and prevents intraday leakage', () => {
  const row = event({ event_id: 'x', event_type: EVENT_TYPES.MONTHLY_REVENUE, period: '202607', published_at: '2026-08-10T13:51:09+08:00', timestamp_precision: 'second', effective_trading_date: '2026-08-11', availability_confidence: 'official_timestamp' });
  assert.equal(eventAvailableByCutoff(row, '2026-08-10'), false);
  assert.equal(eventAvailableByCutoff(row, '2026-08-11'), true);
  assert.equal(eventAvailableByCutoff(row, '2026-08-10T14:00:00+08:00'), true);
});

test('newer preliminary quarter beats older formal quarter', () => {
  const state = resolveFundamentalState([
    event({ event_id: 'formal-q1', event_type: EVENT_TYPES.FORMAL_FINANCIAL_REPORT, fiscal_period: '2026Q1', effective_trading_date: '2026-05-18', availability_confidence: 'fallback_deadline' }),
    event({ event_id: 'pre-q2', event_type: EVENT_TYPES.PRELIMINARY_EARNINGS, fiscal_period: '2026Q2', published_date: '2026-07-16', effective_trading_date: '2026-07-17', availability_confidence: 'verified_company_ir', metrics: { eps: 27.25 } }),
  ], '2026-07-17');
  assert.equal(state.latest_financial_information.fiscal_period, '2026Q2');
  assert.equal(state.latest_financial_information.event_type, EVENT_TYPES.PRELIMINARY_EARNINGS);
  assert.equal(state.latest_financial_information.metrics.eps, 27.25);
});

test('formal report replaces preliminary for the same fiscal period once available', () => {
  const state = resolveFundamentalState([
    event({ event_id: 'pre-q2', event_type: EVENT_TYPES.PRELIMINARY_EARNINGS, fiscal_period: '2026Q2', effective_trading_date: '2026-07-17', availability_confidence: 'verified_company_ir' }),
    event({ event_id: 'formal-q2', event_type: EVENT_TYPES.FORMAL_FINANCIAL_REPORT, fiscal_period: '2026Q2', effective_trading_date: '2026-08-14', availability_confidence: 'official_timestamp' }),
  ], '2026-08-14');
  assert.equal(state.latest_financial_information.event_type, EVENT_TYPES.FORMAL_FINANCIAL_REPORT);
});

test('latest monthly period is selected independently from financial quarter', () => {
  const state = resolveFundamentalState([
    event({ event_id: 'm6', event_type: EVENT_TYPES.MONTHLY_REVENUE, period: '202606', effective_trading_date: '2026-07-14', availability_confidence: 'verified_company_ir' }),
    event({ event_id: 'm7', event_type: EVENT_TYPES.MONTHLY_REVENUE, period: '202607', effective_trading_date: '2026-08-11', availability_confidence: 'official_timestamp' }),
  ], '2026-08-11');
  assert.equal(state.latest_monthly_revenue.period, '202607');
});

test('historical MOPS parser derives fiscal and revenue periods without forward data', () => {
  assert.equal(deriveFiscalPeriod('公告本公司2026年第二季自結損益', '2026-07-16'), '2026Q2');
  assert.equal(deriveFiscalPeriod('本公司受邀參加第二季法人說明會', '2026-07-16'), '2026Q2');
  assert.equal(deriveRevenuePeriod('台積公司2026年7月營收報告', '2026-08-10'), '202607');
});
