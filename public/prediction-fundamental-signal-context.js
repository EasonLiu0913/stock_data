(() => {
  'use strict';

  const STRATEGY_ID = 'two_stage_fundamental_quality_direct_entry_v1';
  const DISPLAY_LABEL = '財報品質訊號';
  const STYLE_ID = 'fundamentalSignalContextStyle';
  const DASHBOARD_CONTEXT_ID = 'fundamentalSignalDashboardContext';
  const STOCK_SIGNAL_DATE_ID = 'fundamentalSignalDatePill';
  const STOCK_EXECUTION_DATE_ID = 'fundamentalExecutionDatePill';
  const HIGHLIGHTED_GROUPS = new Set([
    '財報品質訊號',
    '跌深反彈電子股',
    '融資退場型跌深反彈',
    '三日突破前兆候選',
    '多日盤整+趨勢轉強',
  ]);

  function esc(value) {
    return String(value ?? '').replace(/[&<>"']/g, char => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }[char]));
  }

  function normalizeIsoDate(value) {
    const digits = String(value || '').replace(/[^0-9]/g, '');
    if (!/^20\d{6}$/.test(digits)) return '';
    return `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6, 8)}`;
  }

  function shortDate(value) {
    const iso = normalizeIsoDate(value);
    return iso ? iso.slice(5).replace('-', '/') : String(value || 'N/A');
  }

  function ensureStyle() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      .fundamental-signal-dashboard-context {
        display: inline-flex;
        gap: 8px;
        align-items: center;
        margin-left: 10px;
        color: #526173;
        font-size: 13px;
        font-weight: 800;
      }
      .fundamental-signal-dashboard-context span {
        display: inline-flex;
        align-items: center;
        padding: 3px 8px;
        border: 1px solid #d7e0ea;
        border-radius: 999px;
        background: #f7f9fc;
        white-space: nowrap;
      }
      #groupRows a.strategy-summary-highlight {
        color: #d97979;
      }
      #groupRows a.strategy-summary-highlight:hover {
        color: #c85f5f;
      }
      @media (max-width: 640px) {
        .fundamental-signal-dashboard-context {
          display: flex;
          margin: 6px 0 0;
          flex-wrap: wrap;
        }
      }
    `;
    document.head.appendChild(style);
  }

  function dashboardPayload() {
    try {
      if (typeof dashboard !== 'undefined' && dashboard) return dashboard;
    } catch {}
    return null;
  }

  function relabelDashboardData(payload) {
    if (!payload) return;
    for (const definition of payload.strategy_registry_v2 || []) {
      if (definition?.strategy_id === STRATEGY_ID) definition.label = DISPLAY_LABEL;
    }
    const classification = payload.strategy_classifications_v2?.[STRATEGY_ID];
    if (classification) classification.label = DISPLAY_LABEL;
    for (const group of payload.group_summary || []) {
      if (group?.strategy_id === STRATEGY_ID) group.group = DISPLAY_LABEL;
    }
  }

  function relabelVisibleStrategy() {
    document.querySelectorAll(`[data-strategy-id="${STRATEGY_ID}"] .tag-strategy-filter-label`)
      .forEach(node => { if (node.textContent !== DISPLAY_LABEL) node.textContent = DISPLAY_LABEL; });
  }

  function highlightStrategySummaryTitles() {
    ensureStyle();
    document.querySelectorAll('#groupRows a.link').forEach(link => {
      const label = String(link.textContent || '').trim();
      link.classList.toggle('strategy-summary-highlight', HIGHLIGHTED_GROUPS.has(label));
    });
  }

  function activeDirectEntryButton() {
    const button = document.querySelector(`[data-strategy-id="${STRATEGY_ID}"]`);
    if (!button || button.disabled) return null;
    return button.classList.contains('active') || button.getAttribute('aria-pressed') === 'true' ? button : null;
  }

  function updateDashboardContext() {
    const payload = dashboardPayload();
    if (!payload) return;
    relabelDashboardData(payload);
    relabelVisibleStrategy();
    highlightStrategySummaryTitles();

    const title = document.getElementById('stockListTitle');
    if (!title) return;
    const existing = document.getElementById(DASHBOARD_CONTEXT_ID);
    if (!activeDirectEntryButton()) {
      existing?.remove();
      return;
    }

    const signalDate = normalizeIsoDate(payload.base_trade_date);
    const executionDate = normalizeIsoDate(payload.forecast_date);
    if (!signalDate || !executionDate) {
      existing?.remove();
      return;
    }

    ensureStyle();
    const context = existing || document.createElement('span');
    context.id = DASHBOARD_CONTEXT_ID;
    context.className = 'fundamental-signal-dashboard-context';
    context.innerHTML = `<span>訊號日 ${esc(shortDate(signalDate))}</span><span>可執行日 ${esc(shortDate(executionDate))}</span>`;
    if (!existing) title.appendChild(context);
  }

  function stockPageParams() {
    const params = new URLSearchParams(location.search);
    return {
      code: String(params.get('code') || '').trim(),
      date: String(params.get('date') || '').replace(/[^0-9]/g, ''),
    };
  }

  function addStockSignalPills(signalDate, executionDate) {
    const pills = document.querySelector('.hero .pills');
    if (!pills) return false;
    const signalIso = normalizeIsoDate(signalDate);
    const executionIso = normalizeIsoDate(executionDate);
    if (!signalIso || !executionIso) return false;

    let signalPill = document.getElementById(STOCK_SIGNAL_DATE_ID);
    if (!signalPill) {
      signalPill = document.createElement('span');
      signalPill.id = STOCK_SIGNAL_DATE_ID;
      signalPill.className = 'pill';
      pills.appendChild(signalPill);
    }
    signalPill.textContent = `訊號日：${signalIso}`;

    let executionPill = document.getElementById(STOCK_EXECUTION_DATE_ID);
    if (!executionPill) {
      executionPill = document.createElement('span');
      executionPill.id = STOCK_EXECUTION_DATE_ID;
      executionPill.className = 'pill';
      pills.appendChild(executionPill);
    }
    executionPill.textContent = `可執行日：${executionIso}`;

    window.fundamentalSignalContext = {
      strategy_id: STRATEGY_ID,
      signal_date: signalIso,
      execution_date: executionIso,
    };
    return true;
  }

  async function installStockContext() {
    if (!/prediction-stock\.html$/.test(location.pathname)) return;
    const { code, date } = stockPageParams();
    if (!code) return;

    let targetDate = date;
    if (!targetDate) {
      try {
        const manifest = await fetch('../data_predictions/manifest.json', { cache: 'no-store' }).then(response => response.json());
        targetDate = String(manifest.latest_date || manifest.forecast_date_compact || '').replace(/[^0-9]/g, '');
      } catch { return; }
    }
    if (!/^20\d{6}$/.test(targetDate)) return;

    try {
      const summaryResponse = await fetch(`../data_predictions/${targetDate}/summary.json`, { cache: 'no-store' });
      if (!summaryResponse.ok) return;
      const summary = await summaryResponse.json();
      const stock = (summary.stocks || []).find(item => String(item.stock_code || '').trim() === code);
      if (!stock) return;
      const matches = (stock.registered_strategy_matches || []).map(item => typeof item === 'string' ? item : item?.strategy_id);
      if (!matches.includes(STRATEGY_ID)) return;

      const features = stock.strategy_tag_features || {};
      const signalDate = features.two_stage_fundamental_signal_date || summary.base_trade_date;
      const executionDate = summary.forecast_date;

      let attempts = 0;
      const timer = setInterval(() => {
        attempts += 1;
        if (addStockSignalPills(signalDate, executionDate) || attempts >= 120) clearInterval(timer);
      }, 50);
    } catch {}
  }

  function installDashboardContext() {
    if (!/prediction-dashboard\.html$/.test(location.pathname)) return;
    let scheduled = false;
    const schedule = () => {
      if (scheduled) return;
      scheduled = true;
      requestAnimationFrame(() => {
        scheduled = false;
        updateDashboardContext();
      });
    };
    const observer = new MutationObserver(schedule);
    observer.observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['class', 'aria-pressed'] });
    document.addEventListener('click', event => {
      if (event.target.closest(`[data-strategy-id="${STRATEGY_ID}"]`) || event.target.closest('[data-clear-tag-strategy]')) {
        setTimeout(schedule, 0);
      }
    });
    schedule();
  }

  installDashboardContext();
  installStockContext();
})();
