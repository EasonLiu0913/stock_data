'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {
  normalizeCurrentQuarterMetrics,
  scorePreliminaryEvent,
  buildEventDrivenFinancialRows,
  latestKnownScore,
} = require('../scripts/event_driven_financial_quality');

const ROOT = path.resolve(__dirname, '..');

test('preliminary scorer refuses incomplete current-quarter metrics', () => {
  const normalized = normalizeCurrentQuarterMetrics({ metrics: { revenue: 100, eps: 2 } });
  assert.ok(normalized.missing.includes('gross_margin_pct'));
  assert.ok(normalized.missing.includes('operating_margin_pct'));
  assert.ok(normalized.missing.includes('operating_income'));
});

test('TSMC 2026Q2 verified preliminary release is scoreable without future formal Q2 data', () => {
  const payload = JSON.parse(fs.readFileSync(path.join(ROOT, 'data_fundamental_events_verified', '2330', '2026.json'), 'utf8'));
  const event = payload.events.find(item => item.event_type === 'preliminary_earnings' && item.fiscal_period === '2026Q2');
  assert.ok(event, 'verified 2330 2026Q2 preliminary event missing');
  const scored = scorePreliminaryEvent(event, { root: ROOT });
  assert.equal(scored.scoreable, true);
  assert.equal(scored.financial_quality_score, 11);
  assert.equal(scored.effective_date, '2026-07-17');
  assert.equal(scored.comparison_periods.previous_quarter, '2026Q1');
  assert.equal(scored.comparison_periods.year_ago_quarter, '2025Q2');
  assert.ok(scored.score_reasons.some(reason => reason.reason === 'eps_yoy>=75%'));
  assert.ok(scored.score_reasons.some(reason => reason.reason === 'operating_margin_yoy>=+5pp'));
});

test('latest-known score switches from formal Q1 to preliminary Q2 only on effective date', () => {
  const built = buildEventDrivenFinancialRows('2330', { root: ROOT });
  const before = latestKnownScore(built.rows, '2026-07-16');
  const after = latestKnownScore(built.rows, '2026-07-17');
  assert.equal(before.fiscal_period, '2026Q1');
  assert.equal(after.fiscal_period, '2026Q2');
  assert.equal(after.financial_quality_score, 11);
  assert.equal(after.score_basis, 'preliminary_event_recomputed');
});
