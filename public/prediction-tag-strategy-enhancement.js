(() => {
  'use strict';
  if (window.__predictionTagStrategyEnhancementInstalled) return;
  window.__predictionTagStrategyEnhancementInstalled = true;

  const PANEL_ID = 'predictionTagStrategyPanel';
  const FILTER_PREFIX = 'registeredTagStrategy__';
  let latestDashboard = null;

  const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[char]));

  function filterKey(kind, id) {
    return `${FILTER_PREFIX}${kind}__${id}`;
  }

  function matched(stock, kind, id) {
    const values = kind === 'tag' ? stock?.prediction_tags : stock?.prediction_strategies;
    return Array.isArray(values) && values.includes(id);
  }

  function registerFilters(payload) {
    if (typeof quickFilters === 'undefined' || !quickFilters) return false;
    for (const definition of payload?.tag_strategy_registry?.tags || []) {
      quickFilters[filterKey('tag', definition.tag_id)] = {
        label: definition.label,
        tag: '標籤',
        test: stock => matched(stock, 'tag', definition.tag_id),
      };
    }
    for (const definition of payload?.tag_strategy_registry?.strategies || []) {
      quickFilters[filterKey('strategy', definition.strategy_id)] = {
        label: definition.label,
        tag: '策略',
        test: stock => matched(stock, 'strategy', definition.strategy_id),
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

  function statusText(classification) {
    if (!classification || classification.calculation_status === 'unable_to_calculate') return 'N/A';
    return Number(classification.count || 0).toLocaleString('zh-TW');
  }

  function statusTitle(classification) {
    if (!classification) return '尚未產生分類資料';
    if (classification.calculation_status === 'unable_to_calculate') return '資料不足，無法計算';
    if (classification.calculation_status === 'partial') return `部分股票資料不足；已辨識 ${classification.count || 0} 檔`;
    return classification.count === 0 ? '已完成計算，當日 0 檔' : `已完成計算，共 ${classification.count} 檔`;
  }

  function expressionText(strategy, tagLabels) {
    const expression = strategy.expression || {};
    const groups = [];
    if ((expression.all || []).length) groups.push(`全部：${expression.all.map(id => tagLabels.get(id) || id).join('＋')}`);
    if ((expression.any || []).length) groups.push(`至少一項：${expression.any.map(id => tagLabels.get(id) || id).join('／')}`);
    if ((expression.not || []).length) groups.push(`排除：${expression.not.map(id => tagLabels.get(id) || id).join('、')}`);
    return groups.join('；') || '沿用既有策略成員';
  }

  function buttonHtml(kind, definition, classification, subtitle = '') {
    const key = filterKey(kind, kind === 'tag' ? definition.tag_id : definition.strategy_id);
    const active = activeFilter() === key;
    const unavailable = classification?.calculation_status === 'unable_to_calculate';
    return `<button type="button" class="tag-strategy-filter${active ? ' active' : ''}${unavailable ? ' unavailable' : ''}"
      data-filter-key="${esc(key)}" aria-pressed="${active}" title="${esc(statusTitle(classification))}">
      <span class="tag-strategy-filter-label">${esc(definition.label)}</span>
      <b>${esc(statusText(classification))}</b>
      ${subtitle ? `<small>${esc(subtitle)}</small>` : ''}
    </button>`;
  }

  function render(payload) {
    latestDashboard = payload;
    registerFilters(payload);
    const registry = payload?.tag_strategy_registry;
    if (!registry) return;
    const tagLabels = new Map((registry.tags || []).map(item => [item.tag_id, item.label]));
    const tags = (registry.tags || []).filter(item => item.fixed_display !== false && item.category !== 'legacy_bridge');
    const strategies = (registry.strategies || []).filter(item => item.fixed_display !== false);
    const tagClassifications = payload.tag_classifications || {};
    const strategyClassifications = payload.strategy_classifications || {};

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

    const categoryOrder = ['technical', 'margin', 'classification', 'quality', 'risk'];
    const categoryLabels = {
      technical: '技術面', margin: '融資融券', classification: '分類', quality: '資料品質', risk: '風險排除',
    };
    const tagGroups = categoryOrder.map(category => ({
      category,
      definitions: tags.filter(item => item.category === category),
    })).filter(group => group.definitions.length);

    panel.innerHTML = `
      <div class="tag-strategy-head">
        <div>
          <div class="tag-strategy-eyebrow">固定顯示｜0 與 N/A 分開</div>
          <h2>標籤與多標籤策略</h2>
          <p>標籤是單一客觀條件；策略由 all／any／not 標籤組合。規則改版會建立新版本，不覆蓋舊快照。</p>
        </div>
        <button type="button" class="tag-strategy-clear" data-clear-tag-strategy>清除標籤／策略篩選</button>
      </div>
      <div class="tag-strategy-block">
        <h3>原子標籤</h3>
        ${tagGroups.map(group => `
          <div class="tag-strategy-category">
            <span>${esc(categoryLabels[group.category] || group.category)}</span>
            <div class="tag-strategy-filters">
              ${group.definitions.map(definition => buttonHtml('tag', definition, tagClassifications[definition.tag_id])).join('')}
            </div>
          </div>`).join('')}
      </div>
      <div class="tag-strategy-block">
        <h3>固定策略</h3>
        <div class="tag-strategy-strategies">
          ${strategies.map(definition => buttonHtml(
            'strategy',
            definition,
            strategyClassifications[definition.strategy_id],
            `v${definition.version}｜${expressionText(definition, tagLabels)}`,
          )).join('')}
        </div>
      </div>`;

    panel.querySelectorAll('[data-filter-key]').forEach(button => button.addEventListener('click', () => {
      if (typeof setQuickFilter !== 'function' || !registerFilters(latestDashboard)) return;
      clearStockControls();
      setQuickFilter(button.dataset.filterKey);
      window.requestAnimationFrame(() => render(latestDashboard));
    }));
    panel.querySelector('[data-clear-tag-strategy]')?.addEventListener('click', () => {
      if (typeof setQuickFilter !== 'function') return;
      setQuickFilter('');
      window.requestAnimationFrame(() => render(latestDashboard));
    });
  }

  async function load() {
    for (let attempt = 0; attempt < 240; attempt += 1) {
      if (typeof dashboard !== 'undefined' && dashboard?.tag_strategy_registry) {
        render(dashboard);
        return;
      }
      await new Promise(resolve => setTimeout(resolve, 50));
    }
  }

  const style = document.createElement('style');
  style.id = 'prediction-tag-strategy-style';
  style.textContent = `
    .tag-strategy-panel{margin-bottom:14px;border:1px solid #cbd5e1;border-left:6px solid #0f766e;background:#fff;border-radius:8px;padding:16px}.tag-strategy-head{display:flex;justify-content:space-between;gap:14px;align-items:flex-start;flex-wrap:wrap}.tag-strategy-head h2{margin:4px 0 0;font-size:20px}.tag-strategy-head p{margin:7px 0 0;color:#64748b;font-size:13px;line-height:1.5}.tag-strategy-eyebrow{font-size:12px;font-weight:900;color:#0f766e}.tag-strategy-clear{border:1px solid #94a3b8;background:#fff;border-radius:7px;padding:8px 11px;font:inherit;font-size:13px;font-weight:900;cursor:pointer}.tag-strategy-block{margin-top:14px}.tag-strategy-block h3{margin:0 0 9px;font-size:15px}.tag-strategy-category{display:grid;grid-template-columns:90px minmax(0,1fr);gap:10px;align-items:start;margin-top:8px}.tag-strategy-category>span{font-size:12px;font-weight:900;color:#64748b;padding-top:8px}.tag-strategy-filters,.tag-strategy-strategies{display:flex;gap:8px;flex-wrap:wrap}.tag-strategy-filter{appearance:none;display:grid;grid-template-columns:minmax(0,1fr) auto;gap:4px 10px;min-width:150px;max-width:360px;border:1px solid #cbd5e1;background:#fff;border-radius:8px;padding:8px 10px;text-align:left;color:#172033;cursor:pointer}.tag-strategy-filter:hover,.tag-strategy-filter.active{border-color:#0f766e;background:#f0fdfa}.tag-strategy-filter.unavailable{border-style:dashed;background:#f8fafc}.tag-strategy-filter-label{font-size:13px;font-weight:900}.tag-strategy-filter b{font-size:16px;font-variant-numeric:tabular-nums}.tag-strategy-filter small{grid-column:1/-1;color:#64748b;font-size:11px;line-height:1.35}.tag-strategy-strategies .tag-strategy-filter{min-width:min(100%,310px);flex:1 1 300px}@media(max-width:640px){.tag-strategy-category{grid-template-columns:1fr}.tag-strategy-category>span{padding-top:0}.tag-strategy-filter{min-width:calc(50% - 4px);flex:1 1 calc(50% - 4px)}}@media(max-width:420px){.tag-strategy-filter{min-width:100%}}
  `;
  document.head.appendChild(style);
  load().catch(error => console.error('Unable to render prediction tag strategy panel:', error));
})();
