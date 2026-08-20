(() => {
  'use strict';

  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  if (window.PredictionDashboardMobileCards) return;

  const MOBILE_MAX_WIDTH = 476;
  const CONTAINER_ID = 'predictionMobileStockCards';
  const STYLE_ID = 'prediction-dashboard-mobile-card-styles';

  const finite = value => value !== null && value !== undefined && Number.isFinite(Number(value));
  const fmt = value => finite(value) ? Number(value).toFixed(2) : 'NA';
  const pct = value => finite(value) ? `${Number(value).toFixed(1)}%` : 'NA';

  function ensureStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      #${CONTAINER_ID}{display:none;margin-top:10px}
      .prediction-mobile-actions{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:12px}
      .prediction-mobile-action{display:flex;align-items:center;justify-content:center;min-height:40px;border-radius:9px;border:1px solid #cbd5e1;background:#fff;color:#1d5f99;text-decoration:none;font-size:.82rem;font-weight:850}
      .prediction-mobile-action.primary{border-color:#2563eb;background:#2563eb;color:#fff}
      .prediction-mobile-action:focus-visible{outline:3px solid rgba(37,99,235,.18);outline-offset:2px}
      .prediction-mobile-meta{margin-top:8px;color:#64748b;font-size:.76rem;font-weight:750;line-height:1.45}
      #${CONTAINER_ID} .rsc-summary-title{text-transform:none;letter-spacing:0}
      #${CONTAINER_ID} .rsc-summary-text{-webkit-line-clamp:2}
      #${CONTAINER_ID} .rsc-card .prediction-risk-badge{background:#fff7ed;color:#9a3412;border-color:#fed7aa}
      #${CONTAINER_ID} .rsc-card .prediction-completeness-badge{background:#f8fafc;color:#475569;border-color:#e2e8f0}
      @media(max-width:${MOBILE_MAX_WIDTH}px){
        body.prediction-mobile-stock-view .prediction-stock-table-wrap{display:none!important}
        body.prediction-mobile-stock-view #${CONTAINER_ID}{display:block}
      }
    `;
    document.head.appendChild(style);
  }

  function getStockTableWrap() {
    const head = document.getElementById('listHead');
    return head?.closest('.table-wrap') || null;
  }

  function ensureContainer() {
    ensureStyles();
    let container = document.getElementById(CONTAINER_ID);
    if (container) return container;
    const tableWrap = getStockTableWrap();
    if (!tableWrap) return null;
    tableWrap.classList.add('prediction-stock-table-wrap');
    container = document.createElement('section');
    container.id = CONTAINER_ID;
    container.setAttribute('aria-label', '股票清單手機卡片');
    tableWrap.insertAdjacentElement('afterend', container);
    return container;
  }

  function currentStockView() {
    try {
      return typeof activeListView === 'undefined' || activeListView === 'stocks';
    } catch {
      return true;
    }
  }

  function stockMap() {
    try {
      return new Map((dashboard?.stocks || []).map(stock => [String(stock.stock_code), stock]));
    } catch {
      return new Map();
    }
  }

  function codesFromRenderedTable() {
    const body = document.getElementById('stockRows');
    if (!body) return [];
    const codes = [];
    body.querySelectorAll('tr').forEach(row => {
      const yahoo = [...row.querySelectorAll('a[href]')].find(link => /\/quote\/[^/]+\.TW\//.test(link.getAttribute('href') || ''));
      const match = (yahoo?.getAttribute('href') || '').match(/\/quote\/([^/.]+)\.TW\//);
      if (match?.[1]) codes.push(match[1]);
    });
    return codes;
  }

  function toneFromDirection(value) {
    const text = String(value || '');
    if (text.includes('偏多')) return 'bullish';
    if (text.includes('偏空')) return 'bearish';
    if (text.includes('風險') || text.includes('謹慎')) return 'cautious';
    return 'neutral';
  }

  function reportHref(stock) {
    return stock?.report_file || '#';
  }

  function yahooHref(stock) {
    return `https://tw.stock.yahoo.com/quote/${encodeURIComponent(stock?.stock_code || '')}.TW/technical-analysis`;
  }

  function baseCloseText(stock) {
    try {
      if (typeof closeWithChange === 'function') return closeWithChange(stock);
    } catch {}
    return 'NA';
  }

  function buildCardData(stock) {
    const features = stock?.features || {};
    const relative = stock?.relative_strength_7d || {};
    const signals = stock?.reversal_signals?.tags || [];
    return {
      code: String(stock?.stock_code || ''),
      name: stock?.stock_name || '',
      changePct: finite(features.r1) ? Number(features.r1) : null,
      continuationBias: toneFromDirection(stock?.final_direction_label),
      summary: `${stock?.industry || '產業未分類'}｜${stock?.final_direction_label || '方向未定'}｜籌碼 ${stock?.chip_bias || 'NA'}`,
      metrics: [
        { label: '預測分數', value: finite(stock?.direction_score) ? String(stock.direction_score) : 'NA' },
        { label: '7日 RS', value: fmt(relative?.relative_strength_7d), sub: relative?.relative_strength_mode || 'NA' },
        { label: 'RSI', value: fmt(features?.rsi14) },
        { label: '量比', value: fmt(features?.volume_ratio_1d) },
        { label: 'r3', value: fmt(features?.r3) },
        { label: '完整度', value: pct(stock?.data_completeness) },
      ],
      supportingSignals: [
        `產業：${stock?.industry || 'NA'}`,
        `前收盤價（漲跌）：${baseCloseText(stock)}`,
        `籌碼：${stock?.chip_bias || 'NA'}`,
        `RS 型態：${relative?.relative_strength_mode || 'NA'}`,
      ],
      conflictingSignals: [],
      risks: [stock?.risk_label ? `個股風險：${stock.risk_label}` : '個股風險：NA'],
      followUp: [signals.length ? `翻轉訊號：${signals.join('、')}` : '翻轉訊號：目前沒有'],
      verification: { status: 'not_required', summary: '', sources: [] },
    };
  }

  function renameDetailSections(card) {
    card.querySelectorAll('.rsc-section h4').forEach(title => {
      if (title.textContent.trim() === '支持訊號') title.textContent = '完整指標';
      if (title.textContent.trim() === '後續觀察') title.textContent = '翻轉訊號';
    });
  }

  function decorateCard(card, stock) {
    const summaryTitle = card.querySelector('.rsc-summary-title');
    if (summaryTitle) summaryTitle.textContent = '預測摘要';

    const verificationBadge = [...card.querySelectorAll('.rsc-badge')].find(node => node.textContent.trim() === '資料完整');
    verificationBadge?.remove();
    card.querySelector('.rsc-verification')?.remove();
    renameDetailSections(card);

    const badges = card.querySelector('.rsc-badges');
    if (badges) {
      const risk = document.createElement('span');
      risk.className = 'rsc-badge prediction-risk-badge';
      risk.textContent = stock?.risk_label || '風險 NA';
      badges.appendChild(risk);

      const completeness = document.createElement('span');
      completeness.className = 'rsc-badge prediction-completeness-badge';
      completeness.textContent = `完整度 ${pct(stock?.data_completeness)}`;
      badges.appendChild(completeness);
    }

    const detail = card.querySelector('.rsc-detail');
    if (detail) {
      const actions = document.createElement('div');
      actions.className = 'prediction-mobile-actions';
      actions.innerHTML = `
        <a class="prediction-mobile-action primary" href="${reportHref(stock)}">查看個股報告</a>
        <a class="prediction-mobile-action" href="${yahooHref(stock)}" target="_blank" rel="noopener noreferrer">Yahoo 技術分析</a>`;
      detail.appendChild(actions);
    }
    return card;
  }

  function render() {
    const container = ensureContainer();
    if (!container) return;

    if (!currentStockView()) {
      document.body.classList.remove('prediction-mobile-stock-view');
      container.replaceChildren();
      return;
    }

    document.body.classList.add('prediction-mobile-stock-view');
    if (!window.ResponsiveStockCard) {
      container.innerHTML = '<div class="prediction-mobile-meta">手機卡片元件尚未載入。</div>';
      return;
    }

    const byCode = stockMap();
    const stocks = codesFromRenderedTable().map(code => byCode.get(String(code))).filter(Boolean);
    if (!stocks.length) {
      container.innerHTML = '<div class="prediction-mobile-meta">目前篩選條件沒有可顯示的股票。</div>';
      return;
    }

    container.classList.add('rsc-list');
    const cards = stocks.map(stock => decorateCard(window.ResponsiveStockCard.createCard(buildCardData(stock), {
      biasLabels: {
        bullish: stock.final_direction_label || '偏多',
        bearish: stock.final_direction_label || '偏空',
        neutral: stock.final_direction_label || '中性',
        cautious: stock.final_direction_label || '謹慎',
      },
    }), stock));
    container.replaceChildren(...cards);
  }

  let observer = null;
  function install() {
    const rows = document.getElementById('stockRows');
    if (!rows) return false;
    ensureContainer();
    observer?.disconnect();
    observer = new MutationObserver(() => window.requestAnimationFrame(render));
    observer.observe(rows, { childList: true, subtree: true });
    window.addEventListener('resize', () => {
      if (window.innerWidth <= MOBILE_MAX_WIDTH) window.requestAnimationFrame(render);
    }, { passive: true });
    render();
    return true;
  }

  window.PredictionDashboardMobileCards = { install, render, buildCardData, codesFromRenderedTable };
})();
