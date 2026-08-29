'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

function htmlForDate() {
  const rows = [];
  for (let level = 1; level <= 17; level += 1) {
    const ratio = level === 15 ? 56.9 : (level <= 9 ? 1 : 0);
    rows.push(`<tr><td>${level}</td><td>range-${level}</td><td>${level * 10}</td><td>${level * 1000}</td><td>${ratio.toFixed(2)}</td></tr>`);
  }
  return `<html><body><table>${rows.join('')}</table></body></html>`;
}

test('TDCC historical backfill stores official history separately and never marks it production no-lookahead safe', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tdcc-history-'));
  const fixtures = path.join(dir, 'fixtures');
  const out = path.join(dir, 'out');
  fs.mkdirSync(fixtures, { recursive: true });
  fs.writeFileSync(path.join(fixtures, '20260515.html'), htmlForDate());
  execFileSync(process.execPath, [
    'scripts/backfill_tdcc_shareholding_history.js',
    '--stock', '2449', '--start', '2026-05-01', '--end', '2026-05-31',
    '--fixture-dir', fixtures, '--output-root', out,
    '--captured-at', '2026-08-29T08:30:00.000Z',
  ], { cwd: process.cwd(), encoding: 'utf8' });
  const p = JSON.parse(fs.readFileSync(path.join(out, '20260515.json'), 'utf8'));
  assert.equal(p.source, 'tdcc_official_historical_query');
  assert.equal(p.observed_date, '2026-05-15');
  assert.equal(p.historical_backfill, true);
  assert.equal(p.production_no_lookahead_safe, false);
  assert.equal(p.derived.large_holder_pct, 56.9);
  assert.equal(p.derived.small_holder_pct, 9);
  assert.equal(p.levels.length, 17);
  assert.match(p.availability_policy, /must not be inferred/);
  const manifest = JSON.parse(fs.readFileSync(path.join(out, 'manifest.json'), 'utf8'));
  assert.equal(manifest.parsed_dates, 1);
  assert.equal(manifest.failed_dates.length, 0);
});
