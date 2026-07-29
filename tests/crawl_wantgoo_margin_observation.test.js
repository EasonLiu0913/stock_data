'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const {
  normalizeDateInput,
  normalizeObservation,
  saveObservation,
  timestampToTaipeiDate,
} = require('../scripts/crawl_wantgoo_margin_observation');

const DATE_TIMESTAMP = Date.parse('2026-07-27T16:00:00.000Z');

function rawObservation(overrides = {}) {
  return {
    financingAmount: [{
      date: DATE_TIMESTAMP,
      lendingBalance: 510903011,
      lastLendingBalance: 533686385,
      marginRatio: 1.39685,
    }],
    financingLots: [{
      date: DATE_TIMESTAMP,
      lendingBalance: 6517617,
      lastLendingBalance: 6705954,
      marginRatio: 0,
    }],
    shortLots: [{
      date: DATE_TIMESTAMP,
      borrowingBalance: 137649,
      lastBorrowingBalance: 98201,
    }],
    ...overrides,
  };
}

function withTemporaryDirectory(callback) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'wantgoo-margin-test-'));
  try {
    return callback(directory);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
}

test('normalizeDateInput validates real calendar dates', () => {
  assert.equal(normalizeDateInput('2026-07-28'), '20260728');
  assert.throws(() => normalizeDateInput('20260230'), /Invalid calendar date/);
});

test('Wantgoo timestamps are interpreted in Asia/Taipei', () => {
  assert.equal(timestampToTaipeiDate(DATE_TIMESTAMP), '20260728');
});

test('normalizes the displayed Wantgoo metrics and formula candidates', () => {
  const result = normalizeObservation(rawObservation());
  assert.equal(result.date, '20260728');
  assert.equal(result.metrics.marginMaintenanceRatePercent, 139.685);
  assert.equal(result.metrics.financingBalance100M, 5109.03011);
  assert.equal(result.metrics.financingChange100M, -227.83374);
  assert.equal(result.metrics.financingBalanceLots, 6517617);
  assert.equal(result.metrics.financingChangeLots, -188337);
  assert.equal(result.metrics.shortBalanceLots, 137649);
  assert.equal(result.metrics.shortChangeLots, 39448);
  assert.ok(Math.abs(result.metrics.shortFinancingRatioPercent - 2.1119528809379258) < 1e-12);
});

test('rejects source arrays whose latest dates disagree', () => {
  const raw = rawObservation({
    shortLots: [{
      date: Date.parse('2026-07-26T16:00:00.000Z'),
      borrowingBalance: 1,
      lastBorrowingBalance: 1,
    }],
  });
  assert.throws(() => normalizeObservation(raw), /source dates do not match/);
});

test('saves an atomic raw/normalized pair and preserves valid existing evidence', () => {
  withTemporaryDirectory((directory) => {
    const raw = rawObservation();
    const normalized = normalizeObservation(raw);
    const first = saveObservation(raw, normalized, { outputDir: directory });
    const secondRaw = rawObservation();
    secondRaw.financingAmount[0].marginRatio = 1.5;
    const second = saveObservation(
      secondRaw,
      normalizeObservation(secondRaw),
      { outputDir: directory },
    );

    assert.equal(first.status, 'saved');
    assert.equal(second.status, 'preserved');
    assert.equal(
      JSON.parse(fs.readFileSync(first.normalizedFile, 'utf8')).metrics.marginMaintenanceRatePercent,
      139.685,
    );
    assert.deepEqual(JSON.parse(fs.readFileSync(path.join(directory, 'files.json'), 'utf8')), [
      '20260728_wantgoo_margin.json',
    ]);
  });
});

test('refuses to silently repair an incomplete stored pair', () => {
  withTemporaryDirectory((directory) => {
    const raw = rawObservation();
    const normalized = normalizeObservation(raw);
    const rawDir = path.join(directory, 'raw');
    fs.mkdirSync(rawDir, { recursive: true });
    fs.writeFileSync(
      path.join(rawDir, '20260728_wantgoo_margin_raw.json'),
      JSON.stringify(raw),
    );
    assert.throws(
      () => saveObservation(raw, normalized, { outputDir: directory }),
      /incomplete overwrite/,
    );
  });
});
