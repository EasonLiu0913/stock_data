'use strict';

const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

const {
  scoreComponents,
  prevMonth,
} = require('../scripts/summarize_mops_revenue_fundamental_acceleration_score');
const {
  loadHolidaySet,
  nextTradingDate,
} = require('../scripts/resolve_forecast_dates');

const ROOT = path.resolve(__dirname, '..');

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, relativePath), 'utf8'));
}

function latestKnownFinancial(rows, date) {
  const compact = String(date).replace(/[^0-9]/g, '');
  return rows
    .filter(row => String(row.conservative_known_date || '').replace(/[^0-9]/g, '') <= compact)
    .sort((a, b) => String(a.conservative_known_date).localeCompare(String(b.conservative_known_date)))
    .at(-1) || null;
}

test('8021 August 2026 fundamental signal is qualified on 2026-09-07 with next-close execution on 2026-09-08', () => {
  const signal = readJson('data_prediction_analysis/monthly-revenue/monthly-signals/202608.json');
  const event = signal.events.find(row => String(row.stock_code) === '8021');
  assert.ok(event, '8021 must exist in 202608 monthly signal artifact');
  assert.equal(event.base_trading_date, '2026-09-07');

  const history = new Map();
  for (let offset = 0; offset < 12; offset += 1) {
    const month = prevMonth('202608', offset);
    const payload = readJson(`data_mops_monthly_revenue/${month}/monthly_revenue.json`);
    const row = payload.companies.find(item => String(item.stock_code) === '8021');
    if (row) history.set(month, row);
  }

  const fas = scoreComponents(event, '202608', history);
  assert.equal(fas.total_score, 8);

  const timeline = readJson('data_finmind_quarterly_financial_quality/8021/financial-quality-score-timeline.json');
  const financial = latestKnownFinancial(timeline.rows, event.base_trading_date);
  assert.ok(financial);
  assert.equal(financial.fiscal_period, '2026Q2');
  assert.equal(financial.conservative_known_date, '2026-08-14');
  assert.equal(financial.financial_quality_score, 14);

  assert.ok(fas.total_score >= 8);
  assert.ok(financial.financial_quality_score >= 10);

  const executionDate = nextTradingDate(event.base_trading_date, loadHolidaySet(), false);
  assert.equal(executionDate, '2026-09-08');
});
