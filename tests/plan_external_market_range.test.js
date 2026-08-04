'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { buildPlan, parseMarketDates, validateExternalSnapshot } = require('../scripts/plan_external_market_range');

function timestamp(date) { return Math.floor(new Date(`${date}T00:00:00Z`).getTime() / 1000); }
function yahooPayload() {
  return { chart: { result: [{ timestamp: [timestamp('2025-11-03'), timestamp('2025-11-04')], indicators: { quote: [{ close: [100, 101] }] } }] } };
}
function validSnapshot(date) {
  return {
    collection_date: date,
    indicators: ['nasdaq', 'sp500', 'dow', 'sox', 'tsm_adr'].map((id) => ({ id, market_date: date, close: 1 }))
  };
}

test('parses actual Yahoo market dates and skips a valid snapshot', async () => {
  assert.deepEqual(parseMarketDates(yahooPayload(), '20251103', '20251104'), ['20251103', '20251104']);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'external-plan-'));
  fs.mkdirSync(path.join(dir, '20251103'), { recursive: true });
  fs.writeFileSync(path.join(dir, '20251103', 'external_market_indicators.json'), JSON.stringify(validSnapshot('20251103')));
  assert.deepEqual(validateExternalSnapshot(path.join(dir, '20251103', 'external_market_indicators.json'), '20251103'), []);
  const plan = await buildPlan({ payload: yahooPayload(), start: '20251103', end: '20251104', outputDir: dir, batchSize: 5 });
  assert.deepEqual(plan.pending_dates, ['20251104']);
});
