(() => {
  'use strict';

  const POLICY_VERSIONS = Object.freeze([
    Object.freeze({
      policy_id: 'same_day_rebound_close_return_v1',
      version: 1,
      effective_from: '00000000',
      effective_to: '20260802',
      evaluation_target: 'close_return_gt_5',
      operator: 'gt',
      threshold_percent: 5,
      label: '當日收盤報酬 > 5.00%',
    }),
    Object.freeze({
      policy_id: 'same_day_rebound_close_return_v2',
      version: 2,
      effective_from: '20260803',
      effective_to: null,
      evaluation_target: 'close_return_gte_4',
      operator: 'gte',
      threshold_percent: 4,
      label: '當日收盤報酬 ≥ 4.00%',
    }),
  ]);

  const SAME_DAY_REBOUND_STRATEGY_IDS = new Set([
    'oversold_electronics_rebound_v1',
    'oversold_electronics_rebound_v2',
    'oversold_electronics_rebound_v3',
    'oversold_margin_exit_rebound_v1',
    'oversold_margin_exit_rebound_v2',
  ]);

  function compactDate(value) {
    const compact = String(value || '').replaceAll('-', '').replaceAll('/', '');
    return /^20\d{6}$/.test(compact) ? compact : '';
  }

  function isSameDayReboundStrategy(strategyId) {
    const id = String(strategyId || '');
    return SAME_DAY_REBOUND_STRATEGY_IDS.has(id)
      || /^oversold_(electronics|margin_exit)_rebound_v\d+$/.test(id);
  }

  function policyForDate(date) {
    const compact = compactDate(date);
    if (!compact) return POLICY_VERSIONS[POLICY_VERSIONS.length - 1];
    return POLICY_VERSIONS.find(policy => (
      compact >= policy.effective_from
      && (!policy.effective_to || compact <= policy.effective_to)
    )) || POLICY_VERSIONS[POLICY_VERSIONS.length - 1];
  }

  function policyForTarget(target) {
    return POLICY_VERSIONS.find(policy => policy.evaluation_target === String(target || '')) || null;
  }

  function finiteNumber(value) {
    if (value === null || value === undefined || value === '') return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  function hitForCloseReturn(value, policy = policyForDate('')) {
    const closeReturn = finiteNumber(value);
    if (closeReturn === null) return null;
    if (policy.operator === 'gte') return closeReturn >= policy.threshold_percent;
    if (policy.operator === 'gt') return closeReturn > policy.threshold_percent;
    throw new Error(`Unsupported rebound evaluation operator: ${policy.operator}`);
  }

  const API = {
    POLICY_VERSIONS,
    SAME_DAY_REBOUND_STRATEGY_IDS,
    compactDate,
    isSameDayReboundStrategy,
    policyForDate,
    policyForTarget,
    finiteNumber,
    hitForCloseReturn,
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  if (typeof globalThis !== 'undefined') globalThis.ReboundEvaluationPolicy = API;
})();
