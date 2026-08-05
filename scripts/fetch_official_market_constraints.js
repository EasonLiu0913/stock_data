#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const {
  ROOT,
  TWSE_DISPOSITION_URL,
  TPEX_DISPOSITION_URL,
  compactDate,
  buildDispositionSnapshot,
  fetchJson,
} = require('./official_market_constraints');
const { fetchOfficialTaifexNightFuture } = require('./taifex_official_night_futures');
const { finalizeNight } = require('./finalize_prediction_market_context');

function normalizeDispositionSnapshot(snapshot) {
  const activeCodes = [...new Set((snapshot?.active_stock_codes || [])
    .map((value) => String(value).trim())
    .filter((value) => /^\d{4}$/.test(value)))].sort();
  const activeStockRecordCount = (snapshot?.active_records || [])
    .filter((row) => /^\d{4}$/.test(String(row?.code || '').trim())).length;
  return {
    ...snapshot,
    active_stock_record_count: activeStockRecordCount,
    active_stock_count: activeCodes.length,
    active_stock_codes: activeCodes,
  };
}

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
}

function atomicWriteJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const temporary = `${file}.tmp-${process.pid}-${Date.now()}`;
  fs.writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  fs.renameSync(temporary, file);
}

function isReusableSnapshot(snapshot, date) {
  return snapshot?.target_date === date
    && snapshot?.disposition?.complete_market_coverage === true
    && snapshot?.night_futures?.available === true;
}

function stagePredictionContext(date) {
  if (process.env.GITHUB_ACTIONS !== 'true') return;
  const contextDir = path.join('data_prediction_context', date);
  if (!fs.existsSync(path.join(ROOT, contextDir))) return;
  const result = spawnSync('git', ['add', contextDir], { cwd: ROOT, encoding: 'utf8' });
  if (result.status !== 0) {
    throw new Error(`Unable to stage final prediction market context: ${result.stderr || result.stdout}`);
  }
}

function preserveOfficialNightContext(date, nightFile, normalizedNight) {
  if (normalizedNight?.available !== true) return null;
  const latestFile = path.join(ROOT, 'data_prediction_context', date, 'latest.json');
  if (!fs.existsSync(latestFile)) return null;
  const result = finalizeNight({
    forecastDate: date,
    nightFile: path.relative(ROOT, nightFile).replaceAll(path.sep, '/'),
    nightKind: 'official',
  });
  stagePredictionContext(date);
  return result;
}

async function fetchOfficialMarketConstraints({ date, force = false } = {}) {
  const target = compactDate(date);
  if (!target) throw new Error('date must be YYYYMMDD');
  const outputDir = path.join(ROOT, 'data_market_constraints', target);
  const snapshotFile = path.join(outputDir, 'snapshot.json');
  const dispositionFile = path.join(outputDir, 'disposition.json');
  const nightFile = path.join(outputDir, 'night-futures.json');
  const existing = readJson(snapshotFile);
  const existingDisposition = readJson(dispositionFile);
  const existingNight = readJson(nightFile);
  if (!force && isReusableSnapshot(existing, target)) {
    preserveOfficialNightContext(target, nightFile, existingNight);
    return { ...existing, reused: true };
  }

  const [twse, tpex, nightFutures] = await Promise.all([
    fetchJson(TWSE_DISPOSITION_URL, { timeoutMs: 45000, retries: 3 }),
    fetchJson(TPEX_DISPOSITION_URL, { timeoutMs: 45000, retries: 3 }),
    fetchOfficialTaifexNightFuture(target),
  ]);
  let disposition = normalizeDispositionSnapshot(buildDispositionSnapshot({
    date: target,
    twseRows: twse.data,
    tpexRows: tpex.data,
    sourceStatus: {
      twse: {
        ok: twse.ok,
        status: twse.status,
        fetched_at: twse.fetched_at || null,
        error: twse.error || null,
        url: TWSE_DISPOSITION_URL,
      },
      tpex: {
        ok: tpex.ok,
        status: tpex.status,
        fetched_at: tpex.fetched_at || null,
        error: tpex.error || null,
        url: TPEX_DISPOSITION_URL,
      },
    },
  }));
  if (disposition.complete_market_coverage !== true
    && existingDisposition?.target_date === target
    && existingDisposition?.complete_market_coverage === true) {
    disposition = existingDisposition;
  }
  let normalizedNight = {
    ...nightFutures,
    generated_at: nightFutures.generated_at || new Date().toISOString(),
  };
  if (normalizedNight.available !== true
    && existingNight?.target_date === target
    && existingNight?.available === true) {
    normalizedNight = existingNight;
  }
  const generatedAt = new Date().toISOString();
  disposition.generated_at = disposition.generated_at || generatedAt;
  disposition.source_files = disposition.source_files || {
    twse: TWSE_DISPOSITION_URL,
    tpex: TPEX_DISPOSITION_URL,
  };
  const complete = disposition.complete_market_coverage === true && normalizedNight.available === true;
  const snapshot = {
    schema_version: 1,
    target_date: target,
    generated_at: generatedAt,
    calculation_status: complete ? 'completed' : 'partial',
    complete,
    disposition: {
      complete_market_coverage: disposition.complete_market_coverage,
      active_record_count: disposition.active_record_count,
      active_stock_record_count: disposition.active_stock_record_count,
      active_stock_count: disposition.active_stock_count,
      source_file: path.relative(ROOT, dispositionFile).replaceAll(path.sep, '/'),
    },
    night_futures: {
      available: normalizedNight.available === true,
      change_percent: normalizedNight.change_percent ?? null,
      selected_contract_month: normalizedNight.selected_contract_month || null,
      source_file: path.relative(ROOT, nightFile).replaceAll(path.sep, '/'),
    },
    warnings: [
      ...(disposition.warnings || []),
      ...(normalizedNight.available ? [] : [normalizedNight.warning || '台指期夜盤資料尚未可用。']),
    ],
  };

  atomicWriteJson(dispositionFile, disposition);
  atomicWriteJson(nightFile, normalizedNight);
  atomicWriteJson(snapshotFile, snapshot);
  preserveOfficialNightContext(target, nightFile, normalizedNight);
  return snapshot;
}

function parseArgs(argv) {
  const options = { date: '', force: false, allowPartial: false };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--date') options.date = argv[++index] || '';
    else if (arg === '--force') options.force = true;
    else if (arg === '--allow-partial') options.allowPartial = true;
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return options;
}

async function main(argv = process.argv.slice(2)) {
  const options = parseArgs(argv);
  const result = await fetchOfficialMarketConstraints(options);
  console.log(JSON.stringify(result));
  if (!options.allowPartial && result.complete !== true) process.exitCode = 2;
  return result;
}

if (require.main === module) {
  main().catch((error) => {
    console.error(`Error: ${error.stack || error.message}`);
    process.exitCode = 1;
  });
}

module.exports = {
  normalizeDispositionSnapshot,
  isReusableSnapshot,
  stagePredictionContext,
  preserveOfficialNightContext,
  fetchOfficialMarketConstraints,
  main,
};
