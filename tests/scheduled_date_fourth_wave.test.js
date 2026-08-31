'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { resolveScheduledCollectionDate } = require('../scripts/resolve_scheduled_collection_date');
const { previousOrSameTradingDate } = require('../scripts/resolve_taifex_scheduled_date');
const { resolvePayloadArtifact } = require('../scripts/crawl_taifex_major_institutional_traders_futures_options');

const ROOT = path.resolve(__dirname, '..');
const TAIFEX_WORKFLOW = path.join(ROOT, '.github/workflows/crawl-taifex-major-institutional-traders-futures-options.yml');

function resolveOccurrence(now, schedule = '21 9 * * *') {
  return resolveScheduledCollectionDate({
    schedule,
    policy: 'same_calendar_date',
    timeZone: 'Asia/Taipei',
    now: new Date(now),
    holidays: new Set(),
  });
}

test('delayed 17:21 Taipei occurrence keeps the intended Taipei calendar date', () => {
  const result = resolveOccurrence('2026-08-31T12:00:00Z');
  assert.equal(result.scheduled_at_utc, '2026-08-31T09:21:00.000Z');
  assert.equal(result.target_date, '20260831');
});

test('delay crossing into the next trading day keeps prior occurrence expected date and rejects advanced source payload', () => {
  const result = resolveOccurrence('2026-09-01T01:00:00Z');
  assert.equal(result.scheduled_at_utc, '2026-08-31T09:21:00.000Z');
  assert.equal(previousOrSameTradingDate(result.target_date, new Set()), '20260831');

  const csvText = '日期,類別\n20260901,期貨\n';
  assert.throws(
    () => resolvePayloadArtifact(csvText, '20260831'),
    /TAIFEX returned 20260901 for requested 20260831/,
  );
});

test('weekend scheduled occurrence rolls back to the previous trading date', () => {
  const result = resolveOccurrence('2026-08-29T10:00:00Z');
  assert.equal(result.target_date, '20260829');
  assert.equal(previousOrSameTradingDate(result.target_date, new Set()), '20260828');
});

test('configured non-trading weekday rolls back to previous-or-same trading date', () => {
  const configured = new Set(['20260925', '20260928']);
  assert.equal(previousOrSameTradingDate('20260928', configured), '20260924');
});

test('manual explicit expected-date workflow behavior remains unchanged', () => {
  const workflow = fs.readFileSync(TAIFEX_WORKFLOW, 'utf8');
  assert.match(workflow, /elif \[ -n "\$\{\{ github\.event\.inputs\.date \}\}" \]; then/);
  assert.match(workflow, /--date "\$\{\{ github\.event\.inputs\.date \}\}"/);

  const csvText = '日期,類別\n20260831,期貨\n';
  assert.deepEqual(resolvePayloadArtifact(csvText, '2026-08-31'), {
    payloadDate: '20260831',
    outputFile: '20260831_taifex_major_institutional_traders_futures_options.csv',
  });
});

test('source payload date remains the canonical output filename date', () => {
  const csvText = '日期,類別\n20260901,期貨\n';
  assert.deepEqual(resolvePayloadArtifact(csvText), {
    payloadDate: '20260901',
    outputFile: '20260901_taifex_major_institutional_traders_futures_options.csv',
  });
});

test('expected-date mismatch fails instead of renaming the source payload', () => {
  const csvText = '日期,類別\n20260901,期貨\n';
  assert.throws(
    () => resolvePayloadArtifact(csvText, '20260831'),
    /This open-data URL only returns the latest available file/,
  );
});
