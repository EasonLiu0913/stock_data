'use strict';

const fs = require('node:fs');
const path = require('node:path');

const REQUIRED_FIELDS = ['price', 'open', 'high', 'low', 'volume', 'sma5', 'sma20'];
const SEED_MARKER = '__sma_range_backfill_boundary__';

function compactToSlash(value) {
  const compact = String(value || '').replaceAll('/', '');
  if (!/^\d{8}$/.test(compact)) throw new Error(`Invalid compact date: ${value}`);
  return `${compact.slice(0, 4)}/${compact.slice(4, 6)}/${compact.slice(6, 8)}`;
}

function readJson(file, fallback = null) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (error) {
    if (fallback !== null) return fallback;
    throw error;
  }
}

function writeJson(file, payload) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const temporary = `${file}.tmp-${process.pid}-${Date.now()}`;
  fs.writeFileSync(temporary, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  fs.renameSync(temporary, file);
}

function isCompletePoint(point) {
  return Boolean(point && typeof point === 'object' && REQUIRED_FIELDS.every((field) =>
    point[field] !== null && point[field] !== undefined && point[field] !== ''
  ));
}

function readStockCodes(csvFile) {
  const lines = fs.readFileSync(csvFile, 'utf8').trim().split(/\r?\n/);
  return lines.slice(1)
    .map((line) => String(line.split(',')[0] || '').trim())
    .filter(Boolean);
}

function selectedCodes(csvFile, startIndex, limit) {
  const codes = readStockCodes(csvFile);
  const start = Math.max(0, Number(startIndex) || 0);
  const size = Math.max(0, Number(limit) || 0);
  return codes.slice(start, start + size);
}

function seedRequestedStart(options) {
  const dateKey = compactToSlash(options.startDate);
  const codes = selectedCodes(options.csvFile, options.startIndex, options.limit);
  const entries = [];

  for (const code of codes) {
    const file = path.join(options.historyDir, `${code}.json`);
    const payload = readJson(file, {});
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) continue;

    const hadOriginal = Object.prototype.hasOwnProperty.call(payload, dateKey);
    const originalPoint = hadOriginal ? payload[dateKey] : null;
    if (isCompletePoint(originalPoint)) continue;

    payload[dateKey] = { [SEED_MARKER]: true };
    writeJson(file, payload);
    entries.push({ code, file, dateKey, hadOriginal, originalPoint });
  }

  const state = {
    schemaVersion: 1,
    createdAt: new Date().toISOString(),
    startDate: String(options.startDate).replaceAll('/', ''),
    entries
  };
  writeJson(options.stateFile, state);
  return { codeCount: codes.length, seededCount: entries.length, state };
}

function cleanupRequestedStart(options) {
  const state = readJson(options.stateFile, { entries: [] });
  let restoredCount = 0;
  let retainedCount = 0;

  for (const entry of state.entries || []) {
    const payload = readJson(entry.file, {});
    const point = payload?.[entry.dateKey];
    if (isCompletePoint(point) && point?.[SEED_MARKER] !== true) {
      retainedCount += 1;
      continue;
    }

    if (entry.hadOriginal) payload[entry.dateKey] = entry.originalPoint;
    else delete payload[entry.dateKey];
    writeJson(entry.file, payload);
    restoredCount += 1;
  }

  return { restoredCount, retainedCount, entryCount: (state.entries || []).length };
}

function countCompleteAtStart(options) {
  const dateKey = compactToSlash(options.startDate);
  const codes = selectedCodes(options.csvFile, options.startIndex, options.limit);
  let completeCount = 0;
  for (const code of codes) {
    const point = readJson(path.join(options.historyDir, `${code}.json`), {})?.[dateKey];
    if (isCompletePoint(point)) completeCount += 1;
  }
  return { completeCount, codeCount: codes.length, dateKey };
}

module.exports = {
  SEED_MARKER,
  cleanupRequestedStart,
  compactToSlash,
  countCompleteAtStart,
  isCompletePoint,
  readStockCodes,
  seedRequestedStart,
  selectedCodes
};
