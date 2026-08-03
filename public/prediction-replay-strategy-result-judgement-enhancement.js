(() => {
  'use strict';

  const nodePolicy = typeof module !== 'undefined' && module.exports
    ? require('./rebound-evaluation-policy')
    : null;
  const policyApi = () => nodePolicy || globalThis.ReboundEvaluationPolicy || null;
  const SAME_DAY_REBOUND_STRATEGIES = nodePolicy?.SAME_DAY_REBOUND_STRATEGY_IDS || new Set();

  const finiteNumber = value => {
    if (value === null || value === undefined || value === '') return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  };

  function buildStrategyResultIndex(payload = {}, rows = [], replayDate = '') {
    const policy = policyApi();
    if (!policy) throw new Error('Rebound evaluation policy is not loaded');
    const date = replayDate || payload?.replay_date || '';
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
      const reboundStrategy = policy.isSameDayReboundStrategy(strategyId);
      const reboundPolicy = reboundStrategy ? policy.policyForDate(date) : null;
      const target = reboundPolicy?.evaluation_target || String(evaluation.evaluation_target || '');
      const labels = new Map();

      for (const code of members) {
        if (reboundStrategy) {
          const rowReturn = finiteNumber(rowsByCode.get(code)?.actual?.close_return);
          const payloadReturn = finiteNumber(stocksByCode.get(code)?.close_return);
          const hit = policy.hitForCloseReturn(rowReturn ?? payloadReturn, reboundPolicy);
          labels.set(code, hit === null
            ? '尚未驗證'
            : hit
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
        policy: reboundPolicy,
        policyLabel: reboundPolicy?.label || null,
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
  let wrappedRowMatchesSelection = null;

  const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, character => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[character]));
  const formatPct = value => Number.isFinite(value) ? `${value.toFixed(2)}%` : 'NA';

  async function loadEvaluations() {
    if (typeof state === 'undefined' || !state?.date || !Array.isArray(state?.rows)) return false;
    if (!policyApi()) return false;
    try {
      const response = await fetch(`../data_prediction_analysis/tag-strategy/${state.date}.json`, {
        cache: 'no-store',
      });
      if (!response.ok) return false;
      resultIndex = buildStrategyResultIndex(await response.json(), state.rows, state.date);
      return resultIndex.size > 0;
    } catch {
      return false;
    }
  }

  function installSelectionWrapper() {
    if (typeof rowMatchesSelection !== 'function') return false;
    if (rowMatchesSelection === wrappedRowMatchesSelection) return true;
    const originalRowMatchesSelection = rowMatchesSelection;
    wrappedRowMatchesSelection = function strategyAwareRowMatchesSelection(row, selection) {
      if (selection?.kind === 'registered_strategy_scope') {
        const evaluation = resultIndex.get(String(selection.value || ''));
        if (evaluation) {
          const code = String(row?.stock_code ?? '');
          const scope = selection.scope || 'candidates';
          if (scope === 'hits') return evaluation.labels.get(code) === '明顯準確';
          if (scope === 'misses') return evaluation.labels.get(code) === '明顯不準';
          return evaluation.members.has(code);
        }
      }
      return originalRowMatchesSelection(row, selection);
    };
    rowMatchesSelection = wrappedRowMatchesSelection;
    return true;
  }

  function updateCaseNote(strategyId) {
    const evaluation = resultIndex.get(String(strategyId || ''));
    const caseNote = document.getElementById('caseNote');
    if (!evaluation?.policyLabel || !caseNote) return;
    const text = `顯示「${evaluation.label}」策略清單；明顯準確依「${evaluation.policyLabel}」判定，不使用事前方向。`;
    if (caseNote.textContent !== text) caseNote.textContent = text;
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
      const result = withStrategyJudgements(
        state.rows,
        resultIndex,
        strategyId,
        () => originalRenderCases.apply(this, args),
      );
      updateCaseNote(strategyId);
      return result;
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
        const target = evaluation.policyLabel || '依策略版本規則';
        const detailHtml = `${evaluation.candidates} 檔候選 · ${evaluation.verified} 檔有效覆盤 · ${evaluation.hits} 檔策略命中 · ${evaluation.misses} 檔策略未命中<br>驗證目標：${escapeHtml(target)} · ${evaluation.verified ? '已完成' : evaluation.candidates ? '尚無可驗證結果' : '當日 0 檔'} · 點擊名稱檢視清單`;
        if (detail.innerHTML !== detailHtml) detail.innerHTML = detailHtml;
      }
      const hitRate = row.querySelector('.cluster-rate b');
      if (hitRate && hitRate.textContent !== formatPct(evaluation.hitRate)) {
        hitRate.textContent = formatPct(evaluation.hitRate);
      }
      const misses = row.querySelector('.cluster-delta b');
      if (misses && misses.textContent !== String(evaluation.misses)) {
        misses.textContent = String(evaluation.misses);
      }
      const fill = row.querySelector('.canonical-hit-fill');
      const width = `${Math.max(0, Math.min(100, evaluation.hitRate || 0))}%`;
      if (fill && fill.style.width !== width) fill.style.width = width;
    });
  }

  function patchFormalStrategyCards() {
    document.querySelectorAll('[data-strategy-card]').forEach(card => {
      const strategyId = String(card.dataset.strategyCard || '');
      const evaluation = resultIndex.get(strategyId);
      if (!evaluation?.policyLabel) return;
      const description = card.querySelector('.strategy-description');
      const descriptionText = `評估目標：${evaluation.policyLabel}。候選資格只讀取預測當時保存的版本化快照，不使用事後資料重新篩選。`;
      if (description && description.textContent !== descriptionText) description.textContent = descriptionText;

      const kpis = [...card.querySelectorAll('.formal-strategy-kpi')];
      const setKpi = (index, label, value) => {
        const item = kpis[index];
        if (!item) return;
        const span = item.querySelector('span');
        const bold = item.querySelector('b');
        if (span && span.textContent !== label) span.textContent = label;
        if (bold && bold.textContent !== String(value)) bold.textContent = String(value);
      };
      setKpi(0, '事前候選', evaluation.candidates);
      setKpi(1, '有效覆盤', evaluation.verified);
      setKpi(2, '當日反彈命中', evaluation.hits);
      setKpi(3, '命中率', formatPct(evaluation.hitRate));

      const counts = {
        candidates: evaluation.candidates,
        hits: evaluation.hits,
        misses: evaluation.misses,
      };
      const labels = {
        candidates: '查看全部候選',
        hits: '查看明顯準確',
        misses: '查看明顯不準',
      };
      card.querySelectorAll('[data-strategy][data-scope]').forEach(button => {
        const scope = button.dataset.scope;
        if (!(scope in counts)) return;
        const text = `${labels[scope]}（${counts[scope]}）`;
        if (button.textContent !== text) button.textContent = text;
        button.disabled = counts[scope] === 0;
      });

      const result = card.querySelector('.strategy-result');
      const status = !evaluation.candidates
        ? '當日 0 檔'
        : !evaluation.verified
          ? '尚無可驗證結果'
          : evaluation.hits
            ? '已有命中'
            : '尚未命中';
      if (result && result.textContent !== status) result.textContent = status;

      const note = card.querySelector('.formal-strategy-note');
      const policyNote = `驗證規則：${evaluation.policyLabel}（規則 v${evaluation.policy.version}）。`;
      if (note && !note.textContent.includes(policyNote)) {
        note.textContent = `${note.textContent.replace(/\s*驗證規則：.*?。\s*$/, '')} ${policyNote}`.trim();
      }
    });
  }

  function patchAllStrategyResults() {
    patchFixedStrategyClusters();
    patchFormalStrategyCards();
  }

  function observeUiChanges() {
    if (!document.body || document.body.dataset.strategyResultObserver === 'installed') return;
    document.body.dataset.strategyResultObserver = 'installed';
    new MutationObserver(patchAllStrategyResults).observe(document.body, {
      childList: true,
      subtree: true,
    });
  }

  let installing = false;
  async function install() {
    if (installing) return false;
    if (typeof state === 'undefined' || !Array.isArray(state?.rows) || !policyApi()) return false;
    installing = true;
    try {
      const loaded = await loadEvaluations();
      if (!loaded) return false;
      if (!installSelectionWrapper()) return false;
      if (!installRenderCasesWrapper()) return false;
      observeUiChanges();
      patchAllStrategyResults();
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
