'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  applyConstraintsToPayloads,
  DISPOSITION_INCOMPLETE_WARNING,
  FORMAL_DISPOSITION_CRITERION,
} = require('../scripts/apply_official_market_constraints');
const {
  OVERSOLD_ELECTRONICS_STRATEGY_ID,
  OVERSOLD_ELECTRONICS_TAG,
} = require('../scripts/apply_formal_market_strategy_tags');

function candidate(code) {
  const metadata = {
    strategy_id: OVERSOLD_ELECTRONICS_STRATEGY_ID,
    label: OVERSOLD_ELECTRONICS_TAG,
    candidate_score: 80,
    criteria: ['處置股資料接入後才啟用硬排除'],
    risk_warnings: ['處置股資料未接入，無法完成此項排除。'],
  };
  return {
    stock_code: code,
    stock_name: code,
    industry: '半導體業',
    data_completeness: 100,
    strategy_tags: [OVERSOLD_ELECTRONICS_TAG],
    features: { rsi14: 25, r3: -10, gap_sma20: -15, volume_ratio_1d: 1.2 },
    reversal_signals: { tags: [] },
    formal_market_strategies: { [OVERSOLD_ELECTRONICS_STRATEGY_ID]: metadata },
    oversold_electronics_rebound: metadata,
  };
}

function payload() {
  return {
    summary: {
      stocks: [candidate('2492'), candidate('2330')],
      formal_strategy_classifications: {
        [OVERSOLD_ELECTRONICS_STRATEGY_ID]: {
          calculation_status: 'completed',
          count: 2,
          members: ['2492', '2330'],
          criteria: ['處置股資料接入後才啟用硬排除'],
          data_warnings: ['處置股資料未接入，無法完成此項排除。'],
        },
      },
    },
    groupSummary: {
      groups: [{
        group: OVERSOLD_ELECTRONICS_TAG,
        strategy_id: OVERSOLD_ELECTRONICS_STRATEGY_ID,
        calculation_status: 'completed',
        count: 2,
        members: ['2492', '2330'],
        criteria: ['處置股資料接入後才啟用硬排除'],
        data_warnings: ['處置股資料未接入，無法完成此項排除。'],
      }],
    },
  };
}

test('complete official disposition coverage hard-excludes matching candidates', () => {
  const input = payload();
  const result = applyConstraintsToPayloads({
    ...input,
    disposition: {
      complete_market_coverage: true,
      active_stock_codes: ['2492'],
      active_record_count: 1,
      active_stock_record_count: 1,
      active_stock_count: 1,
    },
    readiness: { score: 100, status: '已觸發' },
    dispositionSourceFile: 'data_market_constraints/20260731/disposition.json',
  });
  assert.equal(result.result.candidate_count_before, 2);
  assert.equal(result.result.excluded_count, 1);
  assert.deepEqual(result.result.excluded_codes, ['2492']);
  assert.equal(result.result.candidate_count_after, 1);
  assert.equal(result.summary.stocks[0].strategy_tags.includes(OVERSOLD_ELECTRONICS_TAG), false);
  assert.equal(result.summary.stocks[1].oversold_electronics_rebound.market_readiness_score, 100);
  const classification = result.summary.formal_strategy_classifications[OVERSOLD_ELECTRONICS_STRATEGY_ID];
  assert.equal(classification.count, 1);
  assert.deepEqual(classification.members, ['2330']);
  assert.equal(classification.criteria.includes(FORMAL_DISPOSITION_CRITERION), true);
  assert.deepEqual(classification.data_warnings, []);
});

test('incomplete disposition coverage never silently excludes candidates', () => {
  const input = payload();
  const result = applyConstraintsToPayloads({
    ...input,
    disposition: {
      complete_market_coverage: false,
      active_stock_codes: ['2492'],
    },
    readiness: { score: 85, status: '已觸發' },
  });
  assert.equal(result.result.excluded_count, 0);
  assert.equal(result.result.candidate_count_after, 2);
  const classification = result.summary.formal_strategy_classifications[OVERSOLD_ELECTRONICS_STRATEGY_ID];
  assert.equal(classification.data_warnings.includes(DISPOSITION_INCOMPLETE_WARNING), true);
});
