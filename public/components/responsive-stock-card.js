(() => {
  'use strict';

  const STYLE_ID = 'responsive-stock-card-styles';

  function ensureStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      .rsc-list:not(.mobile-content){display:grid;gap:12px}
      .rsc-list.mobile-content{gap:12px}
      .rsc-list.mobile-content .rsc-card + .rsc-card{margin-top:12px}
      .rsc-card{background:#fff;border:1px solid #e2e8f0;border-radius:14px;box-shadow:0 8px 24px rgba(15,23,42,.07);overflow:hidden;color:#0f172a}
      .rsc-main{padding:14px}
      .rsc-head{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:10px;align-items:start}
      .rsc-symbol{display:flex;align-items:baseline;gap:7px;min-width:0}
      .rsc-name{font-size:1.05rem;font-weight:850;line-height:1.25;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
      .rsc-code{font-size:.78rem;font-weight:750;color:#64748b;font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace}
      .rsc-change{font-size:1.05rem;font-weight:900;line-height:1.2;white-space:nowrap}
      .rsc-change.is-up{color:#dc2626}.rsc-change.is-down{color:#15803d}.rsc-change.is-flat{color:#475569}
      .rsc-badges{display:flex;gap:6px;flex-wrap:wrap;margin-top:8px}
      .rsc-badge{display:inline-flex;align-items:center;min-height:26px;padding:3px 8px;border-radius:999px;font-size:.72rem;font-weight:800;border:1px solid transparent;line-height:1.2}
      .rsc-badge.is-bullish{background:#fef2f2;color:#b91c1c;border-color:#fecaca}
      .rsc-badge.is-neutral{background:#f8fafc;color:#475569;border-color:#e2e8f0}
      .rsc-badge.is-cautious{background:#fffbeb;color:#a16207;border-color:#fde68a}
      .rsc-badge.is-bearish{background:#f0fdf4;color:#166534;border-color:#bbf7d0}
      .rsc-badge.is-verified{background:#eff6ff;color:#1d4ed8;border-color:#bfdbfe}
      .rsc-badge.is-pending{background:#fff7ed;color:#c2410c;border-color:#fed7aa}
      .rsc-badge.is-inconclusive{background:#faf5ff;color:#7e22ce;border-color:#e9d5ff}
      .rsc-summary{margin-top:12px;padding:10px 11px;border-radius:10px;background:#f8fafc;border:1px solid #e2e8f0}
      .rsc-summary-title{font-size:.72rem;font-weight:850;color:#64748b;margin-bottom:4px;text-transform:uppercase;letter-spacing:.02em}
      .rsc-summary-text{font-size:.91rem;font-weight:700;line-height:1.55;color:#1e293b;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden}
      .rsc-metrics{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;margin-top:10px}
      .rsc-metric{min-width:0;padding:9px 10px;border-radius:10px;background:#fff;border:1px solid #e2e8f0}
      .rsc-metric-label{display:block;font-size:.7rem;color:#64748b;font-weight:800;margin-bottom:3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      .rsc-metric-value{display:block;font-size:.92rem;font-weight:900;line-height:1.25;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      .rsc-metric-sub{display:block;margin-top:3px;font-size:.68rem;line-height:1.3;color:#64748b;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      .rsc-metric-sub.is-warning{color:#c2410c;font-weight:800}.rsc-metric-sub.is-ok{color:#1d4ed8;font-weight:800}
      .rsc-toggle{width:100%;border:0;border-top:1px solid #e2e8f0;background:#fff;color:#334155;padding:11px 14px;font:inherit;font-size:.82rem;font-weight:850;cursor:pointer;display:flex;align-items:center;justify-content:space-between;gap:8px}
      .rsc-toggle:hover{background:#f8fafc}.rsc-toggle:focus-visible{outline:3px solid rgba(37,99,235,.18);outline-offset:-3px}
      .rsc-chevron{transition:transform .18s ease}.rsc-card.is-open .rsc-chevron{transform:rotate(180deg)}
      .rsc-detail{display:none;padding:0 14px 14px;background:#f8fafc;border-top:1px solid #e2e8f0}.rsc-card.is-open .rsc-detail{display:block}
      .rsc-section{padding-top:12px}.rsc-section h4{font-size:.78rem;margin:0 0 6px;color:#334155}.rsc-section ul{margin:0;padding-left:18px;color:#475569}.rsc-section li{font-size:.81rem;line-height:1.55;margin:3px 0}
      .rsc-verification{margin-top:10px;padding:10px;border-radius:10px;background:#fff;border:1px solid #e2e8f0;font-size:.8rem;line-height:1.5;color:#475569}
      .rsc-sources{margin-top:6px;display:grid;gap:4px}.rsc-source{color:#2563eb;text-decoration:none;font-weight:750}.rsc-source:hover{text-decoration:underline}
      @media (min-width:420px) and (max-width:476px){.rsc-metrics{grid-template-columns:repeat(3,minmax(0,1fr))}}
      @media (max-width:359px){.rsc-main{padding:12px}.rsc-name{font-size:.98rem}.rsc-change{font-size:.98rem}.rsc-metric{padding:8px}.rsc-summary-text{font-size:.86rem}}
      @media (min-width:477px){.rsc-card{border-radius:12px}.rsc-metrics{grid-template-columns:repeat(auto-fit,minmax(130px,1fr))}}
    `;
    document.head.appendChild(style);
  }

  function esc(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/\"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function formatSigned(value, suffix = '') {
    const n = Number(value);
    if (!Number.isFinite(n)) return '—';
    const sign = n > 0 ? '+' : '';
    return `${sign}${n.toLocaleString('zh-TW')}${suffix}`;
  }

  function metricMarkup(metric) {
    const subClass = metric.statusTone === 'warning' ? ' is-warning' : metric.statusTone === 'ok' ? ' is-ok' : '';
    return `<div class="rsc-metric">
      <span class="rsc-metric-label">${esc(metric.label)}</span>
      <span class="rsc-metric-value">${esc(metric.value ?? '—')}</span>
      ${metric.sub ? `<span class="rsc-metric-sub${subClass}">${esc(metric.sub)}</span>` : ''}
    </div>`;
  }

  function listSection(title, items) {
    if (!Array.isArray(items) || !items.length) return '';
    return `<section class="rsc-section"><h4>${esc(title)}</h4><ul>${items.map(item => `<li>${esc(item)}</li>`).join('')}</ul></section>`;
  }

  function verificationBadge(status) {
    const map = {
      verified: ['已網路驗證', 'is-verified'],
      pending_publication: ['待資料公布', 'is-pending'],
      inconclusive: ['資料待釐清', 'is-inconclusive'],
      not_required: ['資料完整', 'is-verified']
    };
    return map[status] || [status || '未標記', 'is-neutral'];
  }

  function institutionalMetric(label, actor = {}) {
    const status = actor.record_status || 'unavailable';
    let sub = status;
    let tone = '';
    if (status === 'reported') sub = '官方有紀錄';
    else if (status === 'zero_net') { sub = '淨額為 0 · 需查證'; tone = 'warning'; }
    else if (status === 'no_record') { sub = '官方表無此股 · 需查證'; tone = 'warning'; }
    else if (status === 'unavailable') { sub = '來源未就緒'; tone = 'warning'; }
    return {
      label,
      value: actor.net_lots === null || actor.net_lots === undefined ? '—' : formatSigned(actor.net_lots, ' 張'),
      sub,
      statusTone: tone
    };
  }

  function createCard(data = {}, options = {}) {
    ensureStyles();
    const change = Number(data.changePct);
    const changeClass = !Number.isFinite(change) || change === 0 ? 'is-flat' : change > 0 ? 'is-up' : 'is-down';
    const bias = data.continuationBias || 'neutral';
    const biasLabel = options.biasLabels?.[bias] || ({ bullish:'偏多觀察', neutral:'中性', cautious:'謹慎', bearish:'偏空' }[bias] || bias);
    const [verifyLabel, verifyClass] = verificationBadge(data.verification?.status);
    const metrics = Array.isArray(data.metrics) && data.metrics.length ? data.metrics : [
      institutionalMetric('外資', data.institutional?.foreign),
      institutionalMetric('投信', data.institutional?.trust),
      institutionalMetric('自營商', data.institutional?.dealer),
      { label:'融資變化', value:data.marginDelta === null || data.marginDelta === undefined ? '—' : formatSigned(data.marginDelta, ' 張') },
      { label:'Top5 買方集中', value:data.top5BuySharePct === null || data.top5BuySharePct === undefined ? '—' : `${Number(data.top5BuySharePct).toFixed(1)}%` },
      { label:'成交量', value:data.volume === null || data.volume === undefined ? '—' : `${Number(data.volume).toLocaleString('zh-TW')} 張` }
    ];

    const card = document.createElement('article');
    card.className = 'rsc-card';
    card.dataset.code = data.code || '';
    card.innerHTML = `
      <div class="rsc-main">
        <div class="rsc-head">
          <div>
            <div class="rsc-symbol"><span class="rsc-name">${esc(data.name || '')}</span><span class="rsc-code">${esc(data.code || '')}</span></div>
            <div class="rsc-badges">
              <span class="rsc-badge is-${esc(bias)}">${esc(biasLabel)}</span>
              ${data.confidence ? `<span class="rsc-badge is-neutral">${esc(String(data.confidence).toUpperCase())} 信心</span>` : ''}
              <span class="rsc-badge ${verifyClass}">${esc(verifyLabel)}</span>
            </div>
          </div>
          <div class="rsc-change ${changeClass}">${Number.isFinite(change) ? `${change > 0 ? '+' : ''}${change.toFixed(2)}%` : '—'}</div>
        </div>
        <div class="rsc-summary">
          <div class="rsc-summary-title">AI 綜合判讀</div>
          <div class="rsc-summary-text">${esc(data.summary || '尚無 AI 摘要')}</div>
        </div>
        <div class="rsc-metrics">${metrics.map(metricMarkup).join('')}</div>
      </div>
      <button class="rsc-toggle" type="button" aria-expanded="false">
        <span>展開完整分析</span><span class="rsc-chevron" aria-hidden="true">⌄</span>
      </button>
      <div class="rsc-detail">
        ${listSection('支持訊號', data.supportingSignals)}
        ${listSection('矛盾訊號', data.conflictingSignals)}
        ${listSection('風險', data.risks)}
        ${listSection('後續觀察', data.followUp)}
        ${data.verification ? `<div class="rsc-verification"><strong>法人資料查證：</strong>${esc(data.verification.summary || verifyLabel)}${Array.isArray(data.verification.sources) && data.verification.sources.length ? `<div class="rsc-sources">${data.verification.sources.map(source => source.url ? `<a class="rsc-source" href="${esc(source.url)}" target="_blank" rel="noopener noreferrer">${esc(source.title || source.url)}</a>` : `<span>${esc(source.title || '')}</span>`).join('')}</div>` : ''}</div>` : ''}
      </div>`;

    const toggle = card.querySelector('.rsc-toggle');
    toggle.addEventListener('click', () => {
      const open = card.classList.toggle('is-open');
      toggle.setAttribute('aria-expanded', String(open));
      toggle.querySelector('span:first-child').textContent = open ? '收合完整分析' : '展開完整分析';
    });
    return card;
  }

  function render(container, rows, options = {}) {
    ensureStyles();
    const root = typeof container === 'string' ? document.querySelector(container) : container;
    if (!root) throw new Error('ResponsiveStockCard.render: container not found');
    root.classList.add('rsc-list');
    root.replaceChildren(...(rows || []).map(row => createCard(row, options)));
    return root;
  }

  window.ResponsiveStockCard = { createCard, render, institutionalMetric, formatSigned };
})();
