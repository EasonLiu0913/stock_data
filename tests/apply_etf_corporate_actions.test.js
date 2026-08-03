'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  CORPORATE_ACTIONS,
  splitAwareHoldingReturnPct,
  detectProviderSplitBoundary,
  applyCorporateActions
} = require('../scripts/apply_etf_corporate_actions');

function samplePayload() {
  return {
    etfs: [{ id: '0052', description: 'old' }],
    priceBasis: { explanation: 'Yahoo adjusted close.' },
    sources: { etfPriceDetails: { '0052': { source: 'yahoo' } } },
    rows: [
      { date: '20251114', etf0052Close: 248.5, etf0052AdjustedClose: 242.546921 },
      { date: '20251117', etf0052Close: 35.57143, etf0052AdjustedClose: 34.71928 },
      { date: '20251118', etf0052Close: 35.042858, etf0052AdjustedClose: 34.203369 },
      { date: '20251126', etf0052Close: 35.4, etf0052AdjustedClose: 34.552 }
    ]
  };
}

test('detects Yahoo provider 7-to-1 discontinuity before the official effective date', () => {
  const payload = samplePayload();
  const boundary = detectProviderSplitBoundary(payload.rows, CORPORATE_ACTIONS[0]);
  assert.equal(boundary.date, '20251117');
  assert.ok(Math.abs(boundary.observedRatio - 1 / 7) < 0.001);
});

test('normalizes pre-boundary 0052 prices and removes the false 85 percent loss', () => {
  const payload = applyCorporateActions(samplePayload());
  assert.equal(payload.rows[0].etf0052Close, 35.5);
  assert.equal(payload.rows[0].etf0052AdjustedClose, 34.64956);
  const boundaryReturn = payload.rows[1].etf0052AdjustedClose / payload.rows[0].etf0052AdjustedClose - 1;
  assert.ok(Math.abs(boundaryReturn) < 0.01);
  assert.equal(payload.corporateActions[0].adjustment.applied, true);
  assert.equal(payload.corporateActions[0].factor, 7);
  assert.match(payload.etfs[0].description, /7：1 分割/);
});

test('split-aware position formula preserves value across a pure split', () => {
  assert.ok(Math.abs(splitAwareHoldingReturnPct(245.3, 35.042857, 7)) < 0.0001);
});

test('does not double-adjust a series that is already continuous', () => {
  const payload = samplePayload();
  payload.rows = [
    { date: '20251114', etf0052Close: 35.5, etf0052AdjustedClose: 34.65 },
    { date: '20251117', etf0052Close: 35.57, etf0052AdjustedClose: 34.72 },
    { date: '20251126', etf0052Close: 35.4, etf0052AdjustedClose: 34.55 }
  ];
  const updated = applyCorporateActions(payload);
  assert.equal(updated.rows[0].etf0052Close, 35.5);
  assert.equal(updated.corporateActions[0].adjustment.applied, false);
});
