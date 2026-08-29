'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

function run(input, out, capturedAt) {
  return execFileSync(process.execPath, ['scripts/crawl_tdcc_shareholding_snapshot.js', '--input-file', input, '--output-root', out, '--captured-at', capturedAt], { cwd: process.cwd(), encoding: 'utf8' });
}
function readWeekly(out, date) {
  return JSON.parse(fs.readFileSync(path.join(out, 'weekly', `${date}.json`), 'utf8'));
}

test('TDCC ROC-date CSV is archived as one consolidated weekly snapshot without lookahead backdating', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tdcc-snapshot-'));
  const input = path.join(dir, 'input.csv');
  const out = path.join(dir, 'out');
  const rows = [
    '資料日期,證券代號,持股分級,人數,股數,占集保庫存數比例%',
    '1150515,2449  ,1,10,100,1.00',
    '1150515,2449  ,9,20,200,2.00',
    '1150515,2449  ,15,5,500,56.90',
    '1150515,2449  ,17,35,800,100.00',
    '1150515,2330  ,15,9,900,70.00',
    '1150515,2330  ,17,9,900,100.00',
  ].join('\n');
  fs.writeFileSync(input, `${rows}\n`);
  const capturedAt = '2026-05-16T01:23:45.000Z';
  run(input, out, capturedAt);
  const weekly = readWeekly(out, '20260515');
  assert.equal(weekly.schema_version, 2);
  assert.equal(weekly.source, 'tdcc_official_openapi_1_5');
  assert.equal(weekly.production_safe, true);
  assert.equal(weekly.observed_date, '2026-05-15');
  assert.equal(weekly.available_at, capturedAt);
  assert.equal(weekly.stock_count, 2);
  assert.equal(weekly.stocks['2449'].derived.large_holder_pct, 56.9);
  assert.equal(weekly.stocks['2449'].derived.small_holder_pct, 3);
  assert.deepEqual(weekly.stocks['2449'].levels.map((x) => x.level), [1, 9, 15, 17]);
  assert.equal(fs.existsSync(path.join(out, 'stocks')), false);
  const manifest = JSON.parse(fs.readFileSync(path.join(out, 'latest.json'), 'utf8'));
  assert.equal(manifest.stocks, 2);
  assert.equal(manifest.available_at, capturedAt);
  assert.equal(manifest.canonical_file, 'weekly/20260515.json');
});

test('same TDCC observation date is idempotent and preserves first available_at', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tdcc-idempotent-'));
  const input = path.join(dir, 'input.csv');
  const out = path.join(dir, 'out');
  fs.writeFileSync(input, [
    '資料日期,證券代號,持股分級,人數,股數,占集保庫存數比例%',
    '1150515,2449,15,5,500,56.90',
    '1150515,2449,17,35,800,100.00',
  ].join('\n'));
  const first = '2026-05-16T01:23:45.000Z';
  const later = '2026-05-16T08:00:00.000Z';
  run(input, out, first);
  const stdout = run(input, out, later);
  assert.match(stdout, /already_archived/);
  const manifest = JSON.parse(fs.readFileSync(path.join(out, 'manifest-20260515.json'), 'utf8'));
  assert.equal(manifest.available_at, first);
  const weekly = readWeekly(out, '20260515');
  assert.equal(weekly.available_at, first);
});

test('official-style TDCC JSON field names tolerate BOM on the date key', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tdcc-json-bom-'));
  const input = path.join(dir, 'input.json');
  const out = path.join(dir, 'out');
  fs.writeFileSync(input, JSON.stringify([
    { '\uFEFF資料日期': '20260821', '證券代號': '2449', '持股分級': '1', '人數': '10', '股數': '100', '占集保庫存數比例%': '1.00' },
    { '\uFEFF資料日期': '20260821', '證券代號': '2449', '持股分級': '9', '人數': '20', '股數': '200', '占集保庫存數比例%': '2.00' },
    { '\uFEFF資料日期': '20260821', '證券代號': '2449', '持股分級': '15', '人數': '5', '股數': '500', '占集保庫存數比例%': '60.13' },
    { '\uFEFF資料日期': '20260821', '證券代號': '2449', '持股分級': '17', '人數': '35', '股數': '800', '占集保庫存數比例%': '100.00' },
  ]));
  const capturedAt = '2026-08-22T00:10:00.000Z';
  run(input, out, capturedAt);
  const weekly = readWeekly(out, '20260821');
  assert.equal(weekly.observed_date, '2026-08-21');
  assert.equal(weekly.available_at, capturedAt);
  assert.equal(weekly.stocks['2449'].derived.large_holder_pct, 60.13);
  assert.equal(weekly.stocks['2449'].derived.small_holder_pct, 3);
});
