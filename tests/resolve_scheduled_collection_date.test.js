'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  applyCollectionPolicy,
  parseArgs,
  resolveForEvent,
  resolveScheduledCollectionDate,
  resolveScheduledOccurrence,
} = require('../scripts/resolve_scheduled_collection_date');
const { resolveForecastDates } = require('../scripts/resolve_forecast_dates');

const holidays = new Set(['2026/09/28']);

test('CLI parser preserves an explicitly empty argument value', () => {
  const args = parseArgs([
    '--event-name', 'schedule',
    '--schedule', '17 12 * * *',
    '--input-date', '',
    '--policy', 'same_calendar_date',
  ]);
  assert.equal(args.get('input-date'), '');
  assert.equal(args.get('policy'), 'same_calendar_date');
});

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

test('market chart 23:07 and 02:33 schedules retain the 08:00 business-date boundary under delay', () => {
  const lateNight = resolveScheduledCollectionDate({
    schedule: '7 15 * * 1-5',
    policy: 'same_trade_date',
    dayBoundaryHour: 8,
    now: new Date('2026-08-28T23:30:00Z'),
    holidays: new Set(),
  });
  const afterMidnight = resolveScheduledCollectionDate({
    schedule: '33 18 * * 1-5',
    policy: 'same_trade_date',
    dayBoundaryHour: 8,
    now: new Date('2026-08-29T06:30:00Z'),
    holidays: new Set(),
  });
  assert.equal(lateNight.scheduled_at_utc, '2026-08-28T15:07:00.000Z');
  assert.equal(lateNight.target_date, '20260828');
  assert.equal(afterMidnight.scheduled_at_utc, '2026-08-28T18:33:00.000Z');
  assert.equal(afterMidnight.target_date, '20260828');
  assert.equal(afterMidnight.day_boundary_hour, 8);
});

test('margin maintenance keeps the scheduled trade date when runner starts after Taipei midnight', () => {
  const result = resolveScheduledCollectionDate({
    schedule: '5 15 * * 1-5',
    policy: 'same_trade_date',
    now: new Date('2026-08-28T18:40:00Z'),
    holidays: new Set(),
  });
  assert.equal(result.scheduled_at_utc, '2026-08-28T15:05:00.000Z');
  assert.equal(result.target_date, '20260828');
});

test('market news retains the logical collection date across Taipei midnight', () => {
  const result = resolveScheduledCollectionDate({
    schedule: '17 12 * * *',
    policy: 'same_calendar_date',
    now: new Date('2026-08-28T18:30:00Z'),
    holidays: new Set(),
  });
  assert.equal(result.scheduled_at_utc, '2026-08-28T12:17:00.000Z');
  assert.equal(result.target_date, '20260828');
});

test('daily gainers mode can be classified from logical occurrence even when runner is many hours late', () => {
  const evening = resolveScheduledCollectionDate({
    schedule: '0 15 * * 1-5',
    policy: 'same_calendar_date',
    now: new Date('2026-08-29T05:00:00Z'),
    holidays: new Set(),
  });
  const morning = resolveScheduledCollectionDate({
    schedule: '15 2 * * 1-5',
    policy: 'same_calendar_date',
    now: new Date('2026-08-28T15:00:00Z'),
    holidays: new Set(),
  });
  const taipeiHour = (iso) => Number(new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Taipei',
    hour: '2-digit',
    hourCycle: 'h23',
  }).format(new Date(iso)));
  assert.equal(evening.target_date, '20260828');
  assert.equal(taipeiHour(evening.scheduled_at_utc), 23);
  assert.equal(morning.target_date, '20260828');
  assert.equal(taipeiHour(morning.scheduled_at_utc), 10);
});

test('market environment uses the logical 06:35/07:01/08:02 occurrence as forecast now anchor', () => {
  const cases = [
    ['35 22 * * 1-5', '2026-08-31T22:35:00.000Z'],
    ['1 23 * * 1-5', '2026-08-31T23:01:00.000Z'],
    ['2 0 * * 2-6', '2026-09-01T00:02:00.000Z'],
  ];
  for (const [schedule, expectedOccurrence] of cases) {
    const occurrence = resolveScheduledCollectionDate({
      schedule,
      policy: 'same_calendar_date',
      now: new Date('2026-09-01T10:00:00Z'),
      holidays: new Set(),
    });
    assert.equal(occurrence.scheduled_at_utc, expectedOccurrence);
    const forecast = resolveForecastDates(new Date(occurrence.scheduled_at_utc), new Set());
    assert.equal(forecast.forecast_target_date_compact, '20260901');
  }
});

test('market environment delayed runner crossing 15:30 does not move forecast target past logical occurrence', () => {
  const occurrence = resolveScheduledCollectionDate({
    schedule: '2 0 * * 2-6',
    policy: 'same_calendar_date',
    now: new Date('2026-09-01T10:00:00Z'),
    holidays: new Set(),
  });
  const logicalForecast = resolveForecastDates(new Date(occurrence.scheduled_at_utc), new Set());
  const runnerForecast = resolveForecastDates(new Date('2026-09-01T10:00:00Z'), new Set());
  assert.equal(logicalForecast.forecast_target_date_compact, '20260901');
  assert.equal(runnerForecast.forecast_target_date_compact, '20260902');
});

test('second-wave manual explicit collection date remains authoritative', () => {
  const result = resolveForEvent({
    eventName: 'workflow_dispatch',
    schedule: '',
    inputDate: '20260827',
    policy: 'same_calendar_date',
    now: new Date('2026-08-31T23:59:00Z'),
    holidays: new Set(),
  });
  assert.equal(result.source, 'manual_explicit_date');
  assert.equal(result.target_date, '20260827');
});
