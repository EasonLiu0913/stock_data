'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const DATE_PATTERN = /^20\d{6}$/;
const SMA_FILE_PATTERN = /^fubon_(20\d{6})_sma\.json$/;

function formatDateKey(date) {
  return `${date.slice(0, 4)}/${date.slice(4, 6)}/${date.slice(6, 8)}`;
}

function readJsonFile(filePath, label) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`${label} is missing: ${filePath}`);
  }

  const stat = fs.statSync(filePath);
  if (!stat.isFile() || stat.size === 0) {
    throw new Error(`${label} is empty: ${filePath}`);
  }

  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (error) {
    throw new Error(`${label} is not valid JSON: ${filePath} (${error.message})`);
  }
}

function listSmaDates(rootDir) {
  const directory = path.join(rootDir, 'data_fubon');
  if (!fs.existsSync(directory)) return [];

  return fs
    .readdirSync(directory, { withFileTypes: true })
    .filter(entry => entry.isFile())
    .map(entry => entry.name.match(SMA_FILE_PATTERN))
    .filter(Boolean)
    .map(match => match[1])
    .sort();
}

function countSmaRows(smaData, date) {
  if (!smaData || typeof smaData !== 'object' || Array.isArray(smaData)) return 0;
  const dateKey = formatDateKey(date);

  return Object.values(smaData).filter(stock => {
    const row = stock && typeof stock === 'object' ? stock[dateKey] : null;
    return Boolean(row && row.Price !== undefined && row.Price !== null && String(row.Price).trim());
  }).length;
}

function validateReplayDate(rootDir, date) {
  if (!DATE_PATTERN.test(date)) {
    throw new Error(`Invalid replay date: ${date}`);
  }

  const files = {
    v1Manifest: path.join(rootDir, 'data_predictions', date, 'manifest.json'),
    v2Manifest: path.join(rootDir, 'data_predictions_v2', date, 'manifest.json'),
    sma: path.join(rootDir, 'data_fubon', `fubon_${date}_sma.json`),
  };

  readJsonFile(files.v1Manifest, 'V1 forecast manifest');
  readJsonFile(files.v2Manifest, 'V2 forecast manifest');
  const smaData = readJsonFile(files.sma, 'Actual result-day SMA file');
  const smaStockCount = countSmaRows(smaData, date);

  if (smaStockCount === 0) {
    throw new Error(
      `Actual result-day SMA file has no usable ${formatDateKey(date)} price rows: ${files.sma}`
    );
  }

  return { date, files, smaStockCount };
}

function resolveReplayDate({ rootDir = path.resolve(__dirname, '..'), requestedDate = null } = {}) {
  if (requestedDate) {
    return validateReplayDate(rootDir, requestedDate);
  }

  const dates = listSmaDates(rootDir);
  if (dates.length === 0) {
    throw new Error('No SMA result files were found under data_fubon');
  }

  // Never silently fall back to an older date when the newest SMA result is incomplete.
  const latestSmaDate = dates.at(-1);
  return validateReplayDate(rootDir, latestSmaDate);
}

function writeFixture(rootDir, relativePath, value) {
  const filePath = path.join(rootDir, relativePath);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(value), 'utf8');
}

function runSelfTest() {
  const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'prediction-replay-date-'));

  try {
    writeFixture(rootDir, 'data_fubon/fubon_20260731_sma.json', {
      2330: { '2026/07/31': { Price: '100' } },
    });
    writeFixture(rootDir, 'data_predictions/20260731/manifest.json', { date: '20260731' });
    writeFixture(rootDir, 'data_predictions_v2/20260731/manifest.json', { date: '20260731' });

    writeFixture(rootDir, 'data_fubon/fubon_20260803_sma.json', {
      2330: { '2026/08/03': { Price: '101' } },
    });
    writeFixture(rootDir, 'data_predictions/20260803/manifest.json', { date: '20260803' });
    writeFixture(rootDir, 'data_predictions_v2/20260803/manifest.json', { date: '20260803' });

    // A future forecast without a matching SMA result must not be selected.
    writeFixture(rootDir, 'data_predictions/20260804/manifest.json', { date: '20260804' });
    writeFixture(rootDir, 'data_predictions_v2/20260804/manifest.json', { date: '20260804' });

    assert.equal(resolveReplayDate({ rootDir }).date, '20260803');
    assert.equal(
      resolveReplayDate({ rootDir, requestedDate: '20260731' }).date,
      '20260731'
    );

    fs.unlinkSync(path.join(rootDir, 'data_predictions_v2/20260803/manifest.json'));
    assert.throws(
      () => resolveReplayDate({ rootDir }),
      /V2 forecast manifest is missing/
    );

    console.log('resolve_prediction_replay_date self-test passed');
  } finally {
    fs.rmSync(rootDir, { recursive: true, force: true });
  }
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

  const requestedDate = getArg('--date');
  const result = resolveReplayDate({ requestedDate });
  console.error(
    `✅ 覆盤日期：${result.date}；SMA 可用股票數：${result.smaStockCount}`
  );
  process.stdout.write(`${result.date}\n`);
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error(`❌ 無法決定覆盤日期: ${error.message}`);
    process.exit(1);
  }
}

module.exports = {
  DATE_PATTERN,
  SMA_FILE_PATTERN,
  formatDateKey,
  readJsonFile,
  listSmaDates,
  countSmaRows,
  validateReplayDate,
  resolveReplayDate,
};
