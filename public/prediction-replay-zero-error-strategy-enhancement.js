(() => {
  'use strict';

  function round(value, digits = 2) {
    return Number.isFinite(value) ? Number(value.toFixed(digits)) : null;
  }

  function buildStrategyFailureGroups(rows = []) {
    const verified = rows.filter(row => row?.verified);
    const overallMissCount = verified.filter(row => row.prediction_match_label === '明顯不準').length;
    const overallFailureRate = verified.length ? overallMissCount / verified.length * 100 : null;
    const groups = new Map();

    for (const row of verified) {
      const tags = [...new Set(
        (row?.prediction?.strategy_tags || [])
          .filter(Boolean)
          .map(String),
      )];
      for (const tag of tags) {
        if (!groups.has(tag)) groups.set(tag, []);
        groups.get(tag).push(row);
      }
    }

    return [...groups.entries()].map(([name, members]) => {
      const obviousMissCount = members.filter(row => row.prediction_match_label === '明顯不準').length;
      const obviousMissRate = members.length ? obviousMissCount / members.length * 100 : null;
      return {
        name,
        population_count: members.length,
        obvious_miss_count: obviousMissCount,
        obvious_miss_rate: round(obviousMissRate),
        share_of_all_obvious_misses: round(
          overallMissCount ? obviousMissCount / overallMissCount * 100 : 0,
        ),
        failure_rate_difference_vs_overall:
          Number.isFinite(obviousMissRate) && Number.isFinite(overallFailureRate)
            ? round(obviousMissRate - overallFailureRate)
            : null,
      };
    }).sort((left, right) =>
      (right.failure_rate_difference_vs_overall ?? -Infinity)
        - (left.failure_rate_difference_vs_overall ?? -Infinity)
      || right.population_count - left.population_count
      || left.name.localeCompare(right.name, 'zh-Hant'));
  }

  const API = { buildStrategyFailureGroups };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  if (window.__replayZeroErrorStrategyClustersInstalled) return;
  window.__replayZeroErrorStrategyClustersInstalled = true;

  function updateExplanation() {
    const tabs = document.getElementById('clusterTabs');
    const paragraph = tabs?.closest('.section-head')?.querySelector('p');
    if (paragraph) {
      paragraph.textContent =
        '完整顯示所有有有效樣本的策略；0 筆明顯錯誤也會保留。紅色差值越高，代表該群組的明顯錯誤率高於全體；小樣本只作線索。';
    }
  }

  function install() {
    if (typeof state === 'undefined' || !state.summary || !Array.isArray(state.rows)) return false;
    if (!state.mistakes || typeof state.mistakes !== 'object') return false;

    state.mistakes.by_strategy_tag = buildStrategyFailureGroups(state.rows);
    updateExplanation();

    if (state.clusterKey === 'by_strategy_tag' && typeof renderClusters === 'function') {
      renderClusters();
    }
    return true;
  }

  let attempts = 0;
  const timer = setInterval(() => {
    attempts += 1;
    try {
      if (install() || attempts >= 200) clearInterval(timer);
    } catch (error) {
      clearInterval(timer);
      console.error('Unable to install zero-error strategy clusters:', error);
    }
  }, 50);
})();
