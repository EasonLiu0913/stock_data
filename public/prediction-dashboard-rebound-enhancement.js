(() => {
  const FILTER_KEY = 'oversoldElectronicsRebound';
  const STRATEGY_ID = 'oversold_electronics_rebound_v1';
  const STRATEGY_LABEL = '跌深反彈電子股';
  const OIL_INDICATORS = [
    { sourceId: 'wti_crude_oil', benchmarkId: 'wti_spot', shortName: 'WTI', name: 'WTI Crude Oil Futures' },
    { sourceId: 'brent_crude_oil', benchmarkId: 'brent_spot', shortName: 'Brent', name: 'Brent Crude Oil Futures' },
  ];

  function isReboundCandidate(stock) {
    if (!stock || typeof stock !== 'object') return false;
    if (stock.formal_market_strategies?.[STRATEGY_ID]) return true;
    if (stock.formal_market_strategy?.strategy_id === STRATEGY_ID) return true;
    return Array.isArray(stock.strategy_tags) && stock.strategy_tags.includes(STRATEGY_LABEL);
  }

  function reboundCandidates(payload) {
    return Array.isArray(payload?.stocks) ? payload.stocks.filter(isReboundCandidate) : [];
  }

  function compactDate(value) {
    return String(value || '').replace(/[^0-9]/g, '');
  }

  function selectExternalMarketDate(availableDates, targetDate) {
    const target = compactDate(targetDate);
    if (!/^\d{8}$/.test(target) || !Array.isArray(availableDates)) return null;
    return availableDates
      .map(compactDate)
      .filter(date => /^\d{8}$/.test(date) && date <= target)
      .sort()
      .at(-1) || null;
  }

  function externalReturn(rows, offset) {
    const valid = Array.isArray(rows)
      ? rows.filter(row => /^\d{8}$/.test(compactDate(row?.date)) && Number.isFinite(Number(row?.close)))
        .sort((left, right) => compactDate(left.date).localeCompare(compactDate(right.date)))
      : [];
    const latest = valid.at(-1);
    const previous = valid.at(-1 - offset);
    if (!latest || !previous || Number(previous.close) === 0) return { change: null, change_pct: null };
    const change = Number(latest.close) - Number(previous.close);
    return { change, change_pct: (change / Number(previous.close)) * 100 };
  }

  function externalOilBenchmarks(payload) {
    const indicators = Array.isArray(payload?.indicators) ? payload.indicators : [];
    return OIL_INDICATORS.map(config => {
      const indicator = indicators.find(item => item?.id === config.sourceId);
      if (!indicator || !Number.isFinite(Number(indicator.close))) return null;
      const one = Number.isFinite(Number(indicator.previous_close)) && Number(indicator.previous_close) !== 0
        ? {
          change: Number(indicator.close) - Number(indicator.previous_close),
          change_pct: Number.isFinite(Number(indicator.change_percent))
            ? Number(indicator.change_percent)
            : ((Number(indicator.close) - Number(indicator.previous_close)) / Number(indicator.previous_close)) * 100,
        }
        : { change: null, change_pct: null };
      const five = externalReturn(indicator.rows, 5);
      const twenty = externalReturn(indicator.rows, 20);
      return {
        id: config.benchmarkId,
        source_indicator_id: config.sourceId,
        symbol: indicator.symbol,
        name: config.name,
        short_name: config.shortName,
        source_name: 'Yahoo Finance / external-market',
        source_url: `https://finance.yahoo.com/quote/${encodeURIComponent(indicator.symbol || '')}`,
        latest_date: compactDate(indicator.market_date),
        latest_iso_date: String(indicator.market_date || '').replace(/^(\d{4})(\d{2})(\d{2})$/, '$1-$2-$3'),
        latest_price: Number(indicator.close),
        previous_date: compactDate(indicator.previous_market_date),
        previous_price: Number.isFinite(Number(indicator.previous_close)) ? Number(indicator.previous_close) : null,
        change: one.change,
        change_pct: one.change_pct,
        change_5d: five.change,
        change_pct_5d: five.change_pct,
        change_20d: twenty.change,
        change_pct_20d: twenty.change_pct,
      };
    }).filter(Boolean);
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
      FILTER_KEY,
      STRATEGY_ID,
      STRATEGY_LABEL,
      isReboundCandidate,
      reboundCandidates,
      selectExternalMarketDate,
      externalOilBenchmarks,
    };
  }

  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  if (window.__predictionDashboardReboundEnhancementInstalled) return;
  window.__predictionDashboardReboundEnhancementInstalled = true;

  const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[char]));
  const finite = value => value !== null && value !== undefined && Number.isFinite(Number(value));
  const formatPct = value => finite(value) ? `${Number(value).toFixed(2)}%` : 'N/A';
  const signed = value => finite(value) ? `${Number(value) >= 0 ? '+' : ''}${Number(value).toFixed(2)}%` : 'NA';
  let lastReadiness = null;
  let oilSourceDate = null;

  function conditionStateClass(condition) {
    if (condition?.status === 'full') return 'readiness-full';
    if (condition?.status === 'partial') return 'readiness-partial';
    if (condition?.status === 'na') return 'readiness-na';
    return 'readiness-none';
  }

  function conditionStateLabel(condition) {
    if (condition?.status === 'full') return '完整符合';
    if (condition?.status === 'partial') return '部分符合';
    if (condition?.status === 'na') return 'N/A';
    return '未符合';
  }

  function probabilityText(readiness) {
    const range = readiness?.probability?.probability_range;
    if (Array.isArray(range) && range.length === 2) return `${range[0]}–${range[1]}%`;
    return readiness?.probability?.label || 'N/A';
  }

  function registerReboundFilter() {
    if (typeof quickFilters === 'undefined' || !quickFilters) return false;
    quickFilters[FILTER_KEY] = {
      label: STRATEGY_LABEL,
      tag: '反彈',
      test: isReboundCandidate,
    };
    return true;
  }

  function isReboundFilterActive() {
    return typeof activeQuickFilter !== 'undefined'
      && typeof activeListView !== 'undefined'
      && activeQuickFilter === FILTER_KEY
      && activeListView === 'stocks';
  }

  function stockListActionHtml() {
    const count = typeof dashboard !== 'undefined' ? reboundCandidates(dashboard).length : 0;
    const active = isReboundFilterActive();
    const buttonLabel = active
      ? '清除反彈清單篩選'
      : count > 0
        ? `查看符合清單（${count.toLocaleString('zh-TW')} 檔）`
        : '目前沒有符合個股';
    return `
      <div class="readiness-actions">
        <div class="readiness-action-summary">
          <b>${STRATEGY_LABEL}</b>
          <span>個股條件與上方市場準備度分開計算；目前 ${count.toLocaleString('zh-TW')} 檔符合。</span>
        </div>
        <button type="button" class="readiness-list-button${active ? ' active' : ''}" data-rebound-stock-list aria-pressed="${active}" ${count === 0 && !active ? 'disabled' : ''}>${buttonLabel}</button>
      </div>`;
  }

  function clearStockControls() {
    for (const id of ['q', 'direction', 'risk', 'industry', 'signal']) {
      const control = document.getElementById(id);
      if (control) control.value = '';
    }
  }

  function bindStockListAction(element) {
    const button = element.querySelector('[data-rebound-stock-list]');
    if (!button || button.disabled) return;
    button.addEventListener('click', () => {
      if (!registerReboundFilter() || typeof setQuickFilter !== 'function') return;
      clearStockControls();
      setQuickFilter(FILTER_KEY);
      window.requestAnimationFrame(() => render(lastReadiness));
    });
  }

  function render(readiness) {
    lastReadiness = readiness;
    registerReboundFilter();
    const element = document.getElementById('oversoldBetaReboundBanner');
    if (!element) return;
    if (!readiness || readiness.calculation_status === 'unable_to_calculate') {
      element.className = 'rebound-readiness-card readiness-unavailable';
      element.innerHTML = `
        <div class="readiness-head"><div><div class="readiness-eyebrow">獨立市場閘門</div><div class="readiness-title">跌深反彈準備度</div></div><div class="readiness-score">N/A</div></div>
        <div class="readiness-message">無法計算</div>
        <div class="readiness-warning">${esc((readiness?.warnings || ['缺少市場反彈準備度資料。']).join('；'))}</div>
        ${stockListActionHtml()}`;
      bindStockListAction(element);
      return;
    }
    const conditions = readiness.conditions || [];
    const probability = probabilityText(readiness);
    const sampleCount = readiness?.probability?.sample_count ?? 0;
    const probabilityMode = readiness?.probability?.mode === 'historical_calibration'
      ? '歷史校準'
      : readiness?.probability?.mode === 'preliminary_calibration'
        ? '初步校準'
        : '啟發式機率區間';
    element.className = `rebound-readiness-card ${readiness.status_code || ''}`;
    element.innerHTML = `
      <div class="readiness-head">
        <div><div class="readiness-eyebrow">獨立市場閘門｜不修改 V1/V2 分數</div><div class="readiness-title">${esc(readiness.label || '跌深反彈準備度')}</div></div>
        <div class="readiness-score">${finite(readiness.score) ? `${readiness.score}/100` : 'N/A'}</div>
      </div>
      <div class="readiness-summary-grid">
        <div><span>狀態</span><b>${esc(readiness.status || 'N/A')}</b></div>
        <div><span>估計機率</span><b>${esc(probability)}</b><small>${esc(probabilityMode)}；樣本 ${sampleCount}</small></div>
        <div><span>訊號資料</span><b>${readiness.available_signals ?? 0}/${readiness.total_signals ?? conditions.length}</b><small>有效權重 ${readiness.effective_data_weight ?? 0}/100</small></div>
        <div><span>市場方向</span><b>${esc(readiness.market_direction || '環境尚未確認')}</b></div>
      </div>
      <div class="readiness-message">${esc(readiness.dashboard_message || '')}</div>
      <div class="readiness-conditions">
        ${conditions.map(item => `
          <div class="readiness-condition ${conditionStateClass(item)}">
            <span class="readiness-dot" aria-hidden="true"></span>
            <div><b>${esc(item.label)}</b><small>${esc(conditionStateLabel(item))}｜${esc(item.value_label ?? item.value ?? 'N/A')}｜${item.points ?? 0}/${item.weight ?? 0} 分${item.note ? `｜${esc(item.note)}` : ''}</small></div>
          </div>`).join('')}
      </div>
      ${(readiness.warnings || []).length ? `<div class="readiness-warning">${esc(readiness.warnings.join('；'))}</div>` : ''}
      ${stockListActionHtml()}`;
    bindStockListAction(element);
  }

  async function loadCanonicalReadiness() {
    const date = String(
      (typeof currentDate !== 'undefined' && currentDate)
      || (typeof dashboard !== 'undefined' && dashboard?.forecast_date)
      || '',
    ).replaceAll('-', '').replaceAll('/', '');
    if (!/^20\d{6}$/.test(date)) return null;
    try {
      const response = await fetch(`../data_market_environment/${date}/oversold_beta_rebound.json`, { cache: 'no-store' });
      return response.ok ? await response.json() : null;
    } catch {
      return null;
    }
  }

  async function load() {
    let attempts = 0;
    while (attempts < 200) {
      attempts += 1;
      if (typeof dashboard !== 'undefined' && dashboard) {
        const canonical = await loadCanonicalReadiness();
        render(canonical || dashboard.market_rebound_readiness || null);
        return;
      }
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    const element = document.getElementById('oversoldBetaReboundBanner');
    if (element) render(null);
  }

  async function fetchJson(file) {
    try {
      const response = await fetch(`../${file}`, { cache: 'no-store' });
      return response.ok ? await response.json() : null;
    } catch {
      return null;
    }
  }

  function decorateOilCard() {
    if (typeof oilPrices === 'undefined' || !oilPrices) return;
    const wti = (oilPrices.benchmarks || []).find(item => item.id === 'wti_spot');
    const brent = (oilPrices.benchmarks || []).find(item => item.id === 'brent_spot');
    const card = [...document.querySelectorAll('.kpi-card')].find(item => item.querySelector('.label')?.textContent === '石油價格' || item.querySelector('.label')?.textContent === '原油期貨');
    if (!card) return;
    const label = card.querySelector('.label');
    const sub = card.querySelector('.sub');
    if (label) label.textContent = '原油期貨';
    if (sub && wti) {
      sub.textContent = `WTI 日 ${signed(wti.change_pct)}；5日 ${signed(wti.change_pct_5d)}；Brent ${finite(brent?.latest_price) ? Number(brent.latest_price).toFixed(2) : 'NA'}；市場日 ${wti.latest_date || 'NA'}；來源 external-market`;
    }
  }

  function installOilRenderDecorator() {
    if (window.__predictionOilRenderDecoratorInstalled || typeof window.renderKpis !== 'function') return;
    const originalRenderKpis = window.renderKpis;
    window.renderKpis = function (...args) {
      const result = originalRenderKpis.apply(this, args);
      decorateOilCard();
      return result;
    };
    window.__predictionOilRenderDecoratorInstalled = true;
  }

  function installOilDetailsView() {
    window.showOilPrices = function () {
      if (typeof activeListView !== 'undefined') activeListView = 'oil';
      if (typeof activeQuickFilter !== 'undefined') activeQuickFilter = '';
      if (typeof selectedConceptId !== 'undefined') selectedConceptId = '';
      if (typeof selectedElectronicsId !== 'undefined') selectedElectronicsId = '';
      if (typeof renderKpis === 'function') renderKpis();
      if (typeof renderConceptRows === 'function') renderConceptRows();
      const controls = document.getElementById('stockControls');
      if (controls) controls.style.display = 'none';
      if (typeof setListTableClass === 'function') setListTableClass();
      const head = document.getElementById('listHead');
      if (head) head.innerHTML = '<tr><th>指標</th><th>實際市場日</th><th>價格</th><th>日漲跌</th><th>5日漲跌</th><th>20日漲跌</th><th>來源</th></tr>';
      const benchmarks = typeof oilPrices !== 'undefined' ? (oilPrices?.benchmarks || []) : [];
      const title = document.getElementById('stockListTitle');
      const note = document.getElementById('filterNote');
      const rows = document.getElementById('stockRows');
      if (title) title.textContent = '原油期貨價格漲跌';
      if (note) note.textContent = benchmarks.length
        ? `canonical source: data_external_market；snapshot ${oilSourceDate || oilPrices?.source_date || 'NA'}；實際市場日 ${[...new Set(benchmarks.map(item => item.latest_date).filter(Boolean))].join('、') || 'NA'}`
        : 'external-market 尚無可顯示的 WTI / Brent futures 資料';
      if (rows) rows.innerHTML = benchmarks.length
        ? benchmarks.map(item => `<tr><td>${esc(item.name)}</td><td>${esc(item.latest_iso_date || item.latest_date || '')}</td><td>${finite(item.latest_price) ? Number(item.latest_price).toFixed(2) : 'NA'}</td><td>${finite(item.change) ? `${Number(item.change) >= 0 ? '+' : ''}${Number(item.change).toFixed(2)}` : 'NA'}（${signed(item.change_pct)}）</td><td>${finite(item.change_5d) ? `${Number(item.change_5d) >= 0 ? '+' : ''}${Number(item.change_5d).toFixed(2)}` : 'NA'}（${signed(item.change_pct_5d)}）</td><td>${finite(item.change_20d) ? `${Number(item.change_20d) >= 0 ? '+' : ''}${Number(item.change_20d).toFixed(2)}` : 'NA'}（${signed(item.change_pct_20d)}）</td><td><a class="link" href="${esc(item.source_url)}" target="_blank" rel="noopener noreferrer">${esc(item.source_name)}</a></td></tr>`).join('')
        : '<tr><td colspan="7">目前沒有可顯示的 WTI / Brent futures external-market 資料</td></tr>';
      document.querySelector('.wide:last-of-type')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };
  }

  async function loadExternalOilData() {
    let attempts = 0;
    while (attempts < 200) {
      attempts += 1;
      if (typeof dashboard !== 'undefined' && dashboard) break;
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    if (typeof dashboard === 'undefined' || !dashboard) return;
    const targetDate = compactDate(dashboard.base_trade_date || dashboard.forecast_date);
    const manifest = await fetchJson('data_external_market/manifest.json');
    const selectedDate = selectExternalMarketDate(manifest?.available_dates, targetDate);
    if (!selectedDate) {
      if (typeof oilPrices !== 'undefined') oilPrices = null;
      return;
    }
    const snapshot = await fetchJson(`data_external_market/${selectedDate}/external_market_indicators.json`);
    const benchmarks = externalOilBenchmarks(snapshot);
    oilSourceDate = selectedDate;
    if (typeof oilPrices !== 'undefined') {
      oilPrices = {
        schemaVersion: 2,
        source: 'data_external_market',
        source_date: selectedDate,
        generated_at: snapshot?.generated_at || null,
        benchmarks,
      };
    }
    installOilRenderDecorator();
    installOilDetailsView();
    if (typeof renderKpis === 'function') renderKpis();
    decorateOilCard();
    if (typeof activeListView !== 'undefined' && activeListView === 'oil') window.showOilPrices();
  }

  const style = document.createElement('style');
  style.id = 'prediction-dashboard-rebound-style';
  style.textContent = `
    .rebound-readiness-card{margin-bottom:14px;border:1px solid #bfdbfe;border-left:6px solid #2563eb;background:#f8fbff;border-radius:8px;padding:16px}.rebound-readiness-card.triggered{border-left-color:#15803d;background:#f6fff9}.rebound-readiness-card.highly_brewing{border-left-color:#65a30d;background:#fbfff4}.rebound-readiness-card.near_formation{border-left-color:#d97706;background:#fffaf2}.rebound-readiness-card.emerging{border-left-color:#ca8a04;background:#fffcf0}.rebound-readiness-card.not_formed,.rebound-readiness-card.readiness-unavailable{border-left-color:#64748b;background:#fff}
    .readiness-head{display:flex;justify-content:space-between;gap:14px;align-items:flex-start;flex-wrap:wrap}.readiness-eyebrow{font-size:12px;font-weight:900;color:#1d4ed8}.readiness-title{font-size:20px;font-weight:900;margin-top:3px}.readiness-score{font-size:28px;font-weight:900;font-variant-numeric:tabular-nums}.readiness-summary-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;margin-top:14px}.readiness-summary-grid>div{border:1px solid #dbeafe;background:#fff;border-radius:7px;padding:11px;min-width:0}.readiness-summary-grid span,.readiness-summary-grid small{display:block;color:#64748b;font-size:12px}.readiness-summary-grid b{display:block;margin-top:4px;font-size:17px;overflow-wrap:anywhere}.readiness-message{margin-top:12px;font-weight:900}.readiness-conditions{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;margin-top:12px}.readiness-condition{display:flex;gap:9px;align-items:flex-start;border:1px solid #e2e8f0;background:#fff;border-radius:7px;padding:9px}.readiness-condition b,.readiness-condition small{display:block}.readiness-condition small{margin-top:3px;color:#64748b;font-size:12px;line-height:1.4}.readiness-dot{width:10px;height:10px;border-radius:50%;margin-top:4px;flex:0 0 auto;background:#94a3b8}.readiness-full .readiness-dot{background:#16a34a}.readiness-partial .readiness-dot{background:#eab308}.readiness-na .readiness-dot{background:#94a3b8}.readiness-none .readiness-dot{background:#cbd5e1}.readiness-warning{margin-top:11px;border-radius:6px;background:#fff7ed;color:#9a3412;padding:8px 10px;font-size:13px;font-weight:800}
    .readiness-actions{display:flex;justify-content:space-between;align-items:center;gap:12px;margin-top:14px;padding-top:14px;border-top:1px solid #dbeafe;flex-wrap:wrap}.readiness-action-summary{min-width:0}.readiness-action-summary b,.readiness-action-summary span{display:block}.readiness-action-summary span{margin-top:3px;color:#64748b;font-size:12px;line-height:1.4}.readiness-list-button{appearance:none;border:1px solid #2563eb;background:#2563eb;color:#fff;border-radius:7px;padding:9px 13px;font:inherit;font-size:13px;font-weight:900;cursor:pointer;white-space:nowrap}.readiness-list-button:hover{background:#1d4ed8}.readiness-list-button.active{background:#fff;color:#1d4ed8}.readiness-list-button:disabled{border-color:#cbd5e1;background:#e2e8f0;color:#64748b;cursor:not-allowed}
    @media(max-width:760px){.readiness-summary-grid,.readiness-conditions{grid-template-columns:1fr 1fr}}@media(max-width:480px){.readiness-summary-grid,.readiness-conditions{grid-template-columns:1fr}.readiness-actions{align-items:stretch}.readiness-list-button{width:100%}}
  `;
  document.head.appendChild(style);
  load().catch(error => {
    console.error('Unable to render oversold beta rebound readiness:', error);
    render(null);
  });
  loadExternalOilData().catch(error => {
    console.error('Unable to load external-market oil data:', error);
  });
})();
