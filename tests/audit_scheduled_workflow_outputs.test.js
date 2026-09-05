'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  buildRules,
  previousMonth,
  rankingExpected,
  resolveAuditDates,
} = require('../scripts/audit_scheduled_workflow_outputs');

test('2026-09-05 audit targets previous trading day 2026-09-04', () => {
  const holidays = new Set();
  const result = resolveAuditDates({
    now: new Date('2026-09-05T07:01:00+08:00'),
    holidays,
  });
  assert.equal(result.audit_date, '20260905');
  assert.equal(result.target_trade_date, '20260904');
});

test('audit skips weekend and exchange holiday when resolving previous trading day', () => {
  const holidays = new Set(['2026/09/07']);
  const result = resolveAuditDates({
    auditDate: '20260908',
    now: new Date('2026-09-08T07:01:00+08:00'),
    holidays,
  });
  assert.equal(result.audit_date, '20260908');
  assert.equal(result.target_trade_date, '20260904');
});

test('manual audit date is deterministic and independent of runner current date', () => {
  const result = resolveAuditDates({
    auditDate: '20260905',
    now: new Date('2030-01-01T00:00:00Z'),
    holidays: new Set(),
  });
  assert.equal(result.audit_date, '20260905');
  assert.equal(result.target_trade_date, '20260904');
});

test('ranking contract contains the complete 36-file set', () => {
  const files = rankingExpected('20260904');
  assert.equal(files.length, 36);
  assert.ok(files.includes('data_fubon/fubon_20260904_上市主力買超1日排行.csv'));
  assert.ok(files.includes('data_fubon/fubon_20260904_上市外資賣超30日排行.csv'));
  assert.ok(files.includes('data_fubon/fubon_20260904_上市值增排行.csv'));
  assert.ok(files.includes('data_fubon/fubon_20260904_上市量縮排行.csv'));
  assert.equal(new Set(files).size, 36);
});

test('MOPS scheduled audit resolves previous revenue month', () => {
  assert.equal(previousMonth('20260905'), '202608');
  assert.equal(previousMonth('20260103'), '202512');
});

test('audit registry covers every known scheduled workflow from the completed inventory plus later scheduled additions', () => {
  const rules = buildRules();
  const names = rules.map((rule) => rule.workflow);
  assert.equal(new Set(names).size, names.length);
  assert.equal(names.length, 39);
  for (const expected of [
    'crawl-cnn-fear-and-greed.yml',
    'crawl-eia-crude-spot.yml',
    'crawl-rankings.yml',
    'crawl-refined-product-tightness.yml',
    'crawl-tdcc-shareholding-snapshot.yml',
    'crawl-twse-quarterly-financial-quality.yml',
    'crawl-vix-index.yml',
    'update-official-market-constraints.yml',
  ]) {
    assert.ok(names.includes(expected), `missing registry entry: ${expected}`);
  }
});

test('source-owned and non-daily workflows are not mislabeled as market-date exact outputs', () => {
  const semantics = Object.fromEntries(buildRules().map((rule) => [rule.workflow, rule.semantic]));
  assert.equal(semantics['crawl-eia-crude-spot.yml'], 'source_observation_date');
  assert.equal(semantics['crawl-refined-product-tightness.yml'], 'source_observation_date');
  assert.equal(semantics['crawl-tdcc-shareholding-snapshot.yml'], 'source_observation_date');
  assert.equal(semantics['crawl-mops-monthly-revenue.yml'], 'revenue_month');
  assert.equal(semantics['crawl-twse-quarterly-financial-quality.yml'], 'fiscal_quarter');
  assert.equal(semantics['build-twse-market-chart.yml'], 'date_independent');
});
