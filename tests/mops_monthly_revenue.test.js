'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  autoRevenueMonth,
  buildSourceUrl,
  completionSummary,
  enrichCompanies,
  parseMopsRevenueHtml,
  previousRevenueMonth,
  rebuildDerivedCompanies,
} = require('../scripts/crawl_mops_monthly_revenue');

const fixture = `
<html><body>
<div>上市公司115年7月份(累計與當月)營業收入統計表</div>
<div>出表日期：115/08/07</div>
<table>
<tr><td>產業別：電機機械</td><td>單位：千元</td></tr>
<tr><td>1504</td><td>東元</td><td>5,528,934</td><td>5,277,164</td><td>4,857,940</td><td>4.77</td><td>13.81</td><td>36,316,904</td><td>33,926,490</td><td>7.04</td><td>-</td></tr>
<tr><td>1514</td><td>亞力</td><td>1,200,000</td><td>1,100,000</td><td>800,000</td><td>9.09</td><td>50.00</td><td>6,500,000</td><td>5,000,000</td><td>30.00</td><td>客戶需求增加</td></tr>
<tr><td>合計</td><td>6,728,934</td></tr>
</table>
</body></html>`;

test('builds MOPS URL from Gregorian revenue month', () => {
  assert.equal(buildSourceUrl('202607'), 'https://mopsov.twse.com.tw/nas/t21/sii/t21sc03_115_7_0.html');
  assert.equal(previousRevenueMonth('202601'), '202512');
});

test('automatic month uses previous Taipei calendar month', () => {
  assert.equal(autoRevenueMonth(new Date('2026-08-07T06:00:00Z')), '202607');
  assert.equal(autoRevenueMonth(new Date('2026-01-05T06:00:00Z')), '202512');
});

test('parses company rows, industry, note and report date', () => {
  const result = parseMopsRevenueHtml(fixture, '202607');
  assert.equal(result.report_date, '20260807');
  assert.equal(result.companies.length, 2);
  assert.equal(result.companies[0].stock_code, '1504');
  assert.equal(result.companies[0].industry, '電機機械');
  assert.equal(result.companies[0].yoy_pct, 13.81);
  assert.equal(result.companies[1].note, '客戶需求增加');
});

test('enriches acceleration and preserves first seen metadata', () => {
  const current = parseMopsRevenueHtml(fixture, '202607').companies;
  const previous = { companies: [{ stock_code: '1504', yoy_pct: 0.14 }, { stock_code: '1514', yoy_pct: 39.69 }] };
  const existing = { companies: [{ stock_code: '1504', first_seen_at: '2026-08-07T10:00:00+08:00' }] };
  const enriched = enrichCompanies(current, previous, existing, '2026-08-07T18:30:00+08:00');
  assert.equal(enriched[0].first_seen_at, '2026-08-07T10:00:00+08:00');
  assert.equal(enriched[0].derived.yoy_acceleration_pct_points, 13.67);
  assert.equal(enriched[1].derived.yoy_acceleration_pct_points, 10.31);
});

test('earliest available month becomes baseline_seed instead of unknown', () => {
  assert.deepEqual(completionSummary(100, null, { calculatedAt: '2026-08-07T14:00:00+08:00' }), {
    company_count: 100,
    baseline_month: null,
    baseline_company_count: null,
    expected_company_count: null,
    coverage_ratio: null,
    status: 'baseline_seed',
    is_complete: false,
    status_calculated_at: '2026-08-07T14:00:00+08:00',
    completeness_rule: 'baseline_seed when the immediately previous revenue month is unavailable; otherwise likely_complete when current company count reaches at least 98% of previous month baseline',
  });
});

test('completion metadata records the exact previous baseline month', () => {
  const summary = completionSummary(990, {
    revenue_month: '202606',
    collection: { company_count: 1000 },
  }, {
    baselineMonth: '202606',
    calculatedAt: '2026-08-07T14:00:00+08:00',
  });
  assert.equal(summary.baseline_month, '202606');
  assert.equal(summary.baseline_company_count, 1000);
  assert.equal(summary.coverage_ratio, 0.99);
  assert.equal(summary.status, 'likely_complete');
  assert.equal(summary.is_complete, true);
});

test('rebuild updates prior-month derived values without touching seen timestamps', () => {
  const current = enrichCompanies(parseMopsRevenueHtml(fixture, '202607').companies, null, null, '2026-08-07T10:00:00+08:00');
  const rebuilt = rebuildDerivedCompanies(current, {
    companies: [{ stock_code: '1504', yoy_pct: 5.81 }],
  });
  assert.equal(rebuilt[0].first_seen_at, '2026-08-07T10:00:00+08:00');
  assert.equal(rebuilt[0].last_seen_at, '2026-08-07T10:00:00+08:00');
  assert.equal(rebuilt[0].derived.previous_month_yoy_pct, 5.81);
  assert.equal(rebuilt[0].derived.yoy_acceleration_pct_points, 8);
});
