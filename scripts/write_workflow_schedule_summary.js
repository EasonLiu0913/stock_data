#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const https = require('node:https');

const MINUTE_MS = 60 * 1000;
const MAX_LOOKBACK_MINUTES = 60 * 24 * 40;
const DATA_WORKFLOW_PATTERNS = [
  /^crawl-/i,
  /^backfill-/i,
  /^retry-(institutional|sma)/i,
  /^warrant-scraper\.ya?ml$/i,
  /^daily-gainers-over-5\.ya?ml$/i,
  /^update-(twse|non-trading|official)/i,
];
const SUMMARY_JOB_NAMES = new Set(['排程時間摘要', '資料擷取完整性摘要']);
const JOB_POLL_MS = 20000;
const MAX_JOB_WAIT_MS = 6 * 60 * 60 * 1000;

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
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day} ${values.hour}:${values.minute}:${values.second}`;
}

function readEvent() {
  try {
    const file = process.env.GITHUB_EVENT_PATH;
    if (!file) return {};
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return {};
  }
}

function requestJson(pathname, token = '') {
  return new Promise((resolve, reject) => {
    const request = https.request({
      hostname: 'api.github.com',
      path: pathname,
      method: 'GET',
      headers: {
        'User-Agent': 'stock-data-workflow-summary',
        Accept: 'application/vnd.github+json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    }, (response) => {
      let body = '';
      response.setEncoding('utf8');
      response.on('data', (chunk) => { body += chunk; });
      response.on('end', () => {
        if ((response.statusCode || 500) >= 400) return reject(new Error(`GitHub API ${response.statusCode}`));
        try { resolve(JSON.parse(body)); } catch (error) { reject(error); }
      });
    });
    request.on('error', reject);
    request.end();
  });
}

async function requestWithFallback(pathname) {
  const token = process.env.GITHUB_TOKEN || '';
  if (token) {
    try { return await requestJson(pathname, token); } catch { /* public fallback */ }
  }
  return requestJson(pathname, '');
}

function requestTextUrl(url, token = '', redirects = 0) {
  return new Promise((resolve, reject) => {
    if (redirects > 5) return reject(new Error('Too many redirects while fetching job log'));
    const target = new URL(url);
    const headers = { 'User-Agent': 'stock-data-workflow-summary', Accept: 'text/plain,*/*' };
    if (token && target.hostname === 'api.github.com') headers.Authorization = `Bearer ${token}`;
    const request = https.request({ hostname: target.hostname, path: `${target.pathname}${target.search}`, method: 'GET', headers }, (response) => {
      if ([301, 302, 303, 307, 308].includes(response.statusCode) && response.headers.location) {
        response.resume();
        const next = new URL(response.headers.location, target);
        return resolve(requestTextUrl(next.toString(), token, redirects + 1));
      }
      if ((response.statusCode || 500) >= 400) { response.resume(); return reject(new Error(`GitHub log API ${response.statusCode}`)); }
      const chunks = [];
      let bytes = 0;
      const limit = 4 * 1024 * 1024;
      response.on('data', (chunk) => {
        if (bytes < limit) { chunks.push(chunk); bytes += chunk.length; }
      });
      response.on('end', () => {
        const buffer = Buffer.concat(chunks);
        if (buffer.length >= 2 && buffer[0] === 0x50 && buffer[1] === 0x4b) return resolve('');
        resolve(buffer.toString('utf8'));
      });
    });
    request.on('error', reject);
    request.end();
  });
}

async function fetchJobLog(jobId) {
  const repo = process.env.GITHUB_REPOSITORY;
  if (!repo || !jobId) return '';
  const token = process.env.GITHUB_TOKEN || '';
  const url = `https://api.github.com/repos/${repo}/actions/jobs/${jobId}/logs`;
  if (token) {
    try { return await requestTextUrl(url, token); } catch { /* public fallback */ }
  }
  return requestTextUrl(url, '');
}

async function fetchRun() {
  const repo = process.env.GITHUB_REPOSITORY;
  const runId = process.env.GITHUB_RUN_ID;
  if (!repo || !runId) throw new Error('Missing GitHub run identity');
  return requestWithFallback(`/repos/${repo}/actions/runs/${runId}`);
}

async function fetchRunJobs() {
  const repo = process.env.GITHUB_REPOSITORY;
  const runId = process.env.GITHUB_RUN_ID;
  if (!repo || !runId) throw new Error('Missing GitHub run identity');
  return requestWithFallback(`/repos/${repo}/actions/runs/${runId}/jobs?per_page=100`);
}

function sleep(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function isSummaryJob(job) {
  const name = String(job?.name || '');
  return SUMMARY_JOB_NAMES.has(name) || name.includes('排程時間摘要') || name.includes('資料擷取完整性摘要');
}

async function waitForMainJobs() {
  const startedAt = Date.now();
  let lastPayload = null;
  while (Date.now() - startedAt <= MAX_JOB_WAIT_MS) {
    lastPayload = await fetchRunJobs();
    const jobs = Array.isArray(lastPayload?.jobs) ? lastPayload.jobs : [];
    const mainJobs = jobs.filter((job) => !isSummaryJob(job));
    if (mainJobs.length > 0 && mainJobs.every((job) => job.status === 'completed')) return lastPayload;
    await sleep(JOB_POLL_MS);
  }
  const error = new Error('Timed out waiting for the workflow main jobs to complete');
  error.lastPayload = lastPayload;
  throw error;
}

function appendSummary(lines) {
  const text = `${lines.join('\n')}\n`;
  if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, text, 'utf8');
  else process.stdout.write(text);
}

function workflowFilename() {
  const ref = String(process.env.GITHUB_WORKFLOW_REF || '');
  const match = ref.match(/\.github\/workflows\/([^@]+)@/);
  return match ? match[1] : '';
}

function isDataWorkflow(filename = workflowFilename()) {
  return DATA_WORKFLOW_PATTERNS.some((pattern) => pattern.test(filename));
}

function normalizeDateCandidate(value) {
  const text = String(value || '');
  const compact = text.match(/\b(20\d{6})\b/);
  if (compact) return compact[1];
  const dashed = text.match(/\b(20\d{2})[-\/]([01]\d)[-\/]([0-3]\d)\b/);
  return dashed ? `${dashed[1]}${dashed[2]}${dashed[3]}` : '';
}

function extractDates(text) {
  const source = String(text || '');
  const expectedPatterns = [
    /(?:target[_ -]?date|requested[_ -]?date|expected[_ -]?(?:market[_ -]?)?date|預期(?:擷取)?日期|目標日期|擷取日期)\s*[:=：]\s*[`"']?([^\s`"']+)/ig,
    /--date\s+["']?([^\s"']+)/ig,
  ];
  const actualPatterns = [
    /(?:actual[_ -]?(?:market[_ -]?)?date|official[_ -]?(?:latest[_ -]?)?date|source[_ -]?(?:collection[_ -]?)?date|實際(?:資料)?日期|官方(?:目前)?最新日期)\s*[:=：]\s*[`"']?([^\s`"']+)/ig,
  ];
  const collect = (patterns) => {
    const out = [];
    for (const pattern of patterns) {
      let match;
      while ((match = pattern.exec(source))) {
        const date = normalizeDateCandidate(match[1]);
        if (date) out.push(date);
      }
    }
    return out;
  };
  return { expected: collect(expectedPatterns), actual: collect(actualPatterns) };
}

function extractCounts(text) {
  const source = String(text || '');
  const candidates = [];
  const patterns = [
    /(?:成功|完成|success(?:ful)?|completed?)\D{0,12}(\d{1,6})\D{0,20}(?:總數|總計|total)\D{0,12}(\d{1,6})/ig,
    /(\d{1,6})\s*\/\s*(\d{1,6})/g,
    /(?:missing|缺少|尚缺|未完成)\D{0,12}(\d{1,6})\D{0,20}(?:total|總數|總計)\D{0,12}(\d{1,6})/ig,
  ];
  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(source))) {
      const a = Number(match[1]);
      const b = Number(match[2]);
      if (Number.isFinite(a) && Number.isFinite(b) && b > 0 && a <= b) candidates.push({ success: a, total: b });
    }
  }
  return candidates.at(-1) || null;
}

function classifyDataResult({ allSucceeded, text, expectedDate, actualDate, counts }) {
  const source = String(text || '');
  const lower = source.toLowerCase();
  const dateMismatch = Boolean(expectedDate && actualDate && expectedDate !== actualDate);
  const noData = /沒有符合條件的資料|尚未更新|not\s+(?:yet\s+)?available|no\s+data\s+available|data\s+not\s+ready/.test(lower);
  const partial = /部分資料|partial|未完成|缺少|尚缺|failed[_ -]?count\s*[:=]\s*[1-9]\d*|error[_ -]?count\s*[:=]\s*[1-9]\d*/i.test(source)
    || Boolean(counts && counts.success < counts.total);
  const server = /429|5\d\d|timeout|timed out|econnreset|econnrefused|socket hang up|network error|fetch failed|could not resolve|server.*(?:unavailable|沒有回應)|伺服器.*沒有回應/i.test(source);
  const format = /parse error|invalid json|unexpected token|missing header|schema|欄位.*(?:缺少|異常)|格式.*(?:異常|錯誤)/i.test(source);

  if (dateMismatch || noData) return { ok: false, code: 'data_not_updated', label: '資料尚未更新', reason: dateMismatch ? `預期日期 ${expectedDate}，實際資料日期 ${actualDate}，日期不符。` : '官方資料尚未更新或尚未提供目標日期資料。' };
  if (partial) {
    const detail = counts ? `${counts.total - counts.success} 筆尚未更新 / 總數 ${counts.total}` : '偵測到部分資料缺漏或未完成項目。';
    return { ok: false, code: 'partial_data', label: '部分資料尚未更新', reason: detail };
  }
  if (server) return { ok: false, code: 'server_unavailable', label: '伺服器沒有回應', reason: '偵測到 HTTP 429/5xx、timeout、連線重設或其他伺服器/網路錯誤。' };
  if (format) return { ok: false, code: 'format_error', label: '資料格式異常', reason: '來源有回應，但欄位、JSON/CSV 或 schema 驗證未通過。' };
  if (!allSucceeded) return { ok: false, code: 'other_failure', label: '其他擷取失敗', reason: '至少一個主要 job 失敗，且未符合已知的日期、部分資料、伺服器或格式錯誤分類。' };
  return { ok: true, code: 'complete', label: '完整成功', reason: '所有主要 jobs 均成功，且未偵測到日期不符、部分缺漏或來源錯誤。' };
}

function summarizeJobContext(payload) {
  const jobs = Array.isArray(payload?.jobs) ? payload.jobs : [];
  const mainJobs = jobs.filter((job) => !isSummaryJob(job));
  const allSucceeded = mainJobs.length > 0 && mainJobs.every((job) => job.status === 'completed' && ['success', 'skipped'].includes(job.conclusion));
  const fragments = [];
  for (const job of mainJobs) {
    fragments.push(`job=${job.name} status=${job.status} conclusion=${job.conclusion}`);
    for (const step of job.steps || []) fragments.push(`step=${step.name} status=${step.status} conclusion=${step.conclusion}`);
  }
  return { mainJobs, allSucceeded, text: fragments.join('\n') };
}

function eventDateHints(event) {
  const inputs = event?.inputs || {};
  const values = [inputs.date, inputs.target_date, inputs.end_date, inputs.start_date].filter(Boolean);
  return values.map(normalizeDateCandidate).filter(Boolean);
}

async function collectJobLogs(jobs) {
  const fragments = [];
  for (const job of jobs || []) {
    try {
      const log = await fetchJobLog(job.id);
      if (log) fragments.push(`\n===== ${job.name} =====\n${log}`);
    } catch (error) {
      fragments.push(`\n===== ${job.name} log unavailable =====\n${error.message || error}`);
    }
  }
  return fragments.join('\n');
}

function renderDataSummary({ filename, result, expectedDate, actualDate, counts, jobs }) {
  const icon = result.ok ? '🟢' : '🔴';
  const lines = [
    `## ${icon} 資料擷取完整性`,
    `- Workflow：\`${filename || 'unknown'}\``,
    `- 預期擷取日期：${expectedDate ? `\`${expectedDate}\`` : '`未偵測到明確日期`'}`,
    `- 實際資料日期：${actualDate ? `\`${actualDate}\`` : '`未偵測到明確日期`'}`,
  ];
  if (counts) {
    lines.push(`- 預期筆數：${counts.total}`);
    lines.push(`- 成功筆數：${counts.success}`);
    lines.push(`- 缺少筆數：${Math.max(0, counts.total - counts.success)}`);
  }
  lines.push(`- 擷取結果：**${result.label}**`);
  lines.push(`- 原因：${result.reason}`);
  if (!result.ok) lines.push('- 狀態：**紅燈。資料未完整確認前，不視為成功。**');
  else lines.push('- 狀態：**綠燈。已通過本次 workflow 的完整性判斷。**');
  if (jobs?.length) {
    const failed = jobs.filter((job) => !['success', 'skipped'].includes(job.conclusion));
    if (failed.length) lines.push(`- 失敗 jobs：${failed.map((job) => `\`${job.name}\``).join('、')}`);
  }
  return lines;
}

function selfTest() {
  const created = new Date('2026-08-27T16:50:46Z');
  const occurrence = previousOccurrence('52 5 * * *', created);
  if (occurrence.toISOString() !== '2026-08-27T05:52:00.000Z') throw new Error('daily cron self-test failed');
  if (!formatTaipei(occurrence).startsWith('2026-08-27 13:52')) throw new Error('Taipei formatting self-test failed');
  const weekly = previousOccurrence('22 0 * * 1-5', new Date('2026-08-28T11:30:00Z'));
  if (weekly.toISOString() !== '2026-08-28T00:22:00.000Z') throw new Error('weekday cron self-test failed');
  const dates = extractDates('target_date=20260828 official_latest_date=20260827');
  if (dates.expected.at(-1) !== '20260828' || dates.actual.at(-1) !== '20260827') throw new Error('date extraction self-test failed');
  const mismatch = classifyDataResult({ allSucceeded: false, text: '', expectedDate: '20260828', actualDate: '20260827', counts: null });
  if (mismatch.code !== 'data_not_updated') throw new Error('date mismatch classification self-test failed');
  const partial = classifyDataResult({ allSucceeded: false, text: '完成 1200 / 總數 1330', expectedDate: '20260828', actualDate: '20260828', counts: { success: 1200, total: 1330 } });
  if (partial.code !== 'partial_data') throw new Error('partial classification self-test failed');
  const server = classifyDataResult({ allSucceeded: false, text: 'HTTP 429 Too Many Requests', expectedDate: '', actualDate: '', counts: null });
  if (server.code !== 'server_unavailable') throw new Error('server classification self-test failed');
  console.log('write_workflow_schedule_summary self-test passed');
}

async function main() {
  if (process.argv.includes('--self-test')) return selfTest();

  const event = readEvent();
  const run = await fetchRun().catch(() => null);
  const createdAt = run?.created_at ? new Date(run.created_at) : new Date();

  if (process.env.GITHUB_EVENT_NAME !== 'schedule') {
    appendSummary([
      '## 排程時間',
      '- 原定排程時間（台北時間）：非排程觸發',
      `- 實際開始時間（台北時間）：${formatTaipei(createdAt)}`,
      '- GitHub 排程延遲：不適用',
    ]);
  } else {
    const schedule = String(event.schedule || '');
    try {
      if (!schedule) throw new Error('Schedule event is missing github.event.schedule');
      const intendedAt = previousOccurrence(schedule, createdAt);
      const delayMinutes = Math.max(0, Math.floor((createdAt.getTime() - intendedAt.getTime()) / MINUTE_MS));
      appendSummary([
        '## 排程時間',
        `- 原定排程時間（台北時間）：${formatTaipei(intendedAt)}`,
        `- 實際開始時間（台北時間）：${formatTaipei(createdAt)}`,
        `- GitHub 排程延遲：約 ${delayMinutes} 分鐘`,
      ]);
    } catch (error) {
      appendSummary([
        '## 排程時間',
        '- 原定排程時間（台北時間）：無法判定',
        `- 實際開始時間（台北時間）：${formatTaipei(createdAt)}`,
        `- GitHub 排程延遲：無法計算（${String(error.message || error)}）`,
      ]);
    }
  }

  const filename = workflowFilename();
  if (!isDataWorkflow(filename)) return;

  const jobsPayload = await waitForMainJobs().catch((error) => ({ ...(error.lastPayload || { jobs: [] }), _error: error }));
  const context = summarizeJobContext(jobsPayload);
  const jobLogs = await collectJobLogs(context.mainJobs);
  const combinedText = `${context.text}\n${jobLogs}\n${JSON.stringify(event)}`;
  const dates = extractDates(combinedText);
  const expectedDate = dates.expected.at(-1) || eventDateHints(event).at(-1) || '';
  const actualDate = dates.actual.at(-1) || '';
  const counts = extractCounts(combinedText);
  const result = classifyDataResult({ allSucceeded: context.allSucceeded, text: combinedText, expectedDate, actualDate, counts });
  if (jobsPayload._error && !context.mainJobs.length) {
    result.ok = false;
    result.code = 'other_failure';
    result.label = '無法確認資料完整性';
    result.reason = `無法讀取本次 run 的 job 狀態：${jobsPayload._error.message || jobsPayload._error}`;
  }
  appendSummary(['', ...renderDataSummary({ filename, result, expectedDate, actualDate, counts, jobs: context.mainJobs })]);
}

main().catch((error) => {
  appendSummary([
    '## 🔴 Workflow Summary 產生失敗',
    `- 原因：${String(error.message || error)}`,
    '- 狀態：紅燈；無法確認資料完整性。',
  ]);
  process.exitCode = 0;
});

module.exports = {
  parseCron,
  cronMatches,
  previousOccurrence,
  formatTaipei,
  isDataWorkflow,
  extractDates,
  extractCounts,
  classifyDataResult,
};
