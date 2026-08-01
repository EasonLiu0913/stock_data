'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {
  classifySecurity,
  standardizedMeanDifference,
  compareFeature,
  buildStockPattern,
  aggregateCandidatePatterns,
  analyzePatterns,
  writePatternAnalysis,
} = require('../scripts/oversold_rebound_pattern_analysis');

function event(label, featureValues = {}) {
  return {
    signal_date: '20260101',
    features: {
      price_volume: {
        volume_ratio_20d: featureValues.volume_ratio_20d ?? null,
        drawdown_20d: featureValues.drawdown_20d ?? null,
      },
      institutional: {
        foreign: {
          turned_to_buy: featureValues.foreign_turned_to_buy ?? null,
        },
      },
    },
    outcome_from_signal: {
      labels: {
        intraday_rebound_5d_10pct: label,
      },
    },
  };
}

test('security classification keeps ordinary equities separate from ETF-like products', () => {
  const listed = { '2330': { Name: '台積電', Industry: '半導體業' } };
  assert.deepEqual(classifySecurity('2330', listed), {
    security_type: 'listed_equity',
    is_equity: true,
    classification_basis: 'twse_industry_stock',
  });
  assert.equal(classifySecurity('6443', listed).security_type, 'stock_like_equity');
  assert.equal(classifySecurity('6443', listed).is_equity, true);
  assert.equal(classifySecurity('0050', listed).is_equity, false);
  assert.equal(classifySecurity('00980A', listed).is_equity, false);
});

test('standardized difference measures successful versus unsuccessful events', () => {
  const effect = standardizedMeanDifference([2, 3, 4], [0, 1, 2]);
  assert.ok(effect > 1);
  assert.equal(standardizedMeanDifference([1], [0, 1]), null);
});

test('feature comparison ignores missing values and requires group coverage', () => {
  const events = [
    event(true, { volume_ratio_20d: 2.2 }),
    event(true, { volume_ratio_20d: 1.8 }),
    event(false, { volume_ratio_20d: 0.8 }),
    event(false, { volume_ratio_20d: 1.0 }),
    event(false, { volume_ratio_20d: null }),
  ];
  const comparison = compareFeature(events, {
    id: 'volume_ratio_20d',
    group: 'price_volume',
    path: 'features.price_volume.volume_ratio_20d',
    label: '量比',
    unit: 'ratio',
  }, 'intraday_rebound_5d_10pct');
  assert.equal(comparison.success.count, 2);
  assert.equal(comparison.failure.count, 2);
  assert.equal(comparison.coverage_pct, 80);
  assert.equal(comparison.direction, 'success_higher');
  assert.equal(comparison.eligible_as_candidate_pattern, true);
});

test('stock pattern excludes unfinished outcomes and gates weak samples', () => {
  const payload = {
    stock_code: '6443',
    stock_name: '元晶',
    events: [
      event(true, { volume_ratio_20d: 2.2 }),
      event(true, { volume_ratio_20d: 1.8 }),
      event(false, { volume_ratio_20d: 0.8 }),
      event(false, { volume_ratio_20d: 1.0 }),
      event(false, { volume_ratio_20d: 1.1 }),
      event(false, { volume_ratio_20d: 0.9 }),
      event(null, { volume_ratio_20d: 3 }),
    ],
  };
  const pattern = buildStockPattern(payload, { security_type: 'stock_like_equity', is_equity: true }, {
    primaryLabel: 'intraday_rebound_5d_10pct',
  });
  assert.equal(pattern.primary_outcome.verified_events, 6);
  assert.equal(pattern.primary_outcome.unverified_events, 1);
  assert.equal(pattern.evidence_level, 'exploratory');
  assert.ok(pattern.candidate_patterns.some(item => item.feature_id === 'volume_ratio_20d'));
});

test('recurring feature summary counts only non-insufficient stocks', () => {
  const summary = aggregateCandidatePatterns([
    {
      stock_code: '2330',
      evidence_level: 'pattern_ready',
      candidate_patterns: [{ feature_id: 'volume_ratio_20d', label: '量比', group: 'price_volume', direction: 'success_higher' }],
    },
    {
      stock_code: '6443',
      evidence_level: 'exploratory',
      candidate_patterns: [{ feature_id: 'volume_ratio_20d', label: '量比', group: 'price_volume', direction: 'success_higher' }],
    },
    {
      stock_code: '0050',
      evidence_level: 'insufficient',
      candidate_patterns: [{ feature_id: 'volume_ratio_20d', label: '量比', group: 'price_volume', direction: 'success_higher' }],
    },
  ]);
  assert.equal(summary[0].stock_count, 2);
  assert.deepEqual(summary[0].stock_codes, ['2330', '6443']);
});

test('analysis writes patterns only for equity securities by default', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'rebound-pattern-'));
  const inputRoot = path.join(root, 'research');
  const eventsDir = path.join(inputRoot, 'events');
  fs.mkdirSync(eventsDir, { recursive: true });
  const equityPayload = {
    stock_code: '6443',
    stock_name: '元晶',
    event_count: 6,
    events: [
      event(true, { volume_ratio_20d: 2.2 }),
      event(true, { volume_ratio_20d: 1.8 }),
      event(false, { volume_ratio_20d: 0.8 }),
      event(false, { volume_ratio_20d: 1.0 }),
      event(false, { volume_ratio_20d: 1.1 }),
      event(false, { volume_ratio_20d: 0.9 }),
    ],
  };
  const etfPayload = { ...equityPayload, stock_code: '0050', stock_name: '元大台灣50' };
  fs.writeFileSync(path.join(eventsDir, '6443.json'), JSON.stringify(equityPayload));
  fs.writeFileSync(path.join(eventsDir, '0050.json'), JSON.stringify(etfPayload));
  const result = analyzePatterns({
    inputRoot,
    outputRoot: inputRoot,
    primaryLabel: 'intraday_rebound_5d_10pct',
    stocks: [],
    includeNonEquity: false,
    dryRun: false,
  });
  assert.equal(result.summary.source_event_stock_count, 2);
  assert.equal(result.summary.analyzed_stock_count, 1);
  assert.equal(result.summary.excluded_non_equity_count, 1);
  writePatternAnalysis(inputRoot, result);
  assert.ok(fs.existsSync(path.join(inputRoot, 'patterns', '6443.json')));
  assert.equal(fs.existsSync(path.join(inputRoot, 'patterns', '0050.json')), false);
  assert.ok(fs.existsSync(path.join(inputRoot, 'security-universe.json')));
});
