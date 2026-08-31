'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  resolveScheduledCollectionDate,
  resolveScheduledOccurrence,
} = require('../scripts/resolve_scheduled_collection_date');
const { resolveExternalMarketSessionDate } = require('../scripts/resolve_external_market_session_date');
const { resolveFubonRankingDate } = require('../scripts/resolve_fubon_ranking_date');
const { previousOrSameTradingDate } = require('../scripts/resolve_taifex_scheduled_date');

test('external-market delayed runner crossing New York date/session boundary keeps intended session', () => {
  const runnerNow = new Date('2026-08-28T14:00:00Z');
  const occurrence = resolveScheduledOccurrence('10 21 * * 1-5', runnerNow);
  assert.equal(occurrence.scheduled_at_utc, '2026-08-27T21:10:00.000Z');

  const anchored = resolveExternalMarketSessionDate(new Date(occurrence.scheduled_at_utc));
  const runnerClock = resolveExternalMarketSessionDate(runnerNow);
  assert.equal(anchored.targetDate, '20260827');
  assert.equal(runnerClock.targetDate, '20260828');
});

test('EIA scheduled query upper bound stays on intended UTC occurrence date after UTC midnight delay', () => {
  const result = resolveScheduledCollectionDate({
    schedule: '20 23 * * 1-5',
    policy: 'same_calendar_date',
    timeZone: 'UTC',
    now: new Date('2026-08-29T03:30:00Z'),
    holidays: new Set(),
  });
  assert.equal(result.scheduled_at_utc, '2026-08-28T23:20:00.000Z');
  assert.equal(result.target_date, '20260828');
});

test('Fubon page MM/DD uses occurrence anchor only for deterministic Dec/Jan year inference', () => {
  assert.equal(resolveFubonRankingDate('12/31', '2027-01-02T09:43:00Z'), '20261231');
  assert.equal(resolveFubonRankingDate('01/02', '2026-12-31T12:47:00Z'), '20270102');
  assert.equal(resolveFubonRankingDate('08/31', '2026-08-31T09:43:00Z'), '20260831');
});

test('Fubon missing or malformed source page date fails instead of inventing an official date', () => {
  assert.throws(() => resolveFubonRankingDate(null, '2026-08-31T09:43:00Z'), /Missing or malformed/);
  assert.throws(() => resolveFubonRankingDate('8/31', '2026-08-31T09:43:00Z'), /Missing or malformed/);
  assert.throws(() => resolveFubonRankingDate('02/30', '2026-08-31T09:43:00Z'), /Invalid Fubon source page date/);
});

test('TAIFEX scheduled base date uses logical Taipei date before preserved rollback', () => {
  const occurrence = resolveScheduledCollectionDate({
    schedule: '13 9 * * 1-5',
    policy: 'same_calendar_date',
    timeZone: 'Asia/Taipei',
    now: new Date('2026-09-28T15:30:00Z'),
    holidays: new Set(),
  });
  assert.equal(occurrence.scheduled_at_utc, '2026-09-28T09:13:00.000Z');
  assert.equal(occurrence.target_date, '20260928');

  const configured = new Set(['20260925', '20260928']);
  assert.equal(previousOrSameTradingDate(occurrence.target_date, configured), '20260924');
});

test('TAIFEX rollback preserves prior weekend behavior exactly', () => {
  assert.equal(previousOrSameTradingDate('20260829', new Set()), '20260828');
  assert.equal(previousOrSameTradingDate('20260828', new Set()), '20260828');
});
