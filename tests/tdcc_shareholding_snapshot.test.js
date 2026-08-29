'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

test('TDCC CSV snapshot is archived and normalized without lookahead backdating', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tdcc-snapshot-'));
  const input = path.join(dir, 'input.csv');
  const out = path.join(dir, 'out');
  const rows = [
    '資料日期,證券代號,持股分級,人數,股數,占集保庫存數比例%',
    '20260515,2449  ,1,10,100,1.00',
    '20260515,2449  ,9,20,200,2.00',
    '20260515,2449  ,15,5,500,56.90',
    '20260515,2449  ,17,35,800,100.00',
    '20260515,2330  ,15,9,900,70.00',
    '20260515,2330  ,17,9,900,100.00',
  ].join('\n');
  fs.writeFileSync(input, `${rows}\n`);
  const capturedAt = '2026-05-16T01:23:45.000Z';
  execFileSync(process.execPath, ['scripts/crawl_tdcc_shareholding_snapshot.js', '--input-file', input, '--output-root', out, '--captured-at', capturedAt], { cwd: process.cwd(), stdio: 'pipe' });
  const p = JSON.parse(fs.readFileSync(path.join(out, 'stocks', '2449', '20260515.json'), 'utf8'));
  assert.equal(p.source, 'tdcc_official_openapi_1_5');
  assert.equal(p.production_safe, true);
  assert.equal(p.observed_date, '2026-05-15');
  assert.equal(p.available_at, capturedAt);
  assert.equal(p.derived.large_holder_pct, 56.9);
  assert.equal(p.derived.small_holder_pct, 3);
  assert.deepEqual(p.levels.map((x) => x.level), [1, 9, 15, 17]);
  const manifest = JSON.parse(fs.readFileSync(path.join(out, 'latest.json'), 'utf8'));
  assert.equal(manifest.stocks, 2);
  assert.equal(manifest.available_at, capturedAt);
});
