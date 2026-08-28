#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');

const DAY_MS = 24 * 60 * 60 * 1000;

function compactTaipeiDate(date) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Taipei',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}${values.month}${values.day}`;
}

function parseDailyCron(schedule) {
  const match = String(schedule || '').trim().match(/^(\d{1,2})\s+(\d{1,2})\s+\*\s+\*\s+\*$/);
  if (!match) {
    throw new Error(`Unsupported SMA schedule expression: ${schedule}`);
  }
  const minute = Number(match[1]);
  const hour = Number(match[2]);
  if (minute < 0 || minute > 59 || hour < 0 || hour > 23) {
    throw new Error(`Invalid SMA schedule expression: ${schedule}`);
  }
  return { hour, minute };
}

function resolveScheduledTargetDate(schedule, now = new Date()) {
  const { hour, minute } = parseDailyCron(schedule);
  let occurrenceMs = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate(),
    hour,
    minute,
    0,
    0,
  );

  // GitHub may create a scheduled event many hours late. Use the most recent
  // occurrence of the exact cron expression, not the runner's current date.
  if (occurrenceMs > now.getTime()) occurrenceMs -= DAY_MS;
  const scheduledAt = new Date(occurrenceMs);

  return {
    target_date: compactTaipeiDate(scheduledAt),
    scheduled_at_utc: scheduledAt.toISOString(),
    delay_minutes: Math.max(0, Math.floor((now.getTime() - occurrenceMs) / 60000)),
  };
}

function runSelfTest() {
  assert.deepEqual(
    resolveScheduledTargetDate('52 5 * * *', new Date('2026-08-27T05:52:30Z')),
    {
      target_date: '20260827',
      scheduled_at_utc: '2026-08-27T05:52:00.000Z',
      delay_minutes: 0,
    },
  );

  assert.deepEqual(
    resolveScheduledTargetDate('52 5 * * *', new Date('2026-08-27T16:50:46Z')),
    {
      target_date: '20260827',
      scheduled_at_utc: '2026-08-27T05:52:00.000Z',
      delay_minutes: 658,
    },
  );

  assert.deepEqual(
    resolveScheduledTargetDate('11 6 * * *', new Date('2026-08-27T17:35:28Z')),
    {
      target_date: '20260827',
      scheduled_at_utc: '2026-08-27T06:11:00.000Z',
      delay_minutes: 684,
    },
  );

  // Before today's cron time, the most recent intended occurrence was yesterday.
  assert.equal(
    resolveScheduledTargetDate('52 5 * * *', new Date('2026-08-28T03:00:00Z')).target_date,
    '20260827',
  );

  console.log('resolve_scheduled_sma_target_date self-test passed');
}

function getArg(flag) {
  const index = process.argv.indexOf(flag);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : null;
}

function main() {
  if (process.argv.includes('--self-test')) {
    runSelfTest();
    return;
  }

  const schedule = getArg('--schedule') || process.env.GITHUB_EVENT_SCHEDULE || '';
  const result = resolveScheduledTargetDate(schedule);
  if (process.argv.includes('--json')) {
    process.stdout.write(`${JSON.stringify(result)}\n`);
  } else {
    process.stdout.write(`${result.target_date}\n`);
  }
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
  compactTaipeiDate,
  parseDailyCron,
  resolveScheduledTargetDate,
};
