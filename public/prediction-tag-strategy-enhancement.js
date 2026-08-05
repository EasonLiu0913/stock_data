(() => {
  'use strict';

  const PANEL_ID = 'predictionTagStrategyPanel';
  const FILTER_PREFIX = 'registeredTagStrategy__';
  const COMPOSITE_FILTER_KEY = `${FILTER_PREFIX}tag__composite`;
  const MODE_ORDER = ['', 'all', 'any', 'not'];

  function normalizePayload(payload = {}) {
    const legacy = payload.tag_strategy_registry || {};
    return {
      tags: payload.tag_registry || legacy.tags || [],
      strategies: payload.strategy_registry_v2 || legacy.strategies || [],
      tagClassifications: payload.tag_classifications || {},
      strategyClassifications: payload.strategy_classifications_v2 || payload.strategy_classifications || {},
      stocks: Array.isArray(payload.stocks) ? payload.stocks : [],
      forecastDate: payload.forecast_date || '',
      registryMetadata: payload.strategy_snapshot_metadata || {},
    };
  }

  function stockTagIds(stock) {
    if (Array.isArray(stock?.atomic_tags)) return stock.atomic_tags;
    if (Array.isArray(stock?.prediction_tags)) return stock.prediction_tags;
    return [];
  }

  function stockStrategyIds(stock) {
    if (Array.isArray(stock?.registered_strategy_matches)) return stock.registered_strategy_matches;
    if (Array.isArray(stock?.prediction_strategies)) return stock.prediction_strategies;
    return [];
  }

  function compositeMatches(stock, selection = {}) {
    const matched = new Set(stockTagIds(stock));
    const all = selection.all instanceof Set ? [...selection.all] : (selection.all || []);
    const any = selection.any instanceof Set ? [...selection.any] : (selection.any || []);
    const not = selection.not instanceof Set ? [...selection.not] : (selection.not || []);
    return all.every(id => matched.has(id))
      && (!any.length || any.some(id => matched.has(id)))
      && not.every(id => !matched.has(id));
  }

  function cycleMode(mode) {
    const index = MODE_ORDER.indexOf(mode || '');
    return MODE_ORDER[(index + 1) % MODE_ORDER.length];
  }

  function compositeFilterTransition(currentKey, hasSelection) {
    const targetKey = hasSelection ? COMPOSITE_FILTER_KEY : '';
    return {
      targetKey,
      shouldSet: currentKey !== targetKey,
    };
  }

  const API = {
    COMPOSITE_FILTER_KEY,
    normalizePayload,
    stockTagIds,
    stockStrategyIds,
    compositeMatches,
    cycleMode,
    compositeFilterTransition,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  if (window.__predictionTagStrategyEnhancementInstalled) return;
  window.__predictionTagStrategyEnhancementInstalled = true;

  let latestDashboard = null;
  let latestView = null;
  const selection = { all: new Set(), any: new Set(), not: new Set() };

  const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[char]));

  function filterKey(kind, id) {
    return `${FILTER_PREFIX}${kind}__${id}`;
  }

  function hasCompositeSelection() {
    return selection.all.size > 0 || selection.any.size > 0 || selection.not.size > 0;
  }

  function clearCompositeSelection() {
    selection.all.clear();
    selection.any.clear();
    selection.not.clear();
  }

  function modeFor(tagId) {
    if (selection.all.has(tagId)) return 'all';
    if (selection.any.has(tagId)) return 'any';
    if (selection.not.has(tagId)) return 'not';
    return '';
  }

  function setMode(tagId, mode) {
    selection.all.delete(tagId);
    selection.any.delete(tagId);
    selection.not.delete(tagId);
    if (mode) selection[mode].add(tagId);
  }

  function storageKey() {
    return `predictionTagStrategy:${latestView?.forecastDate || 'latest'}`;
  }

  function saveSelection() {
    try {
      sessionStorage.setItem(storageKey(), JSON.stringify({
        all: [...selection.all],
        any: [...selection.any],
        not: [...selection.not],
      }));
    } catch {}
  }

  function restoreSelection(view) {
    try {
      const stored = JSON.parse(sessionStorage.getItem(`predictionTagStrategy:${view.forecastDate || 'latest'}`) || 'null');
      if (!stored) return;
      const valid = new Set(view.tags.map(item => item.tag_id));
      for (const mode of ['all', 'any', 'not']) {
        selection[mode].clear();
        for (const id of stored[mode] || []) if (valid.has(id)) selection[mode].add(id);
      }
    } catch {}
  }

  function registerFilters(view) {
    if (typeof quickFilters === 'undefined' || !quickFilters) return false;
    quickFilters[COMPOSITE_FILTER_KEY] = {
      label: '自訂標籤組合',
      tag: '多標籤',
      test: stock => compositeMatches(stock, selection),
    };
    for (const definition of view.strategies) {
      quickFilters[filterKey('strategy', definition.strategy_id)] = {
        label: definition.label,
        tag: '策略',
        test: stock => stockStrategyIds(stock).includes(definition.strategy_id),
      };
    }
    return true;
  }

  function activeFilter() {
    return typeof activeQuickFilter !== 'undefined' ? activeQuickFilter : '';
  }

  function clearStockControls() {
    for (const id of ['q', 'direction', 'risk', 'industry', 'signal']) {
      const control = document.getElementById(id);
      if (control) control.value = '';
    }
  }

  function refreshActiveStockView() {
    if (typeof renderStocks === 'function') renderStocks();
    if (typeof renderEnvironment === 'function') renderEnvironment();
  }

  function statusText(classification) {
    if (!classification || classification.calculation_status === 'unable_to_calculate') return 'N/A';
    return Number(classification.count || 0).toLocaleString('zh-TW');
  }

  function statusTitle(classification) {
    if (!classification) return '尚未產生分類資料';
    if (classification.calculation_status === 'unable_to_calculate') return '資料不足，無法計算';
    if (classification.calculation_status === 'partial') return `部分股票資料不足；此標籤單獨命中 ${classification.count || 0} 檔`;
    return classification.count === 0
      ? '已完成計算；此標籤單獨命中 0 檔'
      : `已完成計算；此標籤單獨命中 ${classification.count} 檔`;
  }

  function expressionText(strategy, tagLabels) {
    const expression = strategy.expression || {};
    const groups = [];
    if ((expression.all || []).length) groups.push(`全部：${expression.all.map(id => tagLabels.get(id) || id).join('＋')}`);
    if ((expression.any || []).length) groups.push(`至少一項：${expression.any.map(id => tagLabels.get(id) || id).join('／')}`);
    if ((expression.not || []).length) groups.push(`排除：${expression.not.map(id => tagLabels.get(id) || id).join('、')}`);
    return groups.join('；') || '沿用既有策略成員';
  }

  function modeLabel(mode) {
    return ({ all: 'AND', any: 'OR', not: 'NOT' })[mode] || '未選';
  }

  function tagButtonHtml(definition, classification) {
    const mode = modeFor(definition.tag_id);
    const unavailable = classification?.calculation_status === 'unable_to_calculate';
    return `<button type="button" class="tag-strategy-filter tag-mode-${mode || 'none'}${unavailable ? ' unavailable' : ''}"
      data-tag-id="${esc(definition.tag_id)}" data-mode="${esc(mode)}" aria-pressed="${Boolean(mode)}"
      title="${esc(statusTitle(classification))}" ${unavailable ? 'disabled' : ''}>
      <span class="tag-strategy-filter-label">${esc(definition.label)}</span>
      <b>${esc(statusText(classification))}</b>
      <small>${esc(mode ? modeLabel(mode) : '單獨命中數｜點擊切換 AND → OR → NOT')}</small>
    </button>`;
  }

  function strategyButtonHtml(definition, classification, tagLabels) {
    const key = filterKey('strategy', definition.strategy_id);
    const active = activeFilter() === key;
    const unavailable = classification?.calculation_status === 'unable_to_calculate';
    return `<button type="button" class="tag-strategy-filter strategy-filter${active ? ' active' : ''}${unavailable ? ' unavailable' : ''}"
      data-strategy-id="${esc(definition.strategy_id)}" data-filter-key="${esc(key)}" aria-pressed="${active}"
      title="${esc(statusTitle(classification))}" ${unavailable ? 'disabled' : ''}>
      <span class="tag-strategy-filter-label">${esc(definition.label)}</span>
      <b>${esc(statusText(classification))}</b>
      <small>v${esc(definition.version)}｜${esc(expressionText(definition, tagLabels))}</small>
    </button>`;
  }

  function compositeSummary(view) {
    const labels = new Map(view.tags.map(item => [item.tag_id, item.label]));
    const parts = [];
    if (selection.all.size) parts.push(`AND：${[...selection.all].map(id => labels.get(id) || id).join('＋')}`);
    if (selection.any.size) parts.push(`OR：${[...selection.any].map(id => labels.get(id) || id).join('／')}`);
    if (selection.not.size) parts.push(`NOT：${[...selection.not].map(id => labels.get(id) || id).join('、')}`);
    const count = hasCompositeSelection()
      ? view.stocks.filter(stock => compositeMatches(stock, selection)).length
      : view.stocks.length;
    return {
      text: parts.join('；') || '尚未選擇標籤；點擊標籤可依序切換 AND、OR、NOT。',
      count,
    };
  }

  function applyCompositeFilter() {
    if (typeof setQuickFilter !== 'function' || !registerFilters(latestView)) return;
    clearStockControls();
    saveSelection();

    const transition = compositeFilterTransition(activeFilter(), hasCompositeSelection());
    if (transition.shouldSet) setQuickFilter(transition.targetKey);
    else refreshActiveStockView();

    window.requestAnimationFrame(() => render(latestDashboard, { restore: false }));
  }

  function render(payload, options = {}) {
    latestDashboard = payload;
    latestView = normalizePayload(payload);
    if (!latestView.tags.length && !latestView.strategies.length) return;
    if (options.restore !== false && !hasCompositeSelection()) restoreSelection(latestView);
    registerFilters(latestView);

    const tagLabels = new Map(latestView.tags.map(item => [item.tag_id, item.label]));
    const tags = latestView.tags.filter(item => item.enabled !== false && item.fixed_display !== false);
    const strategies = latestView.strategies.filter(item => item.enabled !== false && item.fixed_display !== false);
    const summary = compositeSummary(latestView);

    let panel = document.getElementById(PANEL_ID);
    if (!panel) {
      panel = document.createElement('section');
      panel.id = PANEL_ID;
      panel.className = 'tag-strategy-panel';
      const anchor = document.getElementById('oversoldBetaReboundBanner')
        || document.getElementById('marketEnvironmentBanner')
        || document.querySelector('.grid.kpis');
      if (anchor?.parentNode) anchor.insertAdjacentElement('afterend', panel);
      else document.body.prepend(panel);
    }

    const categoryOrder = ['technical', 'margin', 'institutional', 'broker', 'classification', 'quality', 'risk'];
    const categoryLabels = {
      technical: '技術面', margin: '融資融券', institutional: '法人', broker: '券商分點',
      classification: '分類', quality: '資料品質', risk: '風險排除', other: '其他',
    };
    const categories = [...new Set(tags.map(item => item.category || 'other'))];
    const orderedCategories = [
      ...categoryOrder.filter(item => categories.includes(item)),
      ...categories.filter(item => !categoryOrder.includes(item)),
    ];

    panel.innerHTML = `
      <div class="tag-strategy-head">
        <div>
          <div class="tag-strategy-eyebrow">固定顯示｜0 與 N/A 分開｜版本 ${esc(latestView.registryMetadata.registry_fingerprint || '尚未產生快照')}</div>
          <h2>標籤與多標籤策略</h2>
          <p>每個標籤右側數字是該標籤「單獨」命中的股票數，不是目前組合結果。AND 取交集；OR 組內至少符合一項；NOT 排除。組合後數量以「自訂組合」及下方股票清單為準。</p>
        </div>
        <button type="button" class="tag-strategy-clear" data-clear-tag-strategy>全部清除</button>
      </div>
      <div class="tag-composer-summary">
        <div><b>自訂組合</b><span>${esc(summary.text)}</span></div>
        <strong>${summary.count.toLocaleString('zh-TW')} 檔</strong>
      </div>
      <div class="tag-strategy-block">
        <h3>原子標籤</h3>
        ${orderedCategories.map(category => `
          <div class="tag-strategy-category">
            <span>${esc(categoryLabels[category] || category)}</span>
            <div class="tag-strategy-filters">
              ${tags.filter(item => (item.category || 'other') === category)
                .map(definition => tagButtonHtml(definition, latestView.tagClassifications[definition.tag_id]))
                .join('')}
            </div>
          </div>`).join('')}
      </div>
      <div class="tag-strategy-block">
        <h3>固定策略</h3>
        <div class="tag-strategy-strategies">
          ${strategies.map(definition => strategyButtonHtml(
            definition,
            latestView.strategyClassifications[definition.strategy_id],
            tagLabels,
          )).join('')}
        </div>
      </div>`;

    panel.querySelectorAll('[data-tag-id]').forEach(button => button.addEventListener('click', () => {
      setMode(button.dataset.tagId, cycleMode(modeFor(button.dataset.tagId)));
      applyCompositeFilter();
    }));
    panel.querySelectorAll('[data-strategy-id]').forEach(button => button.addEventListener('click', () => {
      if (typeof setQuickFilter !== 'function') return;
      clearCompositeSelection();
      saveSelection();
      clearStockControls();
      setQuickFilter(activeFilter() === button.dataset.filterKey ? '' : button.dataset.filterKey);
      window.requestAnimationFrame(() => render(latestDashboard, { restore: false }));
    }));
    panel.querySelector('[data-clear-tag-strategy]')?.addEventListener('click', () => {
      clearCompositeSelection();
      saveSelection();
      if (typeof setQuickFilter === 'function') {
        const transition = compositeFilterTransition(activeFilter(), false);
        if (transition.shouldSet) setQuickFilter(transition.targetKey);
        else refreshActiveStockView();
      }
      window.requestAnimationFrame(() => render(latestDashboard, { restore: false }));
    });
  }

  async function fetchLiveSnapshot(date) {
    if (!/^20\d{6}$/.test(String(date || '').replaceAll('-', '').replaceAll('/', ''))) return null;
    const compact = String(date).replaceAll('-', '').replaceAll('/', '');
    try {
      const response = await fetch(`../data_prediction_analysis/strategy-snapshots/live_snapshot/${compact}.json`, { cache: 'no-store' });
      return response.ok ? await response.json() : null;
    } catch {
      return null;
    }
  }

  async function load() {
    for (let attempt = 0; attempt < 240; attempt += 1) {
      if (typeof dashboard !== 'undefined' && dashboard) {
        let payload = dashboard;
        const view = normalizePayload(payload);
        if (!view.tags.length && !view.strategies.length) {
          const snapshot = await fetchLiveSnapshot(dashboard.forecast_date || (typeof currentDate !== 'undefined' ? currentDate : ''));
          if (snapshot) payload = { ...dashboard, ...snapshot, strategy_registry_v2: snapshot.strategy_registry };
        }
        render(payload);
        if (hasCompositeSelection() && typeof setQuickFilter === 'function') {
          const transition = compositeFilterTransition(activeFilter(), true);
          if (transition.shouldSet) setQuickFilter(transition.targetKey);
          else refreshActiveStockView();
        }
        return;
      }
      await new Promise(resolve => setTimeout(resolve, 50));
    }
  }

  const style = document.createElement('style');
  style.id = 'prediction-tag-strategy-style';
  style.textContent = `
    .tag-strategy-panel{margin-bottom:14px;border:1px solid #cbd5e1;border-left:6px solid #0f766e;background:#fff;border-radius:8px;padding:16px}.tag-strategy-head{display:flex;justify-content:space-between;gap:14px;align-items:flex-start;flex-wrap:wrap}.tag-strategy-head h2{margin:4px 0 0;font-size:20px}.tag-strategy-head p{margin:7px 0 0;color:#64748b;font-size:13px;line-height:1.5}.tag-strategy-eyebrow{font-size:12px;font-weight:900;color:#0f766e}.tag-strategy-clear{border:1px solid #94a3b8;background:#fff;border-radius:7px;padding:8px 11px;font:inherit;font-size:13px;font-weight:900;cursor:pointer}.tag-composer-summary{display:flex;justify-content:space-between;gap:14px;align-items:center;margin-top:13px;border:1px solid #99f6e4;background:#f0fdfa;border-radius:8px;padding:11px 12px}.tag-composer-summary b,.tag-composer-summary span{display:block}.tag-composer-summary span{margin-top:3px;color:#526173;font-size:12px;line-height:1.45}.tag-composer-summary strong{white-space:nowrap;font-size:20px}.tag-strategy-block{margin-top:14px}.tag-strategy-block h3{margin:0 0 9px;font-size:15px}.tag-strategy-category{display:grid;grid-template-columns:90px minmax(0,1fr);gap:10px;align-items:start;margin-top:8px}.tag-strategy-category>span{font-size:12px;font-weight:900;color:#64748b;padding-top:8px}.tag-strategy-filters,.tag-strategy-strategies{display:flex;gap:8px;flex-wrap:wrap}.tag-strategy-filter{appearance:none;display:grid;grid-template-columns:minmax(0,1fr) auto;gap:4px 10px;min-width:160px;max-width:380px;border:1px solid #cbd5e1;background:#fff;border-radius:8px;padding:8px 10px;text-align:left;color:#172033;cursor:pointer}.tag-strategy-filter:hover,.tag-strategy-filter.active{border-color:#0f766e;background:#f0fdfa}.tag-strategy-filter.unavailable{border-style:dashed;background:#f8fafc}.tag-strategy-filter:disabled{cursor:not-allowed;opacity:.72}.tag-strategy-filter-label{font-size:13px;font-weight:900}.tag-strategy-filter b{font-size:16px;font-variant-numeric:tabular-nums}.tag-strategy-filter small{grid-column:1/-1;color:#64748b;font-size:11px;line-height:1.35}.tag-mode-all{border-color:#2563eb;background:#eff6ff}.tag-mode-all small{color:#1d4ed8;font-weight:900}.tag-mode-any{border-color:#d97706;background:#fff7ed}.tag-mode-any small{color:#9a3412;font-weight:900}.tag-mode-not{border-color:#dc2626;background:#fef2f2}.tag-mode-not small{color:#b91c1c;font-weight:900}.tag-strategy-strategies .tag-strategy-filter{min-width:min(100%,310px);flex:1 1 300px}@media(max-width:640px){.tag-strategy-category{grid-template-columns:1fr}.tag-strategy-category>span{padding-top:0}.tag-strategy-filter{min-width:calc(50% - 4px);flex:1 1 calc(50% - 4px)}.tag-composer-summary{align-items:flex-start;flex-direction:column}}@media(max-width:420px){.tag-strategy-filter{min-width:100%}}
  `;
  document.head.appendChild(style);
  load().catch(error => console.error('Unable to render prediction tag strategy panel:', error));
})();
