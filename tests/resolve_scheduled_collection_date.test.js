'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  applyCollectionPolicy,
  resolveForEvent,
  resolveScheduledCollectionDate,
  resolveScheduledOccurrence,
} = require('../scripts/resolve_scheduled_collection_date');

const holidays = new Set(['2026/09/28']);

test('scheduled occurrence is stable despite same-day runner delay', () => {
  const early = resolveScheduledCollectionDate({
    schedule: '37 6 * * 1-5',
    policy: 'same_trade_date',
    now: new Date('2026-08-28T06:40:00Z'),
    holidays,
  });
  const late = resolveScheduledCollectionDate({
    schedule: '37 6 * * 1-5',
    policy: 'same_trade_date',
    now: new Date('2026-08-28T15:59:00Z'),
    holidays,
  });
  assert.equal(early.target_date, '20260828');
  assert.equal(late.target_date, '20260828');
  assert.equal(early.scheduled_at_utc, '2026-08-28T06:37:00.000Z');
  assert.equal(late.scheduled_at_utc, early.scheduled_at_utc);
});

test('delay crossing Taipei midnight keeps the intended scheduled date', () => {
  const result = resolveScheduledCollectionDate({
    schedule: '31 14 * * 1-5',
    policy: 'same_trade_date',
    now: new Date('2026-08-28T17:30:00Z'),
    holidays,
  });
  assert.equal(result.scheduled_at_utc, '2026-08-28T14:31:00.000Z');
  assert.equal(result.target_date, '20260828');
});

test('delay crossing old 08:00 Taipei boundary does not change scheduled target', () => {
  const result = resolveScheduledCollectionDate({
    schedule: '17 12 * * 1-5',
    policy: 'same_trade_date',
    now: new Date('2026-08-29T01:00:00Z'),
    holidays,
  });
  assert.equal(result.target_date, '20260828');
});

test('delay past the next Taipei 14:00 cutoff does not move the prior scheduled occurrence', () => {
  const result = resolveScheduledCollectionDate({
    schedule: '11 7 * * *',
    policy: 'same_trade_date',
    now: new Date('2026-08-28T07:00:00Z'),
    holidays,
  });
  assert.equal(result.scheduled_at_utc, '2026-08-27T07:11:00.000Z');
  assert.equal(result.target_date, '20260827');
});

test('weekday cron resolves Friday occurrence when runner starts on Saturday', () => {
  const result = resolveScheduledOccurrence('29 14 * * 1-5', new Date('2026-08-29T03:00:00Z'));
  assert.equal(result.scheduled_at_utc, '2026-08-28T14:29:00.000Z');
});

test('multiple cron expressions remain independently deterministic', () => {
  const first = resolveScheduledOccurrence('17 10 * * 1-5', new Date('2026-08-28T12:30:00Z'));
  const second = resolveScheduledOccurrence('17 12 * * 1-5', new Date('2026-08-28T12:30:00Z'));
  assert.equal(first.scheduled_at_utc, '2026-08-28T10:17:00.000Z');
  assert.equal(second.scheduled_at_utc, '2026-08-28T12:17:00.000Z');
});

test('manual explicit date always wins over schedule and runner time', () => {
  const result = resolveForEvent({
    eventName: 'schedule',
    schedule: '37 6 * * 1-5',
    inputDate: '20260827',
    policy: 'same_trade_date',
    now: new Date('2026-08-29T03:00:00Z'),
    holidays,
  });
  assert.equal(result.source, 'manual_explicit_date');
  assert.equal(result.target_date, '20260827');
});

test('same-trade-date never silently falls back on a holiday', () => {
  const result = applyCollectionPolicy('20260928', 'same_trade_date', holidays);
  assert.equal(result.target_date, '20260928');
  assert.equal(result.is_trading_date, false);
});

test('TWT49U next-trade-date advances from logical scheduled date across weekend and holiday', () => {
  const friday = applyCollectionPolicy('20260925', 'next_trade_date', holidays);
  assert.equal(friday.target_date, '20260929');
});

test('retry schedule keeps original logical date even after midnight delay', () => {
  const institutional = resolveScheduledCollectionDate({
    schedule: '13 13 * * *',
    policy: 'same_trade_date',
    now: new Date('2026-08-28T18:30:00Z'),
    holidays,
  });
  const sma = resolveScheduledCollectionDate({
    schedule: '29 9 * * *',
    policy: 'same_trade_date',
    now: new Date('2026-08-28T17:30:00Z'),
    holidays,
  });
  assert.equal(institutional.target_date, '20260828');
  assert.equal(sma.target_date, '20260828');
});
