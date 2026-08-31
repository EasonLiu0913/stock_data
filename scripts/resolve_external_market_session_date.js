'use strict';

const NEW_YORK_TIME_ZONE = 'America/New_York';
const US_MARKET_OPEN_MINUTES = 9 * 60 + 30;

function compactToIso(value) {
  return `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}`;
}

function isoToCompact(value) {
  return String(value || '').replaceAll('-', '');
}

function addDaysIso(iso, days) {
  const date = new Date(`${iso}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function previousWeekday(dateCompact) {
  let iso = addDaysIso(compactToIso(dateCompact), -1);
  while ([0, 6].includes(new Date(`${iso}T00:00:00Z`).getUTCDay())) iso = addDaysIso(iso, -1);
  return isoToCompact(iso);
}

function rollBackWeekend(dateCompact) {
  let iso = compactToIso(dateCompact);
  while ([0, 6].includes(new Date(`${iso}T00:00:00Z`).getUTCDay())) iso = addDaysIso(iso, -1);
  return isoToCompact(iso);
}

function zonedDateTimeParts(now, timeZone = NEW_YORK_TIME_ZONE) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    timeZoneName: 'short',
    hourCycle: 'h23',
  }).formatToParts(now);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return {
    dateCompact: `${values.year}${values.month}${values.day}`,
    hour: Number(values.hour),
    minute: Number(values.minute),
    second: Number(values.second),
    zone: values.timeZoneName || null,
    text: `${values.year}-${values.month}-${values.day} ${values.hour}:${values.minute}:${values.second}${values.timeZoneName ? ` ${values.timeZoneName}` : ''}`,
  };
}

function resolveExternalMarketSessionDate(now = new Date()) {
  if (!(now instanceof Date) || Number.isNaN(now.getTime())) throw new Error('Invalid external-market anchor time');
  const newYork = zonedDateTimeParts(now);
  const minutes = newYork.hour * 60 + newYork.minute;
  const targetDate = minutes >= US_MARKET_OPEN_MINUTES
    ? rollBackWeekend(newYork.dateCompact)
    : previousWeekday(newYork.dateCompact);
  return {
    targetDate,
    newYorkTime: newYork.text,
    rule: minutes >= US_MARKET_OPEN_MINUTES ? 'new_york_date_at_or_after_09_30' : 'previous_weekday_before_09_30',
  };
}

function main() {
  const args = process.argv.slice(2);
  const index = args.indexOf('--now');
  const raw = index >= 0 ? args[index + 1] : null;
  const now = raw ? new Date(raw) : new Date();
  const result = resolveExternalMarketSessionDate(now);
  if (args.includes('--json')) process.stdout.write(`${JSON.stringify(result)}\n`);
  else process.stdout.write(`${result.targetDate}\n`);
}

if (require.main === module) {
  try { main(); } catch (error) { console.error(error.stack || error.message); process.exitCode = 1; }
}

module.exports = { resolveExternalMarketSessionDate, zonedDateTimeParts };
