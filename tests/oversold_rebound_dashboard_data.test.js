'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');
const {
  buildDashboardData,
  summarizeEvent,
} = require('../scripts/generate_oversold_rebound_dashboard_data');

function writeJson(file, payload) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(payload), 'utf8');
}

function fixture(root) {
  writeJson(path.join(root, 'summary.json'), {
    research_id: 'fixture', stock_count: 1, event_count: 2,
    primary_outcome: { key: 'intraday_rebound_5d_10pct', hits: 1, verified: 1, unverified: 1, hit_rate: 100 },
    feature_coverage: { foreign: { coverage_pct: 50 } },
  });
  writeJson(path.join(root, 'manifest.json'), { date_range: { actual_from: '20260101', actual_to: '20260131' } });
  writeJson(path.join(root, 'pattern-summary.json'), {
    analyzed_stock_count: 1, excluded_non_equity_count: 2,
    evidence_level_counts: { exploratory: 1 }, security_type_counts: { listed_equity: 1 },
    recurring_candidate_patterns: [{ feature_id: 'gap_sma20', label: '距 SMA20 乖離', group: 'price_volume', direction: 'success_higher', stock_count: 1, stock_codes: ['2330'] }],
  });
  writeJson(path.join(root, 'patterns', '2330.json'), {
    stock_code: '2330', stock_name: '台積電', security: { security_type: 'listed_equity', is_equity: true }, evidence_level: 'exploratory',
    primary_outcome: { key: 'intraday_rebound_5d_10pct', label: '5日盤中反彈10%', total_events: 2, verified_events: 1, successful_events: 1, unsuccessful_events: 0, unverified_events: 1, hit_rate: 100 },
    feature_comparisons: [{ feature_id: 'gap_sma20', label: '距 SMA20 乖離', group: 'price_volume', unit: 'pct', direction: 'success_higher', coverage_pct: 100, standardized_mean_difference: 1.2, eligible_as_candidate_pattern: true, success: { mean: -5 }, failure: { mean: -10 } }],
  });
  writeJson(path.join(root, 'profiles', '2330.json'), { feature_coverage: { foreign: { coverage_pct: 50 } } });
  writeJson(path.join(root, 'events', '2330.json'), {
    stock_code: '2330', stock_name: '台積電', history: { first_date: '20260101', last_date: '20260131', trading_days: 20 },
    events: [
      { event_id: 'a', signal_date: '20260110', deepest_signal_date: '20260112', trigger_ids: ['return_3d_lte'], signal: { close: 100, price_volume: { return_3d: -9, drawdown_20d: -15 } }, deepest_signal: { close: 95 }, outcome_from_signal: { labels: { intraday_rebound_5d_10pct: true }, future_return_5d: 8, max_return_5d: 12, max_adverse_5d: -3 }, outcome_from_deepest_signal: { future_return_5d: 15 } },
      { event_id: 'b', signal_date: '20260130', trigger_ids: ['drawdown_20d_lte'], signal: { close: 90, price_volume: { drawdown_20d: -20 } }, outcome_from_signal: { labels: { intraday_rebound_5d_10pct: null }, future_return_5d: null } },
    ],
  });
}

test('dashboard data publishes compact overview and per-stock details', () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'rebound-dashboard-'));
  const input = path.join(temp, 'input');
  const output = path.join(temp, 'public');
  fixture(input);
  const result = buildDashboardData({ inputRoot: input, outputRoot: output });
  assert.equal(result.detail_count, 1);
  const overview = JSON.parse(fs.readFileSync(path.join(output, 'overview.json'), 'utf8'));
  assert.equal(overview.stocks[0].stock_code, '2330');
  assert.equal(overview.stocks[0].candidate_pattern_count, 1);
  const detail = JSON.parse(fs.readFileSync(path.join(output, 'stocks', '2330.json'), 'utf8'));
  assert.equal(detail.events.length, 2);
  assert.equal(detail.events[0].result, 'success');
  assert.equal(detail.events[1].result, 'unverified');
  assert.equal(detail.candidate_patterns[0].feature_id, 'gap_sma20');
});

test('dry run does not replace public output', () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'rebound-dashboard-dry-'));
  const input = path.join(temp, 'input');
  const output = path.join(temp, 'public');
  fixture(input);
  fs.mkdirSync(output, { recursive: true });
  fs.writeFileSync(path.join(output, 'keep.txt'), 'keep');
  buildDashboardData({ inputRoot: input, outputRoot: output, dryRun: true });
  assert.equal(fs.readFileSync(path.join(output, 'keep.txt'), 'utf8'), 'keep');
  assert.equal(fs.existsSync(path.join(output, 'overview.json')), false);
});

test('event summary distinguishes zero, missing and unfinished outcomes', () => {
  const item = summarizeEvent({
    signal: { price_volume: { return_3d: 0, rsi14: null } },
    outcome_from_signal: { labels: { intraday_rebound_5d_10pct: false }, future_return_5d: 0 },
  });
  assert.equal(item.result, 'failure');
  assert.equal(item.signal.return_3d, 0);
  assert.equal(item.signal.rsi14, null);
  assert.equal(item.outcome_from_signal.future_return_5d, 0);
});

test('dashboard HTML loads published data and inline script parses', () => {
  const html = fs.readFileSync(path.join(__dirname, '..', 'public', 'oversold-rebound-dashboard.html'), 'utf8');
  assert.match(html, /data\/oversold-rebound-dashboard/);
  assert.match(html, /0 筆/);
  assert.match(html, /N\/A/);
  assert.match(html, /成功／失敗特徵比較/);
  const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)];
  assert.ok(scripts.length > 0);
  assert.doesNotThrow(() => new vm.Script(scripts.at(-1)[1]));
});
