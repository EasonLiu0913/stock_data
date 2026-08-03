(() => {
  'use strict';

  function round(value, digits = 2) {
    return Number.isFinite(value) ? Number(value.toFixed(digits)) : null;
  }

  function finiteNumber(value) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  function buildStrategyFailureGroups(rows = [], excludedLabels = []) {
    const excluded = new Set([...excludedLabels].map(String));
    const verified = rows.filter(row => row?.verified);
    const overallMissCount = verified.filter(row => row.prediction_match_label === '明顯不準').length;
    const overallFailureRate = verified.length ? overallMissCount / verified.length * 100 : null;
    const groups = new Map();

    for (const row of verified) {
      const tags = [...new Set(
        (row?.prediction?.strategy_tags || [])
          .filter(Boolean)
          .map(String)
          .filter(tag => !excluded.has(tag)),
      )];
      for (const tag of tags) {
        if (!groups.has(tag)) groups.set(tag, []);
        groups.get(tag).push(row);
      }
    }

    return [...groups.entries()].map(([name, members]) => {
      const obviousHitCount = members.filter(row => row.prediction_match_label === '明顯準確').length;
      const obviousMissCount = members.filter(row => row.prediction_match_label === '明顯不準').length;
      const obviousMissRate = members.length ? obviousMissCount / members.length * 100 : null;
      return {
        cluster_type: 'direction_tag',
        name,
        population_count: members.length,
        obvious_hit_count: obviousHitCount,
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

  function buildCanonicalStrategyGroups(payload = {}) {
    const definitions = Array.isArray(payload?.registry?.strategies)
      ? payload.registry.strategies
      : [];
    const evaluations = payload?.evaluations || {};

    return definitions
      .filter(definition => definition && definition.enabled !== false && definition.fixed_display !== false)
      .map(definition => {
        const strategyId = String(definition.strategy_id || '');
        const evaluation = evaluations[strategyId] || {};
        const candidates = finiteNumber(evaluation.candidates) ?? (evaluation.members || []).length;
        const verifiedCandidates = finiteNumber(evaluation.verified_candidates) ?? 0;
        const hits = finiteNumber(evaluation.hits) ?? 0;
        const misses = finiteNumber(evaluation.misses) ?? 0;
        const hitRate = finiteNumber(evaluation.hit_rate);
        const missRate = verifiedCandidates > 0 ? misses / verifiedCandidates * 100 : null;
        return {
          cluster_type: 'canonical_strategy',
          strategy_id: strategyId,
          name: definition.label || evaluation.label || strategyId,
          evaluation_target: evaluation.evaluation_target || definition.evaluation_target || '',
          calculation_status: evaluation.calculation_status || 'completed',
          candidates,
          population_count: verifiedCandidates,
          hit_count: hits,
          miss_count: misses,
          hit_rate: hitRate ?? (verifiedCandidates ? round(hits / verifiedCandidates * 100) : null),
          miss_rate: round(missRate),
          missing_replay_candidates: finiteNumber(evaluation.missing_replay_candidates) ?? 0,
          members: (evaluation.members || []).map(String),
          hit_members: (evaluation.hit_members || []).map(String),
          miss_members: (evaluation.miss_members || []).map(String),
        };
      });
  }

  function canonicalStrategySelection(group = {}) {
    return {
      kind: 'registered_strategy_scope',
      value: String(group.strategy_id || ''),
      label: `${group.name || group.strategy_id || '固定策略'}－全部候選`,
      scope: 'candidates',
    };
  }

  const API = {
    buildStrategyFailureGroups,
    buildCanonicalStrategyGroups,
    canonicalStrategySelection,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  if (window.__replayZeroErrorStrategyClustersInstalled) return;
  window.__replayZeroErrorStrategyClustersInstalled = true;

  let canonicalGroups = [];
  let genericGroups = [];
  let originalRenderClusters = null;
  const canonicalSelectionMembers = new Map();

  const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[char]));
  const formatPct = value => Number.isFinite(Number(value)) ? `${Number(value).toFixed(2)}%` : 'NA';
  const formatSignedPct = value => Number.isFinite(Number(value))
    ? `${Number(value) >= 0 ? '+' : ''}${Number(value).toFixed(2)}%`
    : 'NA';

  function targetLabel(target) {
    return ({
      relative_leadership: '相對領漲',
      close_return_gt_5: '收盤報酬 > 5%',
      intraday_rebound_5d_10pct: '5 個交易日內盤中反彈 ≥ 10%',
    })[target] || target || '依策略版本規則';
  }

  function statusLabel(group) {
    if (group.calculation_status === 'partial') return '等待後續交易日';
    if (group.calculation_status === 'unable_to_calculate') return '資料不足';
    if (!group.population_count && group.candidates) return '尚無可驗證結果';
    if (!group.candidates) return '當日 0 檔';
    return '已完成';
  }

  function updateExplanation() {
    const tabs = document.getElementById('clusterTabs');
    const paragraph = tabs?.closest('.section-head')?.querySelector('p');
    if (paragraph) {
      paragraph.textContent =
        '固定策略依各自的正式驗證目標計算命中；點擊策略名稱可檢視該策略全部候選清單。一般策略標籤則評估原始方向預測，兩種口徑分開呈現。';
    }
  }

  function canonicalHtml(group) {
    const hitRate = group.hit_rate;
    const width = Number.isFinite(hitRate) ? Math.max(0, Math.min(100, hitRate)) : 0;
    const detail = `${group.candidates} 檔候選 · ${group.population_count} 檔有效覆盤 · ${group.hit_count} 檔策略命中 · ${group.miss_count} 檔策略未命中`;
    return `<div class="cluster-row canonical-strategy-row">
      <div class="cluster-name">
        <button type="button" class="drill-button" data-canonical-strategy-list="${escapeHtml(group.strategy_id)}" title="檢視${escapeHtml(group.name)}全部候選清單"><b>${escapeHtml(group.name)}</b></button>
        <span>${escapeHtml(detail)}<br>驗證目標：${escapeHtml(targetLabel(group.evaluation_target))} · ${escapeHtml(statusLabel(group))} · 點擊名稱檢視清單</span>
      </div>
      <div class="bar-track" aria-label="${escapeHtml(group.name)} 策略命中率 ${formatPct(hitRate)}"><div class="bar-fill canonical-hit-fill" style="width:${width}%"></div></div>
      <div class="cluster-rate"><span>策略命中率</span><b>${formatPct(hitRate)}</b></div>
      <div class="cluster-delta ${group.miss_count ? 'up' : 'down'}"><span>策略未命中</span><b>${group.miss_count}</b></div>
    </div>`;
  }

  function genericHtml(group, maxRate) {
    const delta = finiteNumber(group.failure_rate_difference_vs_overall);
    const width = Number.isFinite(group.obvious_miss_rate)
      ? group.obvious_miss_rate / maxRate * 100
      : 0;
    return `<div class="cluster-row">
      <div class="cluster-name">
        <button type="button" class="drill-button" data-drill-kind="strategy" data-drill-value="${escapeHtml(group.name)}" data-drill-label="${escapeHtml(group.name)}（方向判定）" data-drill-result="all"><b>${escapeHtml(group.name)}</b></button>
        <span><button type="button" class="drill-button" data-drill-kind="strategy" data-drill-value="${escapeHtml(group.name)}" data-drill-label="${escapeHtml(group.name)}（方向判定）" data-drill-result="all">${group.population_count} 筆樣本</button> · <button type="button" class="drill-button" data-drill-kind="strategy" data-drill-value="${escapeHtml(group.name)}" data-drill-label="${escapeHtml(group.name)}（方向判定）" data-drill-result="hits">${group.obvious_hit_count || 0} 筆方向明顯準確</button> · <button type="button" class="drill-button" data-drill-kind="strategy" data-drill-value="${escapeHtml(group.name)}" data-drill-label="${escapeHtml(group.name)}（方向判定）" data-drill-result="misses">${group.obvious_miss_count} 筆方向明顯不準</button></span>
      </div>
      <div class="bar-track" aria-label="${escapeHtml(group.name)} 方向明顯錯誤率 ${formatPct(group.obvious_miss_rate)}"><div class="bar-fill" style="width:${width}%"></div></div>
      <div class="cluster-rate"><span>方向錯誤率</span><b>${formatPct(group.obvious_miss_rate)}</b></div>
      <div class="cluster-delta ${delta > 0 ? 'up' : 'down'}"><span>相對全體</span><b>${formatSignedPct(delta)}</b></div>
    </div>`;
  }

  function ensureStyles() {
    if (document.getElementById('strategy-cluster-semantics-style')) return;
    const style = document.createElement('style');
    style.id = 'strategy-cluster-semantics-style';
    style.textContent = `
      .cluster-subsection-title{margin:14px 0 8px;padding-top:10px;border-top:1px solid #e9edf2;color:#334155;font-size:13px;font-weight:900}
      .cluster-subsection-title:first-child{margin-top:0;padding-top:0;border-top:0}
      .canonical-strategy-row{border:1px solid #bddbd4;border-radius:8px;background:#f7fcfa;padding:11px}
      .canonical-hit-fill{background:#65aa9e!important}
    `;
    document.head.appendChild(style);
  }

  function renderStrategyClusters() {
    document.querySelectorAll('#clusterTabs .tab').forEach(button => {
      button.classList.toggle('active', button.dataset.cluster === state.clusterKey);
    });
    ensureStyles();
    const maxRate = Math.max(1, ...genericGroups.map(item => Number(item.obvious_miss_rate) || 0));
    const sections = [];
    if (canonicalGroups.length) {
      sections.push(`<div class="cluster-subsection-title">固定策略｜依策略自身目標驗證</div>${canonicalGroups.map(canonicalHtml).join('')}`);
    }
    if (genericGroups.length) {
      sections.push(`<div class="cluster-subsection-title">一般策略標籤｜依原始方向預測判定</div>${genericGroups.map(item => genericHtml(item, maxRate)).join('')}`);
    }
    document.getElementById('clusterList').innerHTML = sections.join('')
      || '<div class="case-summary">目前沒有策略群組資料。</div>';
  }

  function installCanonicalSelectionSupport() {
    if (typeof rowMatchesSelection !== 'function' || window.__formalStrategySelectionSupportInstalled || window.__zeroErrorCanonicalSelectionSupportInstalled) return;
    const originalRowMatchesSelection = rowMatchesSelection;
    rowMatchesSelection = function enhancedCanonicalStrategySelection(row, selection) {
      if (selection?.kind === 'registered_strategy_scope') {
        return Boolean(
          canonicalSelectionMembers
            .get(String(selection.value || ''))
            ?.has(String(row?.stock_code ?? '')),
        );
      }
      return originalRowMatchesSelection(row, selection);
    };
    window.__zeroErrorCanonicalSelectionSupportInstalled = true;
  }

  function clearCaseControls() {
    const search = document.getElementById('caseSearch');
    const direction = document.getElementById('caseDirection');
    const industry = document.getElementById('caseIndustry');
    if (search) search.value = '';
    if (direction) direction.value = '';
    if (industry) industry.value = '';
  }

  function showCanonicalStrategyList(group) {
    if (!group || typeof state === 'undefined' || typeof renderCases !== 'function') return;
    clearCaseControls();
    state.selection = canonicalStrategySelection(group);
    state.caseType = 'all';
    renderCases();
    const caseNote = document.getElementById('caseNote');
    if (caseNote) {
      caseNote.textContent = `顯示「${group.name}」全部候選清單；命中與未命中依此固定策略自身的驗證規則判定。`;
    }
    document.getElementById('caseRows')?.closest('.section')?.scrollIntoView({
      behavior: 'smooth',
      block: 'start',
    });
  }

  function installRenderer() {
    if (originalRenderClusters || typeof renderClusters !== 'function') return;
    originalRenderClusters = renderClusters;
    renderClusters = function enhancedRenderClusters() {
      if (state.clusterKey === 'by_strategy_tag') {
        renderStrategyClusters();
        return;
      }
      originalRenderClusters();
    };

    document.getElementById('clusterList')?.addEventListener('click', event => {
      const trigger = event.target.closest('[data-canonical-strategy-list]');
      if (!trigger) return;
      event.preventDefault();
      event.stopPropagation();
      const strategyId = String(trigger.dataset.canonicalStrategyList || '');
      const group = canonicalGroups.find(item => item.strategy_id === strategyId);
      showCanonicalStrategyList(group);
    }, true);
  }

  async function fetchCanonicalReplay() {
    try {
      const response = await fetch(`../data_prediction_analysis/tag-strategy/${state.date}.json`, { cache: 'no-store' });
      return response.ok ? response.json() : null;
    } catch {
      return null;
    }
  }

  let installing = false;
  async function install() {
    if (installing) return false;
    if (typeof state === 'undefined' || !state.summary || !Array.isArray(state.rows)) return false;
    if (!state.mistakes || typeof state.mistakes !== 'object') return false;
    installing = true;
    try {
      const canonicalPayload = await fetchCanonicalReplay();
      canonicalGroups = buildCanonicalStrategyGroups(canonicalPayload || {});
      canonicalSelectionMembers.clear();
      for (const group of canonicalGroups) {
        canonicalSelectionMembers.set(group.strategy_id, new Set(group.members));
      }
      const canonicalLabels = canonicalGroups.map(group => group.name);
      genericGroups = buildStrategyFailureGroups(state.rows, canonicalLabels);
      state.mistakes.by_strategy_tag = genericGroups;
      installCanonicalSelectionSupport();
      installRenderer();
      updateExplanation();
      if (state.clusterKey === 'by_strategy_tag') renderStrategyClusters();
      return true;
    } finally {
      installing = false;
    }
  }

  let attempts = 0;
  const timer = setInterval(() => {
    attempts += 1;
    Promise.resolve(install()).then(installed => {
      if (installed || attempts >= 200) clearInterval(timer);
    }).catch(error => {
      clearInterval(timer);
      console.error('Unable to install strategy cluster semantics:', error);
    });
  }, 50);
})();
