#!/usr/bin/env node
'use strict';

const https = require('node:https');

const USER_INFO_URL = 'https://api.web.finmindtrade.com/v2/user_info';

function parseArgs(argv) {
  const args = new Map();
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg.startsWith('--')) continue;
    const key = arg.slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith('--')) args.set(key, true);
    else { args.set(key, next); i += 1; }
  }
  return args;
}

function finiteInt(value, fallback, min = 0) {
  const n = Number(value);
  return Number.isInteger(n) && n >= min ? n : fallback;
}

function sleep(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }

function fetchUserInfo(token) {
  return new Promise((resolve, reject) => {
    const req = https.get(USER_INFO_URL, {
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
        'User-Agent': 'stock_data FinMind quota guard',
      },
    }, res => {
      let body = '';
      res.setEncoding('utf8');
      res.on('data', chunk => { body += chunk; });
      res.on('end', () => {
        if (res.statusCode < 200 || res.statusCode >= 300) {
          return reject(new Error(`FinMind user_info HTTP ${res.statusCode}: ${body.slice(0, 500)}`));
        }
        try {
          const data = JSON.parse(body);
          resolve(data);
        } catch (error) {
          reject(new Error(`FinMind user_info invalid JSON: ${error.message}; body=${body.slice(0, 500)}`));
        }
      });
    });
    req.setTimeout(30000, () => req.destroy(new Error('FinMind user_info request timed out')));
    req.on('error', reject);
  });
}

function normalizeUsage(payload) {
  const userCount = Number(payload.user_count);
  const apiRequestLimit = Number(payload.api_request_limit);
  if (!Number.isFinite(userCount) || !Number.isFinite(apiRequestLimit) || apiRequestLimit <= 0) {
    throw new Error(`FinMind user_info missing quota fields: ${JSON.stringify(payload).slice(0, 800)}`);
  }
  return { userCount, apiRequestLimit };
}

async function main(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  const token = String(process.env.FINMIND_API_TOKEN || '').trim();
  if (!token) {
    throw new Error('FINMIND_API_TOKEN is required. Add the registered/verified FinMind API token as a GitHub Actions secret before running this workflow.');
  }

  const configuredCap = finiteInt(args.get('configured-cap'), 500, 1);
  const requiredRequests = finiteInt(args.get('required-requests'), 20, 0);
  const reserveRequests = finiteInt(args.get('reserve-requests'), 20, 0);
  const pollSeconds = finiteInt(args.get('poll-seconds'), 60, 10);
  const maxWaitMinutes = finiteInt(args.get('max-wait-minutes'), 90, 1);
  const wait = String(args.get('wait') || 'false').toLowerCase() === 'true';
  const startedAt = Date.now();

  while (true) {
    const payload = await fetchUserInfo(token);
    const { userCount, apiRequestLimit } = normalizeUsage(payload);
    const safeCap = Math.min(configuredCap, Math.max(0, apiRequestLimit - reserveRequests));
    const remainingToSafeCap = Math.max(0, safeCap - userCount);
    const enough = userCount + requiredRequests <= safeCap;

    const summary = {
      authenticated: true,
      user_count: userCount,
      api_request_limit: apiRequestLimit,
      configured_hourly_cap: configuredCap,
      reserve_requests: reserveRequests,
      effective_safe_cap: safeCap,
      required_requests: requiredRequests,
      remaining_to_safe_cap: remainingToSafeCap,
      enough_for_next_batch: enough,
    };
    console.log(JSON.stringify(summary));

    if (enough) return;
    if (!wait) {
      const error = new Error(`FinMind hourly quota guard blocked next batch: user_count=${userCount}, effective_safe_cap=${safeCap}, required=${requiredRequests}`);
      error.exitCode = 4;
      throw error;
    }

    const waitedMs = Date.now() - startedAt;
    if (waitedMs >= maxWaitMinutes * 60 * 1000) {
      throw new Error(`FinMind quota did not recover within ${maxWaitMinutes} minutes; last user_count=${userCount}, api_request_limit=${apiRequestLimit}, safe_cap=${safeCap}`);
    }

    console.warn(`[quota wait] FinMind usage ${userCount}/${apiRequestLimit}; safe cap=${safeCap}; need ${requiredRequests}; recheck in ${pollSeconds}s`);
    await sleep(pollSeconds * 1000);
  }
}

if (require.main === module) {
  main().catch(error => {
    console.error(error.stack || error.message);
    process.exitCode = error.exitCode || 1;
  });
}

module.exports = { normalizeUsage };
