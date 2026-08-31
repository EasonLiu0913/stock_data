'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  extractPushDates,
  resolveDailyGainersNewsSummaryDate,
} = require('../scripts/resolve_daily_gainers_news_summary_date');

test('push resolves the unique changed analysis-news artifact date', () => {
  assert.equal(
    resolveDailyGainersNewsSummaryDate({
      eventName: 'push',
      changedFiles: [
        'README.md',
        'data_daily_gain_over_5/analysis-news/20260831.json',
      ],
    }),
    '20260831',
  );
});

test('push ignores unrelated dated files and does not infer a fallback date', () => {
  assert.deepEqual(
    extractPushDates([
      'data_daily_gain_over_5/analysis/20260826.json',
      'data_daily_gain_over_5/market-summary/20260826.json',
    ]),
    [],
  );
  assert.throws(
    () => resolveDailyGainersNewsSummaryDate({
      eventName: 'push',
      changedFiles: ['data_daily_gain_over_5/analysis/20260826.json'],
      latestNewsDate: '20260831',
    }),
    /exactly one analysis-news date; found 0/,
  );
});

test('push fails closed when more than one analysis-news date changed', () => {
  assert.throws(
    () => resolveDailyGainersNewsSummaryDate({
      eventName: 'push',
      changedFiles: [
        'data_daily_gain_over_5/analysis-news/20260828.json',
        'data_daily_gain_over_5/analysis-news/20260831.json',
      ],
    }),
    /exactly one analysis-news date; found 2: 20260828, 20260831/,
  );
});

test('manual explicit date remains authoritative', () => {
  assert.equal(
    resolveDailyGainersNewsSummaryDate({
      eventName: 'workflow_dispatch',
      inputDate: '20260831',
      latestNewsDate: '20260828',
    }),
    '20260831',
  );
});

test('manual blank date uses latest analysis-news only', () => {
  assert.equal(
    resolveDailyGainersNewsSummaryDate({
      eventName: 'workflow_dispatch',
      latestNewsDate: '20260831',
    }),
    '20260831',
  );
});

test('manual blank date fails when no analysis-news date exists', () => {
  assert.throws(
    () => resolveDailyGainersNewsSummaryDate({ eventName: 'workflow_dispatch' }),
    /requires an existing latest analysis-news date/,
  );
});
