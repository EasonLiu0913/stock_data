#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const FUBON_DIR = path.join(ROOT, 'data_fubon');
const PREDICTION_DIR = path.join(ROOT, 'data_predictions');
const TWT48U_FILE = path.join(ROOT, 'data_twse_twt48u', 'result.json');
const WINDOW_SIZE = 5;

function readJson(file, fallback = null) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return fallback;
  }
}

function writeJsonAtomic(file, payload) {
  const temporary = `${file}.tmp-${process.pid}`;
  fs.writeFileSync(temporary, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  fs.renameSync(temporary, file);
}

function compactDate(value) {
  const normalized = String(value || '').replace(/[^0-9]/g, '');
  return /^20\d{6}$/.test(normalized) ? normalized : '';
}

function slashDate(value) {
  const date = compactDate(value);
  return `${date.slice(0, 4)}/${date.slice(4, 6)}/${date.slice(6, 8)}`;
}

function isoDate(value) {
  const date = compactDate(value);
  return `${date.slice(0, 4)}-${date.slice(4, 6)}-${date.slice(6, 8)}`;
}

function finiteNumber(value) {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(String(value).replaceAll(',', '').trim());
  return Number.isFinite(parsed) ? parsed : null;
}

function round(value, digits = 2) {
  return Number.isFinite(value) ? Number(value.toFixed(digits)) : null;
}

function parseArgs(argv) {
  const options = { date: '', dryRun: false };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--date') options.date = argv[++index] || '';
    else if (arg === '--dry-run') options.dryRun = true;
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return options;
}

function availableFubonDates(workspaceRoot = ROOT) {
  const directory = path.join(workspaceRoot, 'data_fubon');
  if (!fs.existsSync(directory)) return [];
  return fs.readdirSync(directory)
    .filter(file => /^fubon_20\d{6}_sma\.json$/.test(file))
    .map(file => file.slice(6, 14))
    .sort();
}

function fiveDayWindow(predictionDate, workspaceRoot = ROOT) {
  return availableFubonDates(workspaceRoot)
    .filter(date => date >= compactDate(predictionDate))
    .slice(0, WINDOW_SIZE);
}

function parseFubonRow(item, date) {
  const row = item?.[slashDate(date)] || item?.[isoDate(date)];
  if (!row) return null;
  return {
    high: finiteNumber(row.High),
    close: finiteNumber(row.Price ?? row.Close),
  };
}

function loadWindowSnapshots(dates, workspaceRoot = ROOT) {
  return new Map(dates.map(date => {
    const file = path.join(workspaceRoot, 'data_fubon', `fubon_${date}_sma.json`);
    const payload = readJson(file, null);
    if (!payload) throw new Error(`Missing five-day price source: ${path.relative(workspaceRoot, file)}`);
    return [date, payload];
  }));
}

function fieldIndex(fields, candidates) {
  return (fields || []).findIndex(field => candidates.some(candidate => String(field || '').includes(candidate)));
}

function rocDateToCompact(value) {
  const match = String(value || '').match(/(\d+)年(\d+)月(\d+)日/);
  if (!match) return compactDate(value);
  return `${Number(match[1]) + 1911}${String(match[2]).padStart(2, '0')}${String(match[3]).padStart(2, '0')}`;
}

function corporateActionDates(workspaceRoot = ROOT) {
  const sourceFile = path.join(workspaceRoot, 'data_twse_twt48u', 'result.json');
  const payload = readJson(sourceFile, null);
  const result = new Map();
  if (!payload) return { status: 'unavailable', byCode: result, sourceFile: null };
  const fields = payload.fields || [];
  const dateIndex = fieldIndex(fields, ['除權除息日期']);
  const codeIndex = fieldIndex(fields, ['股票代號', '證券代號']);
  if (dateIndex < 0 || codeIndex < 0) return { status: 'unavailable', byCode: result, sourceFile };
  for (const row of payload.data || []) {
    const code = String(row[codeIndex] || '').trim();
    const date = rocDateToCompact(row[dateIndex]);
    if (!code || !date) continue;
    if (!result.has(code)) result.set(code, new Set());
    result.get(code).add(date);
  }
  return { status: 'completed', byCode: result, sourceFile };
}

function outcomeForStock({ code, referencePrice, dates, snapshots, actions }) {
  if (!Number.isFinite(referencePrice) || referencePrice <= 0) {
    return {
      status: 'reference_price_unavailable',
      max_return_5d: null,
      max_return_5d_date: null,
      max_return_5d_price: null,
      observed_dates: [],
    };
  }
  const laterActionDate = dates.slice(1).find(date => actions.byCode.get(String(code))?.has(date));
  if (laterActionDate) {
    return {
      status: 'corporate_action_in_window',
      max_return_5d: null,
      max_return_5d_date: null,
      max_return_5d_price: null,
      observed_dates: dates,
      corporate_action_date: laterActionDate,
    };
  }
  const observations = dates.map(date => {
    const row = parseFubonRow(snapshots.get(date)?.[String(code)], date);
    return Number.isFinite(row?.high) ? { date, high: row.high } : null;
  }).filter(Boolean);
  if (observations.length !== WINDOW_SIZE) {
    return {
      status: 'incomplete_stock_price_window',
      max_return_5d: null,
      max_return_5d_date: null,
      max_return_5d_price: null,
      observed_dates: observations.map(item => item.date),
    };
  }
  const peak = observations.reduce((best, item) => item.high > best.high ? item : best);
  return {
    status: actions.status === 'completed' ? 'completed' : 'completed_corporate_action_check_unavailable',
    max_return_5d: round((peak.high / referencePrice - 1) * 100),
    max_return_5d_date: peak.date,
    max_return_5d_price: round(peak.high),
    observed_dates: observations.map(item => item.date),
  };
}

function stableJson(payload) {
  return JSON.stringify(payload);
}

function withoutOutcomeUpdatedAt(payload) {
  if (!payload?.five_day_intraday_outcome) return payload;
  return {
    ...payload,
    five_day_intraday_outcome: {
      ...payload.five_day_intraday_outcome,
      updated_at: null,
    },
  };
}

function backfillFiveDayOutcomes(predictionDate, options = {}) {
  const workspaceRoot = path.resolve(options.workspaceRoot || ROOT);
  const date = compactDate(predictionDate);
  if (!date) throw new Error(`Invalid prediction date: ${predictionDate}`);
  const dates = fiveDayWindow(date, workspaceRoot);
  if (dates.length < WINDOW_SIZE || dates[0] !== date) {
    return {
      prediction_date: date,
      status: 'pending_five_trading_days',
      required_days: WINDOW_SIZE,
      available_window_dates: dates,
      changed: false,
      dry_run: Boolean(options.dryRun),
    };
  }

  const predictionDir = path.join(workspaceRoot, 'data_predictions', date);
  const replayFile = path.join(predictionDir, 'replay.json');
  const dashboardFile = path.join(predictionDir, 'replay-dashboard.json');
  const summaryFile = path.join(predictionDir, 'replay-summary.json');
  const replay = readJson(replayFile, null);
  const dashboard = readJson(dashboardFile, null);
  const summary = readJson(summaryFile, null);
  if (!replay || !Array.isArray(replay.rows)) throw new Error(`Missing replay rows: ${path.relative(workspaceRoot, replayFile)}`);
  if (!dashboard || !Array.isArray(dashboard.rows)) throw new Error(`Missing replay dashboard: ${path.relative(workspaceRoot, dashboardFile)}`);
  if (!summary) throw new Error(`Missing replay summary: ${path.relative(workspaceRoot, summaryFile)}`);

  const snapshots = loadWindowSnapshots(dates, workspaceRoot);
  const actions = corporateActionDates(workspaceRoot);
  const outcomes = new Map();
  for (const row of replay.rows) {
    const code = String(row.stock_code || '');
    outcomes.set(code, outcomeForStock({
      code,
      referencePrice: finiteNumber(row.actual?.official_or_adjusted_reference_price),
      dates,
      snapshots,
      actions,
    }));
  }

  const applyOutcome = row => {
    const outcome = outcomes.get(String(row.stock_code || '')) || {
      status: 'replay_row_unavailable',
      max_return_5d: null,
      max_return_5d_date: null,
      max_return_5d_price: null,
      observed_dates: [],
    };
    return {
      ...row,
      actual: row.actual ? {
        ...row.actual,
        max_return_5d: outcome.max_return_5d,
        max_return_5d_date: outcome.max_return_5d_date,
        max_return_5d_price: outcome.max_return_5d_price,
        max_return_5d_status: outcome.status,
        max_return_5d_observed_dates: outcome.observed_dates,
        max_return_5d_corporate_action_date: outcome.corporate_action_date || null,
      } : row.actual,
    };
  };
  const outcomeRows = [...outcomes.values()];
  const completedRows = outcomeRows.filter(item => item.status.startsWith('completed'));
  const commonMetadata = {
    window_size: WINDOW_SIZE,
    window_dates: dates,
    corporate_action_check_status: actions.status,
    corporate_action_source_file: actions.sourceFile
      ? path.relative(workspaceRoot, actions.sourceFile).replaceAll(path.sep, '/')
      : null,
  };
  const existingUpdatedAt = replay.five_day_intraday_outcome?.updated_at
    || dashboard.five_day_intraday_outcome?.updated_at
    || summary.five_day_intraday_outcome?.updated_at
    || null;
  const buildPayloads = updatedAt => {
    const metadata = { ...commonMetadata, updated_at: updatedAt };
    const nextReplay = {
      ...replay,
      five_day_intraday_outcome: metadata,
      rows: replay.rows.map(applyOutcome),
    };
    const nextDashboard = {
      ...dashboard,
      five_day_intraday_outcome: metadata,
      rows: dashboard.rows.map(applyOutcome),
    };
    const hitCount = completedRows.filter(item => item.max_return_5d >= 10).length;
    const nextSummary = {
      ...summary,
      five_day_intraday_outcome: {
        ...metadata,
        total_count: outcomeRows.length,
        completed_count: completedRows.length,
        unavailable_count: outcomeRows.length - completedRows.length,
        hit_10pct_count: hitCount,
        hit_10pct_rate: round(completedRows.length ? hitCount / completedRows.length * 100 : null),
        unavailable_by_status: Object.fromEntries([...new Set(outcomeRows
          .filter(item => !item.status.startsWith('completed'))
          .map(item => item.status))].map(status => [status, outcomeRows.filter(item => item.status === status).length])),
      },
    };
    return { nextReplay, nextDashboard, nextSummary };
  };

  const provisional = buildPayloads(existingUpdatedAt);
  const contentChanged = stableJson(withoutOutcomeUpdatedAt(replay)) !== stableJson(withoutOutcomeUpdatedAt(provisional.nextReplay))
    || stableJson(withoutOutcomeUpdatedAt(dashboard)) !== stableJson(withoutOutcomeUpdatedAt(provisional.nextDashboard))
    || stableJson(withoutOutcomeUpdatedAt(summary)) !== stableJson(withoutOutcomeUpdatedAt(provisional.nextSummary));
  const updatedAt = contentChanged || !existingUpdatedAt ? new Date().toISOString() : existingUpdatedAt;
  const { nextReplay, nextDashboard, nextSummary } = buildPayloads(updatedAt);
  const changed = stableJson(replay) !== stableJson(nextReplay)
    || stableJson(dashboard) !== stableJson(nextDashboard)
    || stableJson(summary) !== stableJson(nextSummary);
  if (changed && !options.dryRun) {
    writeJsonAtomic(replayFile, nextReplay);
    writeJsonAtomic(dashboardFile, nextDashboard);
    writeJsonAtomic(summaryFile, nextSummary);
  }
  return {
    prediction_date: date,
    status: 'completed',
    window_dates: dates,
    completed_count: completedRows.length,
    unavailable_count: outcomeRows.length - completedRows.length,
    hit_10pct_count: nextSummary.five_day_intraday_outcome.hit_10pct_count,
    changed,
    dry_run: Boolean(options.dryRun),
    files: [replayFile, dashboardFile, summaryFile]
      .map(file => path.relative(workspaceRoot, file).replaceAll(path.sep, '/')),
  };
}

function main(argv = process.argv.slice(2)) {
  const options = parseArgs(argv);
  if (!options.date) throw new Error('Provide --date YYYYMMDD');
  const result = backfillFiveDayOutcomes(options.date, options);
  console.log(JSON.stringify(result, null, 2));
  return result;
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error(error?.stack || error);
    process.exitCode = 1;
  }
}

module.exports = {
  ROOT,
  FUBON_DIR,
  PREDICTION_DIR,
  TWT48U_FILE,
  WINDOW_SIZE,
  readJson,
  writeJsonAtomic,
  compactDate,
  slashDate,
  isoDate,
  finiteNumber,
  round,
  parseArgs,
  availableFubonDates,
  fiveDayWindow,
  parseFubonRow,
  loadWindowSnapshots,
  fieldIndex,
  rocDateToCompact,
  corporateActionDates,
  outcomeForStock,
  stableJson,
  withoutOutcomeUpdatedAt,
  backfillFiveDayOutcomes,
  main,
};
