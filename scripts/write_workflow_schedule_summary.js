#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const https = require('node:https');

const MINUTE_MS = 60 * 1000;
const MAX_LOOKBACK_MINUTES = 60 * 24 * 40;

function parseField(field, min, max) {
  const values = new Set();
  for (const part of String(field).split(',')) {
    const [rangePart, stepPart] = part.split('/');
    const step = stepPart ? Number(stepPart) : 1;
    if (!Number.isInteger(step) || step < 1) throw new Error(`Invalid cron step: ${part}`);
    let start;
    let end;
    if (rangePart === '*') {
      start = min;
      end = max;
    } else if (rangePart.includes('-')) {
      const [a, b] = rangePart.split('-').map(Number);
      start = a;
      end = b;
    } else {
      start = Number(rangePart);
      end = Number(rangePart);
    }
    if (!Number.isInteger(start) || !Number.isInteger(end) || start < min || end > max || start > end) {
      throw new Error(`Invalid cron field: ${field}`);
    }
    for (let value = start; value <= end; value += step) values.add(value);
  }
  return values;
}

function parseCron(expression) {
  const fields = String(expression || '').trim().split(/\s+/);
  if (fields.length !== 5) throw new Error(`Unsupported cron expression: ${expression}`);
  return {
    minute: parseField(fields[0], 0, 59),
    hour: parseField(fields[1], 0, 23),
    day: parseField(fields[2], 1, 31),
    month: parseField(fields[3], 1, 12),
    dow: parseField(fields[4], 0, 7),
    dayWildcard: fields[2] === '*',
    dowWildcard: fields[4] === '*',
  };
}

function cronMatches(date, cron) {
  const dow = date.getUTCDay();
  const dowMatch = cron.dow.has(dow) || (dow === 0 && cron.dow.has(7));
  const dayMatch = cron.day.has(date.getUTCDate());
  const dateMatch = cron.dayWildcard && cron.dowWildcard
    ? true
    : cron.dayWildcard
      ? dowMatch
      : cron.dowWildcard
        ? dayMatch
        : dayMatch || dowMatch;
  return cron.minute.has(date.getUTCMinutes())
    && cron.hour.has(date.getUTCHours())
    && cron.month.has(date.getUTCMonth() + 1)
    && dateMatch;
}

function previousOccurrence(expression, createdAt) {
  const cron = parseCron(expression);
  let cursor = new Date(createdAt);
  cursor.setUTCSeconds(0, 0);
  for (let offset = 0; offset <= MAX_LOOKBACK_MINUTES; offset += 1) {
    if (cronMatches(cursor, cron)) return new Date(cursor);
    cursor = new Date(cursor.getTime() - MINUTE_MS);
  }
  throw new Error(`Unable to resolve previous cron occurrence: ${expression}`);
}

function formatTaipei(date) {
  const parts = new Intl.DateTimeFormat('zh-TW', {
    timeZone: 'Asia/Taipei',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day} ${values.hour}:${values.minute}`;
}

function readEventSchedule() {
  try {
    const file = process.env.GITHUB_EVENT_PATH;
    if (!file) return '';
    const event = JSON.parse(fs.readFileSync(file, 'utf8'));
    return String(event.schedule || '');
  } catch {
    return '';
  }
}

function fetchRunCreatedAt() {
  return new Promise((resolve, reject) => {
    const repo = process.env.GITHUB_REPOSITORY;
    const runId = process.env.GITHUB_RUN_ID;
    const token = process.env.GITHUB_TOKEN || '';
    if (!repo || !runId) return reject(new Error('Missing GitHub run identity'));
    const request = https.request({
      hostname: 'api.github.com',
      path: `/repos/${repo}/actions/runs/${runId}`,
      method: 'GET',
      headers: {
        'User-Agent': 'stock-data-schedule-summary',
        Accept: 'application/vnd.github+json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    }, (response) => {
      let body = '';
      response.setEncoding('utf8');
      response.on('data', (chunk) => { body += chunk; });
      response.on('end', () => {
        if ((response.statusCode || 500) >= 400) return reject(new Error(`GitHub API ${response.statusCode}`));
        try {
          const payload = JSON.parse(body);
          if (!payload.created_at) throw new Error('Run created_at missing');
          resolve(new Date(payload.created_at));
        } catch (error) {
          reject(error);
        }
      });
    });
    request.on('error', reject);
    request.end();
  });
}

function appendSummary(lines) {
  const text = `${lines.join('\n')}\n`;
  if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, text, 'utf8');
  else process.stdout.write(text);
}

function selfTest() {
  const created = new Date('2026-08-27T16:50:46Z');
  const occurrence = previousOccurrence('52 5 * * *', created);
  if (occurrence.toISOString() !== '2026-08-27T05:52:00.000Z') throw new Error('daily cron self-test failed');
  const weekly = previousOccurrence('22 0 * * 1-5', new Date('2026-08-28T11:30:00Z'));
  if (weekly.toISOString() !== '2026-08-28T00:22:00.000Z') throw new Error('weekday cron self-test failed');
  console.log('write_workflow_schedule_summary self-test passed');
}

async function main() {
  if (process.argv.includes('--self-test')) return selfTest();

  if (process.env.GITHUB_EVENT_NAME !== 'schedule') {
    appendSummary([
      '## 排程時間',
      '- 原定排程時間（台北時間）：非排程觸發',
      '- GitHub 排程延遲：不適用',
    ]);
    return;
  }

  const schedule = readEventSchedule();
  if (!schedule) throw new Error('Schedule event is missing github.event.schedule');
  const createdAt = await fetchRunCreatedAt().catch(() => new Date());
  const intendedAt = previousOccurrence(schedule, createdAt);
  const delayMinutes = Math.max(0, Math.floor((createdAt.getTime() - intendedAt.getTime()) / MINUTE_MS));
  appendSummary([
    '## 排程時間',
    `- 原定排程時間（台北時間）：${formatTaipei(intendedAt)}`,
    `- GitHub 排程延遲：約 ${delayMinutes} 分鐘`,
  ]);
}

main().catch((error) => {
  appendSummary([
    '## 排程時間',
    '- 原定排程時間（台北時間）：無法判定',
    `- GitHub 排程延遲：無法計算（${String(error.message || error)}）`,
  ]);
  process.exitCode = 0;
});

module.exports = { parseCron, cronMatches, previousOccurrence, formatTaipei };
