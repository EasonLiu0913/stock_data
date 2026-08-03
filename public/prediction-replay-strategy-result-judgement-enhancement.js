(() => {
  'use strict';

  const SAME_DAY_REBOUND_STRATEGIES = new Set([
    'oversold_electronics_rebound_v1',
    'oversold_electronics_rebound_v2',
    'oversold_margin_exit_rebound_v1',
  ]);

  const finiteNumber = value => {
    if (value === null || value === undefined || value === '') return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  };

  function buildStrategyResultIndex(payload = {}, rows = []) {
    const rowsByCode = new Map((rows || []).map(row => [String(row?.stock_code ?? ''), row]));
    const index = new Map();

    for (const [strategyIdRaw, evaluationRaw] of Object.entries(payload?.evaluations || {})) {
      const strategyId = String(strategyIdRaw || '');
      const evaluation = evaluationRaw || {};
      const members = new Set((evaluation.members || []).map(String));
      const hitMembers = new Set((evaluation.hit_members || []).map(String));
      const missMembers = new Set((evaluation.miss_members || []).map(String));
      const stocksByCode = new Map(
        (evaluation.stocks || []).map(stock => [String(stock?.stock_code ?? ''), stock]),
      );
      const target = SAME_DAY_REBOUND_STRATEGIES.has(strategyId)
        ? 'close_return_gt_5'
        : String(evaluation.evaluation_target || '');
      const labels = new Map();

      for (const code of members) {
        if (target === 'close_return_gt_5') {
          const rowReturn = finiteNumber(rowsByCode.get(code)?.actual?.close_return);
          const payloadReturn = finiteNumber(stocksByCode.get(code)?.close_return);
          const closeReturn = rowReturn ?? payloadReturn;
          labels.set(code, closeReturn == null
            ? '尚未驗證'
            : closeReturn > 5
              ? '明顯準確'
              : '明顯不準');
          continue;
        }
        labels.set(code, hitMembers.has(code)
          ? '明顯準確'
          : missMembers.has(code)
            ? '明顯不準'
            : '尚未驗證');
      }

      const resultLabels = [...labels.values()];
      const hits = resultLabels.filter(label => label === '明顯準確').length;
      const misses = resultLabels.filter(label => label === '明顯不準').length;
      const verified = hits + misses;
      index.set(strategyId, {
        strategyId,
        label: evaluation.label || strategyId,
        target,
        members,
        labels,
        candidates: members.size,
        verified,
        hits,
        misses,
        hitRate: verified ? hits / verified * 100 : null,
      });
    }
    return index;
  }

  function resultLabelFor(index, strategyId, stockCode) {
    const evaluation = index.get(String(strategyId || ''));
    if (!evaluation) return null;
    return evaluation.labels.get(String(stockCode ?? '')) ?? null;
  }

  function withStrategyJudgements(rows, index, strategyId, callback) {
    const originals = [];
    for (const row of rows || []) {
      const label = resultLabelFor(index, strategyId, row?.stock_code);
      if (label == null) continue;
      originals.push([row, row.prediction_match_label]);
      row.prediction_match_label = label;
    }
    try {
      return callback();
    } finally {
      for (const [row, originalLabel] of originals) row.prediction_match_label = originalLabel;
    }
  }

  const API = {
    SAME_DAY_REBOUND_STRATEGIES,
    buildStrategyResultIndex,
    resultLabelFor,
    withStrategyJudgements,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  if (window.__replayStrategyResultJudgementInstalled) return;
  window.__replayStrategyResultJudgementInstalled = true;

  let resultIndex = new Map();
  let wrappedRenderCases = null;

  const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, character => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[character]));
  const formatPct = value => Number.isFinite(value) ? `${value.toFixed(2)}%` : 'NA';

  async function loadEvaluations() {
    if (typeof state === 'undefined' || !state?.date || !Array.isArray(state?.rows)) return false;
    try {
      const response = await fetch(`../data_prediction_analysis/tag-strategy/${state.date}.json`, {
        cache: 'no-store',
      });
      if (!response.ok) return false;
      resultIndex = buildStrategyResultIndex(await response.json(), state.rows);
      return resultIndex.size > 0;
    } catch {
      return false;
    }
  }

  function installRenderCasesWrapper() {
    if (typeof renderCases !== 'function') return false;
    if (renderCases === wrappedRenderCases) return true;
    const originalRenderCases = renderCases;
    wrappedRenderCases = function strategyAwareRenderCases(...args) {
      const selection = typeof state === 'undefined' ? null : state?.selection;
      const strategyId = selection?.kind === 'registered_strategy_scope'
        ? String(selection.value || '')
        : '';
      if (!strategyId || !resultIndex.has(strategyId)) {
        return originalRenderCases.apply(this, args);
      }
      return withStrategyJudgements(
        state.rows,
        resultIndex,
        strategyId,
        () => originalRenderCases.apply(this, args),
      );
    };
    renderCases = wrappedRenderCases;
    return true;
  }

  function patchFixedStrategyClusters() {
    document.querySelectorAll('[data-canonical-strategy-list]').forEach(button => {
      const strategyId = String(button.dataset.canonicalStrategyList || '');
      const evaluation = resultIndex.get(strategyId);
      const row = button.closest('.canonical-strategy-row');
      if (!evaluation || !row) return;
      const detail = row.querySelector('.cluster-name span');
      if (detail) {
        const target = evaluation.target === 'close_return_gt_5'
          ? '當日收盤報酬 > 5%'
          : '依策略版本規則';
        detail.innerHTML = `${evaluation.candidates} 檔候選 · ${evaluation.verified} 檔有效覆盤 · ${evaluation.hits} 檔策略命中 · ${evaluation.misses} 檔策略未命中<br>驗證目標：${escapeHtml(target)} · ${evaluation.verified ? '已完成' : evaluation.candidates ? '尚無可驗證結果' : '當日 0 檔'} · 點擊名稱檢視清單`;
      }
      const hitRate = row.querySelector('.cluster-rate b');
      if (hitRate) hitRate.textContent = formatPct(evaluation.hitRate);
      const misses = row.querySelector('.cluster-delta b');
      if (misses) misses.textContent = String(evaluation.misses);
      const fill = row.querySelector('.canonical-hit-fill');
      if (fill) fill.style.width = `${Math.max(0, Math.min(100, evaluation.hitRate || 0))}%`;
    });
  }

  function observeClusterChanges() {
    const clusterList = document.getElementById('clusterList');
    if (!clusterList || clusterList.dataset.strategyResultObserver === 'installed') return;
    clusterList.dataset.strategyResultObserver = 'installed';
    new MutationObserver(patchFixedStrategyClusters).observe(clusterList, {
      childList: true,
      subtree: true,
    });
  }

  let installing = false;
  async function install() {
    if (installing) return false;
    if (typeof state === 'undefined' || !Array.isArray(state?.rows)) return false;
    installing = true;
    try {
      const loaded = await loadEvaluations();
      if (!loaded) return false;
      if (!installRenderCasesWrapper()) return false;
      observeClusterChanges();
      patchFixedStrategyClusters();
      if (state.selection?.kind === 'registered_strategy_scope') renderCases();
      return true;
    } finally {
      installing = false;
    }
  }

  let attempts = 0;
  const timer = setInterval(async () => {
    attempts += 1;
    if (await install() || attempts >= 120) clearInterval(timer);
  }, 100);
  install();
})();
