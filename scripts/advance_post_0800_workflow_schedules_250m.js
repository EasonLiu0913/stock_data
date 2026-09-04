#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const WORKFLOWS = path.join(ROOT, '.github', 'workflows');
const SHIFT_MINUTES = 250;
const TAIPEI_OFFSET_MINUTES = 8 * 60;
const CUTOFF_MINUTES = 8 * 60;
const REPORT_PATH = process.env.SCHEDULE_SHIFT_REPORT || '/tmp/schedule-shift-report.json';

function pad(n) { return String(n).padStart(2, '0'); }
function formatHm(total) {
  const normalized = ((total % 1440) + 1440) % 1440;
  return `${pad(Math.floor(normalized / 60))}:${pad(normalized % 60)}`;
}

function parseSimpleSet(field, min, max, aliasSunday = false) {
  if (field === '*') return null;
  const values = new Set();
  for (const rawPart of field.split(',')) {
    const part = rawPart.trim();
    if (!part) throw new Error(`empty cron field item: ${field}`);
    if (part.includes('/')) throw new Error(`cron steps are not supported for shifted calendar fields: ${field}`);
    if (part.includes('-')) {
      const [aRaw, bRaw] = part.split('-');
      const a = Number(aRaw), b = Number(bRaw);
      if (!Number.isInteger(a) || !Number.isInteger(b) || a < min || b > max || a > b) throw new Error(`unsupported cron range: ${field}`);
      for (let v = a; v <= b; v++) values.add(aliasSunday && v === 7 ? 0 : v);
    } else {
      const raw = Number(part);
      if (!Number.isInteger(raw) || raw < min || raw > max) throw new Error(`unsupported cron value: ${field}`);
      values.add(aliasSunday && raw === 7 ? 0 : raw);
    }
  }
  return values;
}

function compressSet(values) {
  const sorted = [...values].sort((a, b) => a - b);
  const chunks = [];
  for (let i = 0; i < sorted.length;) {
    let j = i;
    while (j + 1 < sorted.length && sorted[j + 1] === sorted[j] + 1) j++;
    chunks.push(j > i ? `${sorted[i]}-${sorted[j]}` : String(sorted[i]));
    i = j + 1;
  }
  return chunks.join(',');
}

function shiftDow(field, dayDelta) {
  if (field === '*' || dayDelta === 0) return field;
  const values = parseSimpleSet(field, 0, 7, true);
  const shifted = new Set([...values].map(v => ((v + dayDelta) % 7 + 7) % 7));
  return compressSet(shifted);
}

function shiftDom(field, dayDelta) {
  if (field === '*' || dayDelta === 0) return field;
  if (Math.abs(dayDelta) !== 1) throw new Error(`unsupported day-of-month delta ${dayDelta}`);
  const values = parseSimpleSet(field, 1, 31, false);
  const shifted = new Set();
  for (const v of values) {
    const next = v + dayDelta;
    if (next < 1 || next > 31) throw new Error(`day-of-month boundary requires manual handling: ${field} delta=${dayDelta}`);
    shifted.add(next);
  }
  return compressSet(shifted);
}

function shiftExpression(expression) {
  const fields = expression.trim().split(/\s+/);
  if (fields.length !== 5) throw new Error(`unsupported cron expression: ${expression}`);
  const [minuteField, hourField, domField, monthField, dowField] = fields;
  if (!/^\d+$/.test(minuteField) || !/^\d+$/.test(hourField)) {
    throw new Error(`scheduled workflow uses non-fixed minute/hour and needs explicit review: ${expression}`);
  }
  const minute = Number(minuteField), hour = Number(hourField);
  if (minute > 59 || hour > 23) throw new Error(`invalid cron time: ${expression}`);

  const utcTotal = hour * 60 + minute;
  const taipeiTotal = (utcTotal + TAIPEI_OFFSET_MINUTES) % 1440;
  if (taipeiTotal <= CUTOFF_MINUTES) return null;

  const shiftedRaw = utcTotal - SHIFT_MINUTES;
  const dayDelta = Math.floor(shiftedRaw / 1440);
  const newUtcTotal = ((shiftedRaw % 1440) + 1440) % 1440;
  const newHour = Math.floor(newUtcTotal / 60);
  const newMinute = newUtcTotal % 60;
  const newDom = shiftDom(domField, dayDelta);
  const newDow = shiftDow(dowField, dayDelta);
  const newExpression = `${newMinute} ${newHour} ${newDom} ${monthField} ${newDow}`;
  const newTaipeiTotal = (taipeiTotal - SHIFT_MINUTES + 1440) % 1440;

  return {
    old_expression: expression,
    new_expression: newExpression,
    old_taipei: formatHm(taipeiTotal),
    new_taipei: formatHm(newTaipeiTotal),
    old_utc: formatHm(utcTotal),
    new_utc: formatHm(newUtcTotal),
    utc_day_delta: dayDelta,
  };
}

function migrateFile(filePath) {
  const original = fs.readFileSync(filePath, 'utf8');
  const lines = original.split('\n');
  const changes = [];
  let inSchedule = false;
  let scheduleIndent = -1;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const indent = line.match(/^\s*/)[0].length;
    if (!inSchedule) {
      if (/^\s{2}schedule:\s*$/.test(line)) {
        inSchedule = true;
        scheduleIndent = indent;
      }
      continue;
    }

    if (line.trim() && !line.trim().startsWith('#') && indent <= scheduleIndent) {
      inSchedule = false;
      scheduleIndent = -1;
      i--;
      continue;
    }

    const match = line.match(/^(\s*-\s*cron:\s*['"])([^'"]+)(['"].*)$/);
    if (!match) continue;
    const change = shiftExpression(match[2]);
    if (!change) continue;
    lines[i] = `${match[1]}${change.new_expression}${match[3]}`;
    changes.push({ line: i + 1, ...change });
  }

  if (!changes.length) return [];

  // Keep human-readable schedule comments synchronized with the shifted cron times.
  // Only comment lines are touched; workflow logic outside schedule cron expressions is unchanged.
  for (let i = 0; i < lines.length; i++) {
    if (!lines[i].trim().startsWith('#')) continue;
    for (const change of changes) {
      lines[i] = lines[i]
        .replaceAll(change.old_taipei, change.new_taipei)
        .replaceAll(change.old_utc, change.new_utc);
    }
  }

  const updated = lines.join('\n');
  if (updated === original) throw new Error(`internal error: expected ${filePath} to change`);
  fs.writeFileSync(filePath, updated, 'utf8');
  return changes;
}

function main() {
  const files = fs.readdirSync(WORKFLOWS)
    .filter(name => /\.ya?ml$/i.test(name))
    .sort();
  const report = [];
  for (const name of files) {
    const filePath = path.join(WORKFLOWS, name);
    const changes = migrateFile(filePath);
    if (changes.length) report.push({ path: `.github/workflows/${name}`, changes });
  }

  const total = report.reduce((sum, x) => sum + x.changes.length, 0);
  if (total === 0) throw new Error('No post-08:00 Taipei schedules were found; refusing empty migration');

  const payload = {
    shift_minutes: SHIFT_MINUTES,
    cutoff_taipei: '08:00',
    workflow_count: report.length,
    cron_count: total,
    workflows: report,
  };
  fs.writeFileSync(REPORT_PATH, JSON.stringify(payload, null, 2) + '\n', 'utf8');
  console.log(JSON.stringify(payload, null, 2));
}

main();
