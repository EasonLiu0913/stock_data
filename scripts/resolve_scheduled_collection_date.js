#!/usr/bin/env node
'use strict';

const { isTradingDate, loadHolidaySet, nextTradingDate } = require('./resolve_forecast_dates');

const MINUTE_MS = 60 * 1000;
const HOUR_MS = 60 * MINUTE_MS;
const MAX_LOOKBACK_MINUTES = 60 * 24 * 32;
const DATE_PATTERN = /^20\d{6}$/;

function parseArgs(argv = process.argv.slice(2)) {
  const args = new Map();
  for (let i = 0; i < argv.length; i += 1) {
    const item = argv[i];
    if (!item.startsWith('--')) continue;
    const key = item.slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith('--')) args.set(key, true);
    else {
      args.set(key, next);
      i += 1;
    }
  }
  return args;
}

function parseCronField(value, min, max, label) {
  const text = String(value || '').trim();
  if (text === '*') return null;
  const allowed = new Set();
  for (const part of text.split(',')) {
    const range = part.match(/^(\d+)-(\d+)$/);
    if (range) {
      const start = Number(range[1]);
      const end = Number(range[2]);
      if (start > end || start < min || end > max) throw new Error(`Invalid ${label} cron field: ${value}`);
      for (let current = start; current <= end; current += 1) allowed.add(current);
      continue;
    }
    if (!/^\d+$/.test(part)) throw new Error(`Unsupported ${label} cron field: ${value}`);
    const numeric = Number(part);
    if (numeric < min || numeric > max) throw new Error(`Invalid ${label} cron field: ${value}`);
    allowed.add(numeric);
  }
  return allowed;
}

function parseCron(schedule) {
  const fields = String(schedule || '').trim().split(/\s+/);
  if (fields.length !== 5) throw new Error(`Unsupported schedule expression: ${schedule}`);
  const [minute, hour, dayOfMonth, month, dayOfWeek] = fields;
  return {
    minute: parseCronField(minute, 0, 59, 'minute'),
    hour: parseCronField(hour, 0, 23, 'hour'),
    dayOfMonth: parseCronField(dayOfMonth, 1, 31, 'day-of-month'),
    month: parseCronField(month, 1, 12, 'month'),
    dayOfWeek: parseCronField(dayOfWeek, 0, 6, 'day-of-week'),
  };
}

function matchesField(set, value) {
  return set === null || set.has(value);
}

function matchesCron(date, cron) {
  return matchesField(cron.minute, date.getUTCMinutes())
    && matchesField(cron.hour, date.getUTCHours())
    && matchesField(cron.dayOfMonth, date.getUTCDate())
    && matchesField(cron.month, date.getUTCMonth() + 1)
    && matchesField(cron.dayOfWeek, date.getUTCDay());
}

function resolveScheduledOccurrence(schedule, now = new Date()) {
  if (!(now instanceof Date) || Number.isNaN(now.getTime())) throw new Error('Invalid current time');
  const cron = parseCron(schedule);
  let cursor = new Date(Math.floor(now.getTime() / MINUTE_MS) * MINUTE_MS);
  for (let checked = 0; checked <= MAX_LOOKBACK_MINUTES; checked += 1) {
    if (matchesCron(cursor, cron)) {
      return {
        scheduled_at_utc: cursor.toISOString(),
        delay_minutes: Math.max(0, Math.floor((now.getTime() - cursor.getTime()) / MINUTE_MS)),
      };
    }
    cursor = new Date(cursor.getTime() - MINUTE_MS);
  }
  throw new Error(`Unable to find a recent occurrence for schedule: ${schedule}`);
}

function zonedDateParts(date, timeZone = 'Asia/Taipei') {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return {
    iso: `${values.year}-${values.month}-${values.day}`,
    compact: `${values.year}${values.month}${values.day}`,
  };
}

function normalizeDayBoundaryHour(value = 0) {
  const numeric = Number(value);
  if (!Number.isInteger(numeric) || numeric < 0 || numeric > 23) {
    throw new Error(`Invalid day-boundary hour: ${value}`);
  }
  return numeric;
}

function logicalDateForOccurrence(scheduledAt, timeZone = 'Asia/Taipei', dayBoundaryHour = 0) {
  const boundaryHour = normalizeDayBoundaryHour(dayBoundaryHour);
  const shifted = boundaryHour === 0
    ? scheduledAt
    : new Date(scheduledAt.getTime() - boundaryHour * HOUR_MS);
  return zonedDateParts(shifted, timeZone);
}

function normalizeCompactDate(value) {
  const compact = String(value || '').replace(/[^\d]/g, '');
  if (!DATE_PATTERN.test(compact)) throw new Error(`Invalid date: ${value}`);
  return compact;
}

function compactToIso(compact) {
  const value = normalizeCompactDate(compact);
  return `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}`;
}

function applyCollectionPolicy(logicalDateCompact, policy, holidays = loadHolidaySet()) {
  const compact = normalizeCompactDate(logicalDateCompact);
  const iso = compactToIso(compact);
  if (policy === 'same_calendar_date') {
    return { target_date: compact, logical_date: compact, is_trading_date: isTradingDate(iso, holidays) };
  }
  if (policy === 'same_trade_date') {
    return { target_date: compact, logical_date: compact, is_trading_date: isTradingDate(iso, holidays) };
  }
  if (policy === 'next_trade_date') {
    const targetIso = nextTradingDate(iso, holidays, false);
    return {
      target_date: targetIso.replaceAll('-', ''),
      logical_date: compact,
      is_trading_date: isTradingDate(iso, holidays),
    };
  }
  throw new Error(`Unsupported collection-date policy: ${policy}`);
}

function resolveScheduledCollectionDate({ schedule, policy, timeZone = 'Asia/Taipei', dayBoundaryHour = 0, now = new Date(), holidays = loadHolidaySet() }) {
  const occurrence = resolveScheduledOccurrence(schedule, now);
  const scheduledAt = new Date(occurrence.scheduled_at_utc);
  const boundaryHour = normalizeDayBoundaryHour(dayBoundaryHour);
  const logical = logicalDateForOccurrence(scheduledAt, timeZone, boundaryHour);
  return {
    ...applyCollectionPolicy(logical.compact, policy, holidays),
    policy,
    time_zone: timeZone,
    day_boundary_hour: boundaryHour,
    scheduled_at_utc: occurrence.scheduled_at_utc,
    delay_minutes: occurrence.delay_minutes,
  };
}

function resolveForEvent({ eventName, schedule, inputDate, policy, timeZone = 'Asia/Taipei', dayBoundaryHour = 0, now = new Date(), holidays = loadHolidaySet() }) {
  if (String(inputDate || '').trim()) {
    const target = normalizeCompactDate(inputDate);
    return {
      target_date: target,
      logical_date: target,
      policy,
      time_zone: timeZone,
      day_boundary_hour: 0,
      source: 'manual_explicit_date',
      scheduled_at_utc: null,
      delay_minutes: null,
      is_trading_date: isTradingDate(compactToIso(target), holidays),
    };
  }
  if (eventName === 'schedule') {
    return {
      ...resolveScheduledCollectionDate({ schedule, policy, timeZone, dayBoundaryHour, now, holidays }),
      source: 'scheduled_occurrence',
    };
  }
  const current = zonedDateParts(now, timeZone).compact;
  return {
    ...applyCollectionPolicy(current, policy, holidays),
    policy,
    time_zone: timeZone,
    day_boundary_hour: 0,
    source: 'manual_current_date',
    scheduled_at_utc: null,
    delay_minutes: null,
  };
}

function main() {
  const args = parseArgs();
  const eventName = args.get('event-name') || process.env.GITHUB_EVENT_NAME || '';
  const schedule = args.get('schedule') || process.env.GITHUB_EVENT_SCHEDULE || '';
  const inputDate = args.get('input-date') || '';
  const policy = args.get('policy') || 'same_calendar_date';
  const timeZone = args.get('time-zone') || 'Asia/Taipei';
  const dayBoundaryHour = args.get('day-boundary-hour') || 0;
  const nowArg = args.get('now');
  const now = nowArg ? new Date(nowArg) : new Date();
  if (Number.isNaN(now.getTime())) throw new Error(`Invalid --now value: ${nowArg}`);
  const result = resolveForEvent({ eventName, schedule, inputDate, policy, timeZone, dayBoundaryHour, now });
  if (args.has('json')) process.stdout.write(`${JSON.stringify(result)}\n`);
  else process.stdout.write(`${result.target_date}\n`);
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error(error.stack || error.message);
    process.exitCode = 1;
  }
}

module.exports = {
  applyCollectionPolicy,
  logicalDateForOccurrence,
  matchesCron,
  normalizeCompactDate,
  normalizeDayBoundaryHour,
  parseCron,
  resolveForEvent,
  resolveScheduledCollectionDate,
  resolveScheduledOccurrence,
  zonedDateParts,
};
