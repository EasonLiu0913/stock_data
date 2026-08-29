'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { evaluate } = require('../scripts/evaluate_workflow_data_completeness');
const { render } = require('../scripts/write_workflow_data_summary');

test('complete when validation is explicit and dates/counts match', () => {
  const result = evaluate({ expected_date: '20260828', actual_date: '20260828', expected_count: 1330, success_count: 1330, crawl_outcome: 'success', validation_complete: true });
  assert.equal(result.status, 'complete');
  assert.equal(result.complete, true);
});

test('date mismatch is data_not_updated', () => {
  const result = evaluate({ expected_date: '20260828', actual_date: '20260827', crawl_outcome: 'failure', validation_complete: false });
  assert.equal(result.status, 'data_not_updated');
  assert.match(result.reason, /日期不符/);
});

test('partial data reports missing count', () => {
  const result = evaluate({ expected_date: '20260828', actual_date: '20260828', expected_count: 1330, success_count: 1200, crawl_outcome: 'success', validation_complete: false });
  assert.equal(result.status, 'partial_data');
  assert.equal(result.missing_count, 130);
  assert.match(result.reason, /130 筆/);
});

test('server errors are classified separately', () => {
  const result = evaluate({ source_error: 'HTTP 429 Too Many Requests', crawl_outcome: 'failure' });
  assert.equal(result.status, 'server_unavailable');
});

test('format errors are classified separately', () => {
  const result = evaluate({ source_error: 'TWSE margin balance CSV missing header: 股票名稱', crawl_outcome: 'failure' });
  assert.equal(result.status, 'format_error');
});

test('unknown success does not become green without explicit validation', () => {
  const result = evaluate({ expected_date: '20260828', actual_date: '20260828', crawl_outcome: 'success', validation_complete: false });
  assert.equal(result.status, 'unconfirmed');
  assert.equal(result.complete, false);
});

test('Fubon native completeness counts map cleanly to partial/complete', () => {
  const partial = evaluate({ expected_date: '20260828', actual_date: '20260828', expected_count: 1330, success_count: 1200, missing_count: 130, crawl_outcome: 'failure', validation_complete: false });
  assert.equal(partial.status, 'partial_data');
  const complete = evaluate({ expected_date: '20260828', actual_date: '20260828', expected_count: 1330, success_count: 1330, missing_count: 0, crawl_outcome: 'success', validation_complete: true });
  assert.equal(complete.status, 'complete');
});

test('summary renderer is red unless complete', () => {
  const red = render(evaluate({ expected_date: '20260828', actual_date: '20260827', crawl_outcome: 'failure' }));
  assert.match(red, /🔴/);
  const green = render(evaluate({ expected_date: '20260828', actual_date: '20260828', crawl_outcome: 'success', validation_complete: true }));
  assert.match(green, /🟢/);
});

const { collectFromPayload } = require('../scripts/collect_fubon_broker_workflow_status');

test('Fubon adapter preserves native unavailable stocks as accounted-for completeness', () => {
  const raw = collectFromPayload({
    complete: true,
    stocks: { '2330': {}, '2317': {} },
    successfulStockCount: 2,
    unavailableStocks: ['9999'],
    unavailableStockCount: 1,
    failedStocks: [],
    failedStockCount: 0,
    stockUniverse: { expectedStockCount: 3 },
  }, '20260828', 'success');
  const result = evaluate(raw);
  assert.equal(raw.validation_complete, true);
  assert.equal(raw.success_count, 3);
  assert.equal(raw.missing_count, 0);
  assert.equal(result.status, 'complete');
});

test('Fubon adapter exposes missing stocks as partial data', () => {
  const raw = collectFromPayload({
    complete: false,
    stocks: { '2330': {}, '2317': {} },
    successfulStockCount: 2,
    unavailableStocks: [],
    unavailableStockCount: 0,
    failedStocks: ['2454'],
    failedStockCount: 1,
    stockUniverse: { expectedStockCount: 3 },
  }, '20260828', 'failure');
  const result = evaluate(raw);
  assert.equal(raw.missing_count, 1);
  assert.equal(result.status, 'partial_data');
});
