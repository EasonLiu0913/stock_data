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
const SUMMARY_JOB_NAMES = new Set(['æ’ç¨‹æ™‚é–“æ‘˜è¦', 'è³‡æ–™æ“·å–å®Œæ•´æ€§æ‘˜è¦']);
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
  return SUMMARY_JOB_NAMES.has(name) || name.includes('æ’ç¨‹æ™‚é–“æ‘˜è¦') || name.includes('è³‡æ–™æ“·å–å®Œæ•´æ€§æ‘˜è¦');
}

async function waitForMainJobs() {
  const startedAt = Date.now();
  let lastPayload = null;
  while (Date.now() - startedAt <= MAX_JOB_WAIT_MS) {
    lastPayload = await fetchRu²È="24è€Ÿ–Û’î[šNß–>[–’ÇšV\œ°É•…Í½¸è€Ÿ¢Ï–ÂG’â–/’âï¢š©½ˆƒ–’ÇšV_¾ò3’âSšr«²›–B#–ŞË~—jš^—šr¦£–"¢ÎšZg’òëšr7–f£š"[š‚ó–ò?¦2¿¢ª“–"¦†{œôì(€É•ÑÕÉ¸ì½¬èÑÉÕ”°½‘”è€½µÁ±•Ñ”œ°±…‰•°è€Ÿ–º3šVÓš"C–*|œ°É•…Í½¸è€Ÿš&šr'’âï¢š©½‰Ìƒ–vš"C–*¾ò3’âSšr«–×šâ³–"Ãš^—šr’â7²›¦£–"òëšò?š"[’úšêC¦2¿¢ª“œôì)ô()™Õ¹Ñ¥½¸ÍÕµµ…É¥é•)½‰½¹Ñ•áĞ¡Á…å±½…¤ì(€½¹ÍĞ©½‰Ì€ôÉÉ…ä¹¥ÍÉÉ…ä¡Á…å±½…ü¹©½‰Ì¤€üÁ…å±½…¹©½‰Ì€èmtì(€½¹ÍĞµ…¥¹)½‰Ì€ô©½‰Ì¹™¥±Ñ•È ¡©½ˆ¤€ôø€…¥ÍMÕµµ…Éå)½ˆ¡©½ˆ¤¤ì(€½¹ÍĞ…±±MÕ••‘•€ôµ…¥¹)½‰Ì¹±•¹Ñ €ø€À€˜˜µ…¥¹)½‰Ì¹•Ù•Éä ¡©½ˆ¤€ôø©½ˆ¹ÍÑ…ÑÕÌ€ôôô€½µÁ±•Ñ•œ€˜˜lÍÕ•ÍÌœ°€Í­¥ÁÁ•t¹¥¹±Õ‘•Ì¡©½ˆ¹½¹±ÕÍ¥½¸¤¤ì(€½¹ÍĞ™É…µ•¹ÑÌ€ômtì(€™½È€¡½¹ÍĞ©½ˆ½˜µ…¥¹)½‰Ì¤ì(€€€™É…µ•¹ÑÌ¹ÁÕÍ ¡©½ˆô‘í©½ˆ¹¹…µ•ôÍÑ…ÑÕÌô‘í©½ˆ¹ÍÑ…ÑÕÍô½¹±ÕÍ¥½¸ô‘í©½ˆ¹½¹±ÕÍ¥½¹õ€¤ì(€€€™½È€¡½¹ÍĞÍÑ•À½˜©½ˆ¹ÍÑ•ÁÌñğmt¤™É…µ•¹ÑÌ¹ÁÕÍ ¡ÍÑ•Àô‘íÍÑ•À¹¹…µ•ôÍÑ…ÑÕÌô‘íÍÑ•À¹ÍÑ…ÑÕÍô½¹±ÕÍ¥½¸ô‘íÍÑ•À¹½¹±ÕÍ¥½¹õ€¤ì(€ô(€É•ÑÕÉ¸ìµ…¥¹)½‰Ì°…±±MÕ••‘•°Ñ•áĞè™É…µ•¹ÑÌ¹©½¥¸ q¸œ¤ôì)ô()™Õ¹Ñ¥½¸•Ù•¹Ñ…Ñ•!¥¹ÑÌ¡•Ù•¹Ğ¤ì(€½¹ÍĞ¥¹ÁÕÑÌ€ô•Ù•¹Ğü¹¥¹ÁÕÑÌñğíôì(€½¹ÍĞÙ…±Õ•Ì€ôm¥¹ÁÕÑÌ¹‘…Ñ”°¥¹ÁÕÑÌ¹Ñ…É•Ñ}‘…Ñ”°¥¹ÁÕÑÌ¹•¹‘}‘…Ñ”°¥¹ÁÕÑÌ¹ÍÑ…ÉÑ}‘…Ñ•t¹™¥±Ñ•È¡	½½±•…¸¤ì(€É•ÑÕÉ¸Ù…±Õ•Ì¹µ…À¡¹½Éµ…±¥é•…Ñ•…¹‘¥‘…Ñ”¤¹™¥±Ñ•È¡	½½±•…¸¤ì)ô()…Íå¹Œ™Õ¹Ñ¥½¸½±±•Ñ)½‰1½Ì¡©½‰Ì¤ì(€½¹ÍĞ™É…µ•¹ÑÌ€ômtì(€™½È€¡½¹ÍĞ©½ˆ½˜©½‰Ìñğmt¤ì(€€€ÑÉäì(€€€€€½¹ÍĞ±½œ€ô…İ…¥Ğ™•Ñ¡)½‰1½œ¡©½ˆ¹¥¤ì(€€€€€¥˜€¡±½œ¤™É…µ•¹ÑÌ¹ÁÕÍ ¡q¸ôôôôô€‘í©½ˆ¹¹…µ•ô€ôôôôõq¸‘í±½õ€¤ì(€€€ô…Ñ €¡•ÉÉ½È¤ì(€€€€€™É…µ•¹ÑÌ¹ÁÕÍ ¡q¸ôôôôô€‘í©½ˆ¹¹…µ•ô±½œÕ¹…Ù…¥±…‰±”€ôôôôõq¸‘í•ÉÉ½È¹µ•ÍÍ…”ñğ•ÉÉ½Éõ€¤ì(€€€ô(€ô(€É•ÑÕÉ¸™É…µ•¹ÑÌ¹©½¥¸ q¸œ¤ì)ô()™Õ¹Ñ¥½¸É•¹‘•É…Ñ…MÕµµ…Éä¡ì™¥±•¹…µ”°É•ÍÕ±Ğ°•áÁ•Ñ•‘…Ñ”°…ÑÕ…±…Ñ”°½Õ¹ÑÌ°©½‰Ìô¤ì(€½¹ÍĞ¥½¸€ôÉ•ÍÕ±Ğ¹½¬€ü€ŸÂ~~ˆœ€è€ŸÂ~RĞœì(€½¹ÍĞ±¥¹•Ì€ôl(€€€€ŒŒ€‘í¥½¹ôƒ¢ÎšZgšNß–>[–º3šVÓš€°(€€€€´]½É­™±½ß¾òiq€‘í™¥±•¹…µ”ñğ€Õ¹­¹½İ¸õq€°(€€€€´ƒ¦‚CšršNß–>[š^—šr¾òh‘í•áÁ•Ñ•‘…Ñ”€üq€‘í•áÁ•Ñ•‘…Ñ•õq€€è€ƒšr«–×šâ³–"Ãšb;Šëš^—šr}€õ€°(€€€€´ƒ–¾›¦jo¢ÎšZgš^—šr¾òh‘í…ÑÕ…±…Ñ”€üq€‘í…ÑÕ…±…Ñ•õq€€è€ƒšr«–×šâ³–"Ãšb;Šëš^—šr}€õ€°(€tì(€¥˜€¡½Õ¹ÑÌ¤ì(€€€±¥¹•Ì¹ÁÕÍ ¡€´ƒ¦‚Cšr¶šVã¾òh‘í½Õ¹ÑÌ¹Ñ½Ñ…±õ€¤ì(€€€±¥¹•Ì¹ÁÕÍ ¡€´ƒš"C–*¶šVã¾òh‘í½Õ¹ÑÌ¹ÍÕ•ÍÍõ€¤ì(€€€±¥¹•Ì¹ÁÕÍ ¡€´ƒòë–ÂG¶šVã¾òh‘í5…Ñ ¹µ…à À°½Õ¹ÑÌ¹Ñ½Ñ…°€´½Õ¹ÑÌ¹ÍÕ•ÍÌ¥õ€¤ì(€ô(€±¥¹•Ì¹ÁÕÍ ¡€´ƒšNß–>[ÖCšzs¾òh¨¨‘íÉ•ÍÕ±Ğ¹±…‰•±ô¨©€¤ì(€±¥¹•Ì¹ÁÕÍ ¡€´ƒ–:–nƒ¾òh‘íÉ•ÍÕ±Ğ¹É•…Í½¹õ€¤ì(€¥˜€ …É•ÍÕ±Ğ¹½¬¤±¥¹•Ì¹ÁÕÍ  œ´ƒ.š/¾òh¨«Ò#¢ÎšZgšr«–º3šVÓŠë¢ª7–&7¾ò3’â7¢š[
ëš"C–*¨¨œ¤ì(€•±Í”±¥¹•Ì¹ÁÕÍ  œ´ƒ.š/¾òh¨«Úƒ#–ŞË¦k¦;šr³š²„İ½É­™±½Üƒj–º3šVÓšŸ–"“šZß¨¨œ¤ì(€¥˜€¡©½‰Ìü¹±•¹Ñ ¤ì(€€€½¹ÍĞ™…¥±•€ô©½‰Ì¹™¥±Ñ•È ¡©½ˆ¤€ôø€…lÍÕ•ÍÌœ°€Í­¥ÁÁ•t¹¥¹±Õ‘•Ì¡©½ˆ¹½¹±ÕÍ¥½¸¤¤ì(€€€¥˜€¡™…¥±•¹±•¹Ñ ¤±¥¹•Ì¹ÁÕÍ ¡€´ƒ–’ÇšV\©½‰Ï¾òh‘í™…¥±•¹µ…À ¡©½ˆ¤€ôøq€‘í©½ˆ¹¹…µ•õq€¤¹©½¥¸ Ÿœ¥õ€¤ì(€ô(€É•ÑÕÉ¸±¥¹•Ìì)ô()™Õ¹Ñ¥½¸Í•±™Q•ÍĞ ¤ì(€½¹ÍĞÉ•…Ñ•€ô¹•Ü…Ñ” œÈÀÈØ´Àà´ÈİPÄØèÔÀèĞÙhœ¤ì(€½¹ÍĞ½ÕÉÉ•¹”€ôÁÉ•Ù¥½ÕÍ=ÕÉÉ•¹” œÔÈ€Ô€¨€¨€¨œ°É•…Ñ•¤ì(€¥˜€¡½ÕÉÉ•¹”¹Ñ½%M=MÑÉ¥¹œ ¤€„ôô€œÈÀÈØ´Àà´ÈİPÀÔèÔÈèÀÀ¸ÀÀÁhœ¤Ñ¡É½Ü¹•ÜÉÉ½È ‘…¥±äÉ½¸Í•±˜µÑ•ÍĞ™…¥±•œ¤ì(€¥˜€ …™½Éµ…ÑQ…¥Á•¤¡½ÕÉÉ•¹”¤¹ÍÑ…ÉÑÍ]¥Ñ  œÈÀÈØ´Àà´ÈÜ€ÄÌèÔÈœ¤¤Ñ¡É½Ü¹•ÜÉÉ½È Q…¥Á•¤™½Éµ…ÑÑ¥¹œÍ•±˜µÑ•ÍĞ™…¥±•œ¤ì(€½¹ÍĞİ••­±ä€ôÁÉ•Ù¥½ÕÍ=ÕÉÉ•¹” œÈÈ€À€¨€¨€Ä´Ôœ°¹•Ü…Ñ” œÈÀÈØ´Àà´ÈáPÄÄèÌÀèÀÁhœ¤¤ì(€¥˜€¡İ••­±ä¹Ñ½%M=MÑÉ¥¹œ ¤€„ôô€œÈÀÈØ´Àà´ÈáPÀÀèÈÈèÀÀ¸ÀÀÁhœ¤Ñ¡É½Ü¹•ÜÉÉ½È İ••­‘…äÉ½¸Í•±˜µÑ•ÍĞ™…¥±•œ¤ì(€½¹ÍĞ‘…Ñ•Ì€ô•áÑÉ…Ñ…Ñ•Ì Ñ…É•Ñ}‘…Ñ”ôÈÀÈØÀàÈà½™™¥¥…±}±…Ñ•ÍÑ}‘…Ñ”ôÈÀÈØÀàÈÜœ¤ì(€¥˜€¡‘…Ñ•Ì¹•áÁ•Ñ•¹…Ğ ´Ä¤€„ôô€œÈÀÈØÀàÈàœñğ‘…Ñ•Ì¹…ÑÕ…°¹…Ğ ´Ä¤€„ôô€œÈÀÈØÀàÈÜœ¤Ñ¡É½Ü¹•ÜÉÉ½È ‘…Ñ”•áÑÉ…Ñ¥½¸Í•±˜µÑ•ÍĞ™…¥±•œ¤ì(€½¹ÍĞµ¥Íµ…Ñ €ô±…ÍÍ¥™å…Ñ…I•ÍÕ±Ğ¡ì…±±MÕ••‘•è™…±Í”°Ñ•áĞè€œœ°•áÁ•Ñ•‘…Ñ”è€œÈÀÈØÀàÈàœ°…ÑÕ…±…Ñ”è€œÈÀÈØÀàÈÜœ°½Õ¹ÑÌè¹Õ±°ô¤ì(€¥˜€¡µ¥Íµ…Ñ ¹½‘”€„ôô€‘…Ñ…}¹½Ñ}ÕÁ‘…Ñ•œ¤Ñ¡É½Ü¹•ÜÉÉ½È ‘…Ñ”µ¥Íµ…Ñ ±…ÍÍ¥™¥…Ñ¥½¸Í•±˜µÑ•ÍĞ™…¥±•œ¤ì(€½¹ÍĞÁ…ÉÑ¥…°€ô±…ÍÍ¥™å…Ñ…I•ÍÕ±Ğ¡ì…±±MÕ••‘•è™…±Í”°Ñ•áĞè€Ÿ–º3š"@€ÄÈÀÀ€¼ƒâ÷šVà€ÄÌÌÀœ°•áÁ•Ñ•‘…Ñ”è€œÈÀÈØÀàÈàœ°…ÑÕ…±…Ñ”è€œÈÀÈØÀàÈàœ°½Õ¹ÑÌèìÍÕ•ÍÌè€ÄÈÀÀ°Ñ½Ñ…°è€ÄÌÌÀôô¤ì(€¥˜€¡Á…ÉÑ¥…°¹½‘”€„ôô€Á…ÉÑ¥…±}‘…Ñ„œ¤Ñ¡É½Ü¹•ÜÉÉ½È Á…ÉÑ¥…°±…ÍÍ¥™¥…Ñ¥½¸Í•±˜µÑ•ÍĞ™…¥±•œ¤ì(€½¹ÍĞÍ•ÉÙ•È€ô±…ÍÍ¥™å…Ñ…I•ÍÕ±Ğ¡ì…±±MÕ••‘•è™…±Í”°Ñ•áĞè€!QQ@€ĞÈäQ½¼5…¹äI•ÅÕ•ÍÑÌœ°•áÁ•Ñ•‘…Ñ”è€œœ°…ÑÕ…±…Ñ”è€œœ°½Õ¹ÑÌè¹Õ±°ô¤ì(€¥˜€¡Í•ÉÙ•È¹½‘”€„ôô€Í•ÉÙ•É}Õ¹…Ù…¥±…‰±”œ¤Ñ¡É½Ü¹•ÜÉÉ½È Í•ÉÙ•È±…ÍÍ¥™¥…Ñ¥½¸Í•±˜µÑ•ÍĞ™…¥±•œ¤ì(€½¹Í½±”¹±½œ İÉ¥Ñ•}İ½É­™±½İ}Í¡•‘Õ±•}ÍÕµµ…ÉäÍ•±˜µÑ•ÍĞÁ…ÍÍ•œ¤ì)ô()…Íå¹Œ™Õ¹Ñ¥½¸µ…¥¸ ¤ì(€¥˜€¡ÁÉ½•ÍÌ¹…ÉØ¹¥¹±Õ‘•Ì œ´µÍ•±˜µÑ•ÍĞœ¤¤É•ÑÕÉ¸Í•±™Q•ÍĞ ¤ì((€½¹ÍĞ•Ù•¹Ğ€ôÉ•…‘Ù•¹Ğ ¤ì(€½¹ÍĞÉÕ¸€ô…İ…¥Ğ™•Ñ¡IÕ¸ ¤¹…Ñ   ¤€ôø¹Õ±°¤ì(€½¹ÍĞÉ•…Ñ•‘Ğ€ôÉÕ¸ü¹É•…Ñ•‘}…Ğ€ü¹•Ü…Ñ”¡ÉÕ¸¹É•…Ñ•‘}…Ğ¤€è¹•Ü…Ñ” ¤ì((€¥˜€¡ÁÉ½•ÍÌ¹•¹Ø¹%Q!U	}Y9Q}95€„ôô€Í¡•‘Õ±”œ¤ì(€€€…ÁÁ•¹‘MÕµµ…Éä¡l(€€€€€€œŒŒƒš:K¢/šf¦ZLœ°(€€€€€€œ´ƒ–:–ºkš:K¢/šf¦ZO¾ò#–>Ã–2_šf¦ZO¾ò'¾òk¦v{š:K¢/¢ãfğœ°(€€€€€€´ƒ–¾›¦jo¦Z/–/šf¦ZO¾ò#–>Ã–2_šf¦ZO¾ò'¾òh‘í™½Éµ…ÑQ…¥Á•¤¡É•…Ñ•‘Ğ¥õ€°(€€€€€€œ´¥Ñ!Õˆƒš:K¢/–îÛ¦Ë¾òk’â7¦§R œ°(€€€t¤ì(€ô•±Í”ì(€€€½¹ÍĞÍ¡•‘Õ±”€ôMÑÉ¥¹œ¡•Ù•¹Ğ¹Í¡•‘Õ±”ñğ€œœ¤ì(€€€ÑÉäì(€€€€€¥˜€ …Í¡•‘Õ±”¤Ñ¡É½Ü¹•ÜÉÉ½È M¡•‘Õ±”•Ù•¹Ğ¥Ìµ¥ÍÍ¥¹œ¥Ñ¡Õˆ¹•Ù•¹Ğ¹Í¡•‘Õ±”œ¤ì(€€€€€½¹ÍĞ¥¹Ñ•¹‘•‘Ğ€ôÁÉ•Ù¥½ÕÍ=ÕÉÉ•¹”¡Í¡•‘Õ±”°É•…Ñ•‘Ğ¤ì(€€€€€½¹ÍĞ‘•±…å5¥¹ÕÑ•Ì€ô5…Ñ ¹µ…à À°5…Ñ ¹™±½½È ¡É•…Ñ•‘Ğ¹•ÑQ¥µ” ¤€´¥¹Ñ•¹‘•‘Ğ¹•ÑQ¥µ” ¤¤€¼5%9UQ}5L¤¤ì(€€€€€…ÁÁ•¹‘MÕµµ…Éä¡l(€€€€€€€€œŒŒƒš:K¢/šf¦ZLœ°(€€€€€€€€´ƒ–:–ºkš:K¢/šf¦ZO¾ò#–>Ã–2_šf¦ZO¾ò'¾òh‘í™½Éµ…ÑQ…¥Á•¤¡¥¹Ñ•¹‘•‘Ğ¥õ€°(€€€€€€€€´ƒ–¾§¦jo¦Z/–/šf¦ZO¾ò#–>Ã–2_šf¦ZO¾ò'¾òh‘í™½Éµ…ÑQ…¥Á•¤¡É•…Ñ•‘Ğ¥õ€°(€€€€€€€€´¥Ñ!Õˆƒš:K¢/–îÛ¦Ë¾òkÒ€‘í‘•±…å5¥¹ÕÑ•Íôƒ–"¦Ba€°(€€€€€t¤ì(€€€ô…Ñ €¡•ÉÉ½È¤ì(€€€€€…ÁÁ•¹‘MÕµµ…Éä¡l(€€€€€€€€œŒŒƒš:K¢/šf¦ZLœ°(€€€€€€€€œ´ƒ–:–ºkš:K¢/šf¦ZO¾ò#–>Ã–2_šf¦ZO¾ò'¾òk‡šÎW–"“–ºhœ°(€€€€€€€€´ƒ–¾›¦jo¦Z/–/šf¦ZO¾ò#–>Ã–2_šf¦ZO¾ò'¾òh‘í™½Éµ…ÑQ…¥Á•¤¡É•…Ñ•‘Ğ¥õ€°(€€€€€€€€´¥Ñ!Õˆƒš:K¢/–îÛ¦Ë¾òk‡šÎW¢¢#º_¾ò ‘íMÑÉ¥¹œ¡•ÉÉ½È¹µ•ÍÍ…”ñğ•ÉÉ½È¥÷¾ò%€°(€€€€€t¤ì(€€€ô(€ô((€½¹ÍĞ™¥±•¹…µ”€ôİ½É­™±½İ¥±•¹…µ” ¤ì(€¥˜€ …¥Í…Ñ…]½É­™±½Ü¡™¥±•¹…µ”¤¤É•ÑÕÉ¸ì((€½¹ÍĞ©½‰ÍA…å±½…€ô…İ…¥Ğİ…¥Ñ½É5…¥¹)½‰Ì ¤¹…Ñ  ¡•ÉÉ½È¤€ôø€¡ì€¸¸¸¡•ÉÉ½È¹±…ÍÑA…å±½…ñğì©½‰Ìèmtô¤°}•ÉÉ½Èè•ÉÉ½Èô¤¤ì(€½¹ÍĞ½¹Ñ•áĞ€ôÍÕµµ…É¥é•)½‰½¹Ñ•áĞ¡©½‰ÍA…å±½…¤ì(€½¹ÍĞ©½‰1½Ì€ô…İ…¥Ğ½±±•Ñ)½‰1½Ì¡½¹Ñ•áĞ¹µ…¥¹)½‰Ì¤ì(€½¹ÍĞ½µ‰¥¹•‘Q•áĞ€ô€‘í½¹Ñ•áĞ¹Ñ•áÑõq¸‘í©½‰1½Íõq¸‘í)M=8¹ÍÑÉ¥¹¥™ä¡•Ù•¹Ğ¥õ€ì(€½¹ÍĞ‘…Ñ•Ì€ô•áÑÉ…Ñ…Ñ•Ì¡½µ‰¥¹•‘Q•áĞ¤ì(€½¹ÍĞ•áÁ•Ñ•‘…Ñ”€ô‘…Ñ•Ì¹•áÁ•Ñ•¹…Ğ ´Ä¤ñğ•Ù•¹Ñ…Ñ•!¥¹ÑÌ¡•Ù•¹Ğ¤¹…Ğ ´Ä¤ñğ€œœì(€½¹ÍĞ…ÑÕ…±…Ñ”€ô‘…Ñ•Ì¹…ÑÕ…°¹…Ğ ´Ä¤ñğ€œœì(€½¹ÍĞ½Õ¹ÑÌ€ô•áÑÉ…Ñ½Õ¹ÑÌ¡½µ‰¥¹•‘Q•áĞ¤ì(€½¹ÍĞÉ•ÍÕ±Ğ€ô±…ÍÍ¥™å…Ñ…I•ÍÕ±Ğ¡ì…±±MÕ••‘•è½¹Ñ•áĞ¹…±±MÕ••‘•°Ñ•áĞè½µ‰¥¹•‘Q•áĞ°•áÁ•Ñ•‘…Ñ”°…ÑÕ…±…Ñ”°½Õ¹ÑÌô¤ì(€¥˜€¡©½‰ÍA…å±½…¹}•ÉÉ½È€˜˜€…½¹Ñ•áĞ¹µ…¥¹)½‰Ì¹±•¹Ñ ¤ì(€€€É•ÍÕ±Ğ¹½¬€ô™…±Í”ì(€€€É•ÍÕ±Ğ¹½‘”€ô€½Ñ¡•É}™…¥±ÕÉ”œì(€€€É•ÍÕ±Ğ¹±…‰•°€ô€Ÿ‡šÎWŠë¢ª7¢ÎšZg–º3šVÓšœœì(€€€É•ÍÕ±Ğ¹É•…Í½¸€ôƒ‡šÎW¢º–>[šr³š²„ÉÕ¸ƒj©½ˆƒ.š/¾òh‘í©½‰ÍA…å±½…¹}•ÉÉ½È¹µ•ÍÍ…”ñğ©½‰ÍA…å±½…¹}•ÉÉ½Éõ€ì(€ô(€…ÁÁ•¹‘MÕµµ…Éä¡lœœ°€¸¸¹É•¹‘•É…Ñ…MÕµµ…Éä¡ì™¥±•¹…µ”°É•ÍÕ±Ğ°•áÁ•Ñ•‘…Ñ”°…ÑÕ…±…Ñ”°½Õ¹ÑÌ°©½‰Ìè½¹Ñ•áĞ¹µ…¥¹)½‰Ìô¥t¤ì(€¥˜€ …É•ÍÕ±Ğ¹½¬¤ÁÉ½•ÍÌ¹•á¥Ñ½‘”€ô€Äì)ô()µ…¥¸ ¤¹…Ñ  ¡•ÉÉ½È¤€ôøì(€…ÁÁ•¹‘MÕµµ…Éä¡l(€€€€œŒŒƒÂ~RĞ]½É­™±½ÜMÕµµ…ÉäƒR‹R–’ÇšV\œ°(€€€€´ƒ–:–nƒ¾òh‘íMÑÉ¥¹œ¡•ÉÉ½È¹µ•ÍÍ…”ñğ•ÉÉ½È¥õ€°(€€€€œ´ƒ.š/¾òkÒ#¾òo‡šÎWŠë¢ª7¢ÎšZg–º3šVÓšŸœ°(€t¤ì(€ÁÉ½•ÍÌ¹•á¥Ñ½‘”€ô€Äì)ô¤ì()µ½‘Õ±”¹•áÁ½ÉÑÌ€ôì(€Á…ÉÍ•É½¸°(€É½¹5…Ñ¡•Ì°(€ÁÉ•Ù¥½ÕÍ=ÕÉÉ•¹”°(€™½Éµ…ÑQ…¥Á•¤°(€¥Í…Ñ…]½É­™±½Ü°(€•áÑÉ…Ñ…Ñ•Ì°(€•áÑÉ…Ñ½Õ¹ÑÌ°(€±…ÍÍ¥™å…Ñ…I•ÍÕ±Ğ°)ôì(