'use strict';

const fs = require('node:fs');
const path = require('node:path');
const {
  hasTargetDate,
  readEligibleStockUniverse,
  toRocDate,
} = require('./lib/institutional_data_common');
const { getTradingDayStatus } = require('./lib/twse_trading_day');

const SENTINEL_STOCKS = ['1101', '2330', '2317', '2882'];
const MIN_EXPECTED_UNIVERSE = 1000;
const MAX_REFERENCE_DROP_RATIO = 0.10;

function parseArgs(argv) {
  const result = new Map();
  for (let i = 0; i < argv.length; i += 1) {
    const value = argv[i];
    if (!value.startsWith('--')) continue;
    const key = value.slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith('--')) result.set(key, true);
    else { result.set(key, next); i += 1; }
  }
  return result;
}

function formatDate(date) {
  return `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}`;
}

function resolveTargetDate(explicitDate) {
  if (explicitDate) return String(explicitDate);
  const now = new Date();
  const taipei = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Taipei', hour12: false }));
  if (taipei.getHours() < 14) taipei.setDate(taipei.getDate() - 1);
  return formatDate(taipei);
}

function readJson(file, fallback) {
  if (!fs.existsSync(file)) return fallback;
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); }
  catch { return fallback; }
}

function inferReason(item) {
  const explicit = String(item?.reason || item?.skipReason || '').trim();
  if (explicit) return explicit;
  const error = String(item?.error || '');
  if (error.includes('尚未更新') || error.includes('值為 "--"')) return 'DATA_MISSING';
  if (error.includes('非預期日期')) return 'NOT_EXPECTED_DATE';
  if (error.includes('無法人資料')) return 'EMPTY_DATA';
  return 'OTHER_ERROR';
}

function normalizeFailedItem(item) {
  return {
    stock: String(item?.stock || ''),
    error: String(item?.error || '資料尚未完整'),
    reason: inferReason(item),
  };
}

function writeJsonIfChanged(file, value) {
  const content = `${JSON.stringify(value, null, 2)}\n`;
  const previous = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : null;
  if (previous === content) return false;
  fs.writeFileSync(file, content, 'utf8');
  return true;
}

function findPreviousReference(dataDir, targetDateStr, eligibleStocks) {
  const candidates = fs.readdirSync(dataDir)
    .map((file) => {
      const match = file.match(/^fubon_(\d{8})_institutional\.json$/);
      return match ? { file, date: match[1] } : null;
    })
    .filter(Boolean)
    .filter((item) => item.date < targetDateStr)
    .sort((a, b) => b.date.localeCompare(a.date));

  for (const candidate of candidates) {
    const data = readJson(path.join(dataDir, candidate.file), null);
    if (!data || typeof data !== 'object' || Array.isArray(data)) continue;
    const rocDate = toRocDate(candidate.date);
    const validCount = eligibleStocks.filter((code) => hasTargetDate(data[code], rocDate)).length;
    if (validCount <= 0) continue;
    const previousStatus = readJson(path.join(dataDir, `fubon_${candidate.date}_institutional_status.json`), null);
    return {
      date: candidate.date,
      valid_count: validCount,
      universe_count: Number(previousStatus?.universe_count) || null,
    };
  }
  return null;
}

function buildStatus({ targetDateStr, stockInfo, data, failedList, reference }) {
  const rocDate = toRocDate(targetDateStr);
  const stockNumbers = [...stockInfo.keys()].sort();
  const validStocks = stockNumbers.filter((code) => hasTargetDate(data[code], rocDate));
  const validSet = new Set(validStocks);
  const missingStocks = stockNumbers.filter((code) => !validSet.has(code));
  const universeCount = stockNumbers.length;
  const validCount = validStocks.length;
  const missingCount = missingStocks.length;
  const completionRate = universeCount ? Number((validCount / universeCount * 100).toFixed(2)) : 0;

  const failureByStock = new Map();
  for (const raw of Array.isArray(failedList) ? failedList : []) {
    const item = normalizeFailedItem(raw);
    if (item.stock) failureByStock.set(item.stock, item);
  }

  const reconciledFailed = missingStocks.map((stock) => failureByStock.get(stock) || {
    stock,
    error: '目標日期資料尚未完整（完整度檢查補入）',
    reason: 'MISSING_TARGET_DATE',
  });

  const reasonCounts = {};
  for (const item of reconciledFailed) reasonCounts[item.reason] = (reasonCounts[item.reason] || 0) + 1;
  const recoverableReasons = ['DATA_MISSING', 'NOT_EXPECTED_DATE', 'EMPTY_DATA', 'MISSING_TARGET_DATE'];
  const recoverableCount = recoverableReasons.reduce((sum, reason) => sum + (reasonCounts[reason] || 0), 0);
  const recoverableRatio = missingCount ? recoverableCount / missingCount : 0;

  const sentinels = Object.fromEntries(SENTINEL_STOCKS.map((code) => [code, {
    name: stockInfo.get(code) || '',
    in_universe: stockInfo.has(code),
    available: validSet.has(code),
  }]));
  const sentinelsOk = SENTINEL_STOCKS.every((code) => stockInfo.has(code) && validSet.has(code));
  const referenceReached = Boolean(reference?.valid_count) && validCount >= reference.valid_count;
  const universeMinimumOk = universeCount >= MIN_EXPECTED_UNIVERSE;
  const universeDropRatio = reference?.universe_count
    ? Number(((reference.universe_count - universeCount) / reference.universe_count).toFixed(4))
    : null;
  const universeReferenceOk = universeDropRatio === null || universeDropRatio <= MAX_REFERENCE_DROP_RATIO;
  const validDropRatio = reference?.valid_count
    ? Number(((reference.valid_count - validCount) / reference.valid_count).toFixed(4))
    : null;
  const referenceCoverageOk = validDropRatio === null || validDropRatio <= MAX_REFERENCE_DROP_RATIO;

  const anomalyFlags = [];
  if (!universeMinimumOk) anomalyFlags.push('UNIVERSE_TOO_SMALL');
  if (!universeReferenceOk) anomalyFlags.push('UNIVERSE_DROP_GT_10_PERCENT');
  if (!sentinelsOk) anomalyFlags.push('SENTINEL_MISSING');
  if (!referenceCoverageOk) anomalyFlags.push('REFERENCE_VALID_DROP_GT_10_PERCENT');

  let status = 'partial';
  if (missingCount === 0 || (recoverableCount === 0 && completionRate >= 98 && referenceReached && sentinelsOk)) status = 'ready';
  else if (completionRate < 30 && recoverableRatio >= 0.8) status = 'provider_not_ready';
  if (anomalyFlags.length > 0 && status === 'ready') status = 'abnormal';

  return {
    status: {
      schema_version: 2,
      date: targetDateStr,
      status,
      universe_count: universeCount,
      valid_count: validCount,
      missing_count: missingCount,
      completion_rate: completionRate,
      reason_counts: reasonCounts,
      recoverable_missing_count: recoverableCount,
      anomaly_flags: anomalyFlags,
      sentinels,
      reference: reference ? {
        date: reference.date,
        valid_count: reference.valid_count,
        universe_count: reference.universe_count,
        difference: validCount - reference.valid_count,
        coverage_percent: reference.valid_count
          ? Number((validCount / reference.valid_count * 100).toFixed(2))
          : null,
      } : null,
      quality_flags: {
        sentinels_ok: sentinelsOk,
        reference_reached: referenceReached,
        universe_minimum_ok: universeMinimumOk,
        universe_reference_ok: universeReferenceOk,
        reference_coverage_ok: referenceCoverageOk,
      },
      diagnostics: {
        min_expected_universe: MIN_EXPECTED_UNIVERSE,
        max_reference_drop_ratio: MAX_REFERENCE_DROP_RATIO,
        universe_drop_ratio: universeDropRatio,
        valid_drop_ratio: validDropRatio,
      },
    },
    reconciledFailed,
  };
}

function main(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  const targetDateStr = resolveTargetDate(args.get('date'));
  if (!/^20\d{6}$/.test(targetDateStr)) throw new Error(`日期格式錯誤: ${targetDateStr}`);

  const tradingDay = getTradingDayStatus(targetDateStr);
  if (!tradingDay.isTradingDay) {
    console.log(JSON.stringify({
      date: targetDateStr,
      status: 'skipped_non_trading_day',
      reason: tradingDay.reason,
      calendar_covered: tradingDay.calendarCovered,
    }, null, 2));
    return;
  }
  if (tradingDay.warning) console.warn(`⚠️ ${tradingDay.warning}`);

  const repoRoot = path.resolve(__dirname, '..');
  const dataDir = path.join(repoRoot, 'data_fubon');
  const stockInfo = readEligibleStockUniverse(path.join(repoRoot, 'data_twse', 'twse_industry.csv'));
  const stockNumbers = [...stockInfo.keys()].sort();
  const dataFile = path.join(dataDir, `fubon_${targetDateStr}_institutional.json`);
  const failedFile = path.join(dataDir, `fubon_${targetDateStr}_institutional_failedList.json`);
  const statusFile = path.join(dataDir, `fubon_${targetDateStr}_institutional_status.json`);

  const data = readJson(dataFile, {});
  const failedList = readJson(failedFile, []);
  const reference = findPreviousReference(dataDir, targetDateStr, stockNumbers);
  const { status, reconciledFailed } = buildStatus({ targetDateStr, stockInfo, data, failedList, reference });

  let failedChanged = false;
  if (reconciledFailed.length > 0) failedChanged = writeJsonIfChanged(failedFile, reconciledFailed);
  else if (fs.existsSync(failedFile)) { fs.unlinkSync(failedFile); failedChanged = true; }
  const statusChanged = writeJsonIfChanged(statusFile, status);

  console.log(JSON.stringify({
    date: targetDateStr,
    status: status.status,
    universe_count: status.universe_count,
    valid_count: status.valid_count,
    missing_count: status.missing_count,
    completion_rate: status.completion_rate,
    reason_counts: status.reason_counts,
    anomaly_flags: status.anomaly_flags,
    quality_flags: status.quality_flags,
    reference: status.reference,
    failed_list_changed: failedChanged,
    status_changed: statusChanged,
  }, null, 2));
}

if (require.main === module) {
  try { main(); }
  catch (error) {
    console.error(`Institutional data reconciliation failed: ${error.message}`);
    process.exitCode = 1;
  }
}

module.exports = {
  buildStatus,
  findPreviousReference,
  inferReason,
  MIN_EXPECTED_UNIVERSE,
  MAX_REFERENCE_DROP_RATIO,
};
