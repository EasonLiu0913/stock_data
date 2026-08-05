(() => {
  'use strict';

  const COMPOSITE_FILTER_KEY = 'registeredTagStrategy__tag__composite';
  const ORIGINAL_SCRIPT = 'prediction-tag-strategy-enhancement.js?v=4';

  function normalizeSelection(selection = {}) {
    return {
      all: selection.all instanceof Set ? [...selection.all] : (selection.all || []),
      any: selection.any instanceof Set ? [...selection.any] : (selection.any || []),
      not: selection.not instanceof Set ? [...selection.not] : (selection.not || []),
    };
  }

  function stockTagIds(stock) {
    if (Array.isArray(stock?.atomic_tags)) return stock.atomic_tags;
    if (Array.isArray(stock?.prediction_tags)) return stock.prediction_tags;
    return [];
  }

  function compositeMatches(stock, selection = {}) {
    const matched = new Set(stockTagIds(stock));
    const { all, any, not } = normalizeSelection(selection);
    const matchesAll = all.length > 0 && all.every(id => matched.has(id));
    const matchesAny = any.length > 0 && any.some(id => matched.has(id));
    const hasPositiveGroup = all.length > 0 || any.length > 0;
    const matchesPositiveGroups = !hasPositiveGroup || matchesAll || matchesAny;
    return matchesPositiveGroups && not.every(id => !matched.has(id));
  }

  const API = {
    COMPOSITE_FILTER_KEY,
    normalizeSelection,
    stockTagIds,
    compositeMatches,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  if (typeof window === 'undefined' || typeof document === 'undefined') return;

  function dashboardPayload() {
    return typeof dashboard !== 'undefined' && dashboard ? dashboard : null;
  }

  function forecastDate() {
    const payload = dashboardPayload();
    if (payload?.forecast_date) return payload.forecast_date;
    if (typeof currentDate !== 'undefined' && currentDate) return currentDate;
    return 'latest';
  }

  function readSelection() {
    try {
      return normalizeSelection(JSON.parse(
        sessionStorage.getItem(`predictionTagStrategy:${forecastDate()}`) || '{}',
      ));
    } catch {
      return normalizeSelection();
    }
  }

  function updateExplanation(panel) {
    const paragraph = panel?.querySelector('.tag-strategy-head p');
    if (!paragraph) return;
    const text = '每個標籤右側數字是該標籤「單獨」命中的股票數，不是目前組合結果。AND 組內取交集；OR 組內取聯集；AND 組與 OR 組彼此取聯集；NOT 最後排除。組合後數量以「自訂組合」及下方股票清單為準。';
    if (paragraph.textContent !== text) paragraph.textContent = text;
  }

  function patchCompositeFilter(options = {}) {
    const payload = dashboardPayload();
    if (!payload || typeof quickFilters === 'undefined' || !quickFilters) return false;

    const selection = readSelection();
    const existing = quickFilters[COMPOSITE_FILTER_KEY];
    if (existing) existing.test = stock => compositeMatches(stock, selection);

    const panel = document.getElementById('predictionTagStrategyPanel');
    updateExplanation(panel);
    const count = Array.isArray(payload.stocks)
      ? payload.stocks.filter(stock => compositeMatches(stock, selection)).length
      : 0;
    const countNode = panel?.querySelector('.tag-composer-summary strong');
    const countText = `${count.toLocaleString('zh-TW')} 檔`;
    if (countNode && countNode.textContent !== countText) countNode.textContent = countText;

    if (
      options.renderStocks !== false
      && typeof activeQuickFilter !== 'undefined'
      && activeQuickFilter === COMPOSITE_FILTER_KEY
      && typeof renderStocks === 'function'
    ) {
      renderStocks();
    }
    return true;
  }

  function installPatch() {
    let panelObserver = null;
    let applying = false;

    const apply = options => {
      if (applying) return;
      applying = true;
      try {
        patchCompositeFilter(options);
      } finally {
        applying = false;
      }
    };

    const observePanel = () => {
      const panel = document.getElementById('predictionTagStrategyPanel');
      if (!panel || panelObserver) return false;
      panelObserver = new MutationObserver(() => apply({ renderStocks: true }));
      panelObserver.observe(panel, { childList: true, subtree: true, characterData: true });
      apply({ renderStocks: true });
      return true;
    };

    const bodyObserver = new MutationObserver(() => {
      if (observePanel()) bodyObserver.disconnect();
    });
    bodyObserver.observe(document.body, { childList: true, subtree: true });
    observePanel();

    document.addEventListener('click', event => {
      if (!event.target.closest('[data-tag-id], [data-clear-tag-strategy]')) return;
      setTimeout(() => apply({ renderStocks: true }), 0);
    });

    let attempts = 0;
    const timer = setInterval(() => {
      attempts += 1;
      const ready = patchCompositeFilter({ renderStocks: true });
      observePanel();
      if (ready || attempts >= 240) clearInterval(timer);
    }, 50);
  }

  const loader = document.createElement('script');
  loader.src = ORIGINAL_SCRIPT;
  loader.onload = installPatch;
  loader.onerror = () => console.error(`Unable to load ${ORIGINAL_SCRIPT}`);
  const current = document.currentScript;
  if (current?.parentNode) current.insertAdjacentElement('afterend', loader);
  else document.head.appendChild(loader);
})();
