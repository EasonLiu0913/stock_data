(() => {
  if (window.__predictionDashboardReboundEnhancementInstalled) return;
  window.__predictionDashboardReboundEnhancementInstalled = true;

  const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[char]));
  const finite = value => value !== null && value !== undefined && Number.isFinite(Number(value));
  const formatPct = value => finite(value) ? `${Number(value).toFixed(2)}%` : 'N/A';

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

  function render(readiness) {
    const element = document.getElementById('oversoldBetaReboundBanner');
    if (!element) return;
    if (!readiness || readiness.calculation_status === 'unable_to_calculate') {
      element.className = 'rebound-readiness-card readiness-unavailable';
      element.innerHTML = `
        <div class="readiness-head"><div><div class="readiness-eyebrow">獨立市場閘門</div><div class="readiness-title">跌深反彈準備度</div></div><div class="readiness-score">N/A</div></div>
        <div class="readiness-message">無法計算</div>
        <div class="readiness-warning">${esc((readiness?.warnings || ['缺少市場反彈準備度資料。']).join('；'))}</div>`;
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
      ${(readiness.warnings || []).length ? `<div class="readiness-warning">${esc(readiness.warnings.join('；'))}</div>` : ''}`;
  }

  async function load() {
    let attempts = 0;
    while (attempts < 200) {
      attempts += 1;
      if (typeof dashboard !== 'undefined' && dashboard?.market_rebound_readiness) {
        render(dashboard.market_rebound_readiness);
        return;
      }
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    const element = document.getElementById('oversoldBetaReboundBanner');
    if (element) render(null);
  }

  const style = document.createElement('style');
  style.id = 'prediction-dashboard-rebound-style';
  style.textContent = `
    .rebound-readiness-card{margin-bottom:14px;border:1px solid #bfdbfe;border-left:6px solid #2563eb;background:#f8fbff;border-radius:8px;padding:16px}.rebound-readiness-card.triggered{border-left-color:#15803d;background:#f6fff9}.rebound-readiness-card.highly_brewing{border-left-color:#65a30d;background:#fbfff4}.rebound-readiness-card.near_formation{border-left-color:#d97706;background:#fffaf2}.rebound-readiness-card.emerging{border-left-color:#ca8a04;background:#fffcf0}.rebound-readiness-card.not_formed,.rebound-readiness-card.readiness-unavailable{border-left-color:#64748b;background:#fff}
    .readiness-head{display:flex;justify-content:space-between;gap:14px;align-items:flex-start;flex-wrap:wrap}.readiness-eyebrow{font-size:12px;font-weight:900;color:#1d4ed8}.readiness-title{font-size:20px;font-weight:900;margin-top:3px}.readiness-score{font-size:28px;font-weight:900;font-variant-numeric:tabular-nums}.readiness-summary-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;margin-top:14px}.readiness-summary-grid>div{border:1px solid #dbeafe;background:#fff;border-radius:7px;padding:11px;min-width:0}.readiness-summary-grid span,.readiness-summary-grid small{display:block;color:#64748b;font-size:12px}.readiness-summary-grid b{display:block;margin-top:4px;font-size:17px;overflow-wrap:anywhere}.readiness-message{margin-top:12px;font-weight:900}.readiness-conditions{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;margin-top:12px}.readiness-condition{display:flex;gap:9px;align-items:flex-start;border:1px solid #e2e8f0;background:#fff;border-radius:7px;padding:9px}.readiness-condition b,.readiness-condition small{display:block}.readiness-condition small{margin-top:3px;color:#64748b;font-size:12px;line-height:1.4}.readiness-dot{width:10px;height:10px;border-radius:50%;margin-top:4px;flex:0 0 auto;background:#94a3b8}.readiness-full .readiness-dot{background:#16a34a}.readiness-partial .readiness-dot{background:#eab308}.readiness-na .readiness-dot{background:#94a3b8}.readiness-none .readiness-dot{background:#cbd5e1}.readiness-warning{margin-top:11px;border-radius:6px;background:#fff7ed;color:#9a3412;padding:8px 10px;font-size:13px;font-weight:800}
    @media(max-width:760px){.readiness-summary-grid,.readiness-conditions{grid-template-columns:1fr 1fr}}@media(max-width:480px){.readiness-summary-grid,.readiness-conditions{grid-template-columns:1fr}}
  `;
  document.head.appendChild(style);
  load().catch(error => {
    console.error('Unable to render oversold beta rebound readiness:', error);
    render(null);
  });
})();
