(() => {
  if (window.__replayFormalStrategyEnhancementInstalled) return;
  window.__replayFormalStrategyEnhancementInstalled = true;

  const DEFINITIONS = [
    {
      strategyId: 'bear_market_defensive_resilience_v1',
      legacyIds: ['post_shock_high_confidence_core_v1'],
      label: '熊市時防禦抗跌股',
      legacyLabels: ['衝擊後高信心核心'],
      target: 'relative_leadership',
      targetLabel: '收盤後是否成為相對領漲股',
    },
    {
      strategyId: 'oversold_electronics_rebound_v1',
      legacyIds: [],
      label: '跌深反彈電子股',
      legacyLabels: [],
      target: 'close_return_gt_5',
      targetLabel: '當日收盤報酬嚴格大於 5.00%',
    },
  ];
  const selectionMembers = new Map();

  const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[char]));
  const finite = value => value !== null && value !== undefined && Number.isFinite(Number(value));
  const formatPct = value => finite(value) ? `${Number(value).toFixed(2)}%` : 'N/A';
  const formatNumber = value => finite(value) ? Number(value).toFixed(2) : 'N/A';

  async function fetchJson(path) {
    const response = await fetch(`../${path}`, { cache: 'no-store' });
    if (!response.ok) throw new Error(`找不到 ${path}`);
    return response.json();
  }

  function metadataFor(stock, definition) {
    return stock?.formal_market_strategies?.[definition.strategyId]
      || ([definition.strategyId, ...definition.legacyIds].includes(stock?.formal_market_strategy?.strategy_id)
        ? stock.formal_market_strategy
        : null);
  }

  function isCandidate(stock, definition) {
    const ids = [definition.strategyId, ...definition.legacyIds];
    const labels = [definition.label, ...definition.legacyLabels];
    return ids.includes(stock?.formal_market_strategy?.strategy_id)
      || ids.some(id => Boolean(stock?.formal_market_strategies?.[id]))
      || labels.some(label => (stock?.strategy_tags || []).includes(label));
  }

  function actualReturn(row) {
    const value = Number(row?.actual?.close_return);
    return Number.isFinite(value) ? value : null;
  }

  function computeStrategyEvaluation(predictionSummary, definition, actualEnvironment) {
    const candidates = (predictionSummary.stocks || []).filter(stock => isCandidate(stock, definition));
    const replayByCode = new Map(
      (state.rows || []).filter(row => row?.verified).map(row => [String(row.stock_code), row]),
    );
    const marketReturn = Number(actualEnvironment?.actual_environment?.metrics?.equal_weight_market_return);
    const stocks = candidates.map(stock => {
      const code = String(stock.stock_code);
      const replay = replayByCode.get(code) || null;
      const closeReturn = actualReturn(replay);
      const metadata = metadataFor(stock, definition);
      const hit = definition.target === 'relative_leadership'
        ? (replay ? replay?.market_relative?.classification === 'relative_leadership' : null)
        : (Number.isFinite(closeReturn) ? closeReturn > 5 : null);
      return {
        stock_code: code,
        stock_name: stock.stock_name || replay?.stock_name || '',
        verified: definition.target === 'relative_leadership' ? Boolean(replay) : Boolean(replay && Number.isFinite(closeReturn)),
        hit,
        close_return: closeReturn,
        market_excess_return: Number.isFinite(closeReturn) && Number.isFinite(marketReturn) ? closeReturn - marketReturn : null,
        candidate_score: metadata?.candidate_score ?? null,
      };
    });
    const verified = stocks.filter(stock => stock.verified);
    const hits = verified.filter(stock => stock.hit === true);
    const misses = verified.filter(stock => stock.hit === false);
    const returns = verified.map(stock => stock.close_return).filter(Number.isFinite);
    const excess = verified.map(stock => stock.market_excess_return).filter(Number.isFinite);
    const sortedReturns = [...returns].sort((a, b) => a - b);
    const median = sortedReturns.length
      ? (sortedReturns.length % 2
        ? sortedReturns[Math.floor(sortedReturns.length / 2)]
        : (sortedReturns[sortedReturns.length / 2 - 1] + sortedReturns[sortedReturns.length / 2]) / 2)
      : null;
    return {
      ...definition,
      candidates: stocks.length,
      verifiedCandidates: verified.length,
      hits: hits.length,
      hitRate: verified.length ? hits.length / verified.length * 100 : null,
      missingReplayCandidates: stocks.length - verified.length,
      averageReturn: returns.length ? returns.reduce((sum, value) => sum + value, 0) / returns.length : null,
      medianReturn: median,
      averageMarketExcessReturn: excess.length ? excess.reduce((sum, value) => sum + value, 0) / excess.length : null,
      members: stocks.map(stock => stock.stock_code),
      hitMembers: hits.map(stock => stock.stock_code),
      missMembers: misses.map(stock => stock.stock_code),
      stocks,
    };
  }

  function computeReadinessEvaluation(predictionSummary, actualEnvironment) {
    const readiness = predictionSummary.market_rebound_readiness || {};
    const equalWeightReturn = Number(actualEnvironment?.actual_environment?.metrics?.equal_weight_market_return);
    const upRatio = Number(actualEnvironment?.actual_environment?.metrics?.up_ratio);
    const verified = Number.isFinite(equalWeightReturn) && Number.isFinite(upRatio);
    return {
      label: readiness.label || '跌深反彈準備度',
      score: readiness.score ?? null,
      status: readiness.status || 'N/A',
      probability: readiness.probability?.probability_range || null,
      probabilityLabel: readiness.probability?.label || 'N/A',
      effectiveWeight: readiness.effective_data_weight ?? null,
      sampleCount: readiness.probability?.sample_count ?? 0,
      verified,
      hit: verified ? equalWeightReturn >= 2 && upRatio >= 65 : null,
      equalWeightReturn: verified ? equalWeightReturn : null,
      upRatio: verified ? upRatio : null,
    };
  }

  function installSelectionSupport() {
    if (typeof rowMatchesSelection !== 'function' || window.__formalStrategySelectionSupportInstalled) return;
    const originalRowMatchesSelection = rowMatchesSelection;
    rowMatchesSelection = function enhancedRowMatchesSelection(row, selection) {
      if (selection?.kind === 'registered_strategy_scope') {
        const key = `${selection.value}:${selection.direction}`;
        return row?.verified && selectionMembers.get(key)?.has(String(row?.stock_code ?? ''));
      }
      return originalRowMatchesSelection(row, selection);
    };
    window.__formalStrategySelectionSupportInstalled = true;
  }

  function memberText(evaluation, members) {
    if (!members.length) return '無';
    const byCode = new Map(evaluation.stocks.map(stock => [stock.stock_code, stock]));
    return members.map(code => {
      const stock = byCode.get(String(code));
      return stock?.stock_name ? `${stock.stock_name} ${code}` : code;
    }).join('、');
  }

  function readinessHtml(readiness) {
    const result = readiness.verified ? (readiness.hit ? '命中' : '未命中') : '無法覆盤';
    const resultClass = readiness.hit === true ? 'strategy-good' : readiness.hit === false ? 'strategy-bad' : '';
    return `
      <div class="readiness-replay-card">
        <div class="formal-strategy-head">
          <div><div class="formal-strategy-badge">市場閘門覆盤</div><h2 style="margin-top:8px">${esc(readiness.label)}</h2></div>
          <div class="strategy-result ${resultClass}">${esc(result)}</div>
        </div>
        <div class="formal-strategy-kpis">
          <div class="formal-strategy-kpi"><span>事前分數</span><b>${finite(readiness.score) ? `${readiness.score}/100` : 'N/A'}</b></div>
          <div class="formal-strategy-kpi"><span>事前狀態</span><b class="compact-value">${esc(readiness.status)}</b></div>
          <div class="formal-strategy-kpi"><span>等權重報酬</span><b>${formatPct(readiness.equalWeightReturn)}</b></div>
          <div class="formal-strategy-kpi"><span>上漲家數比例</span><b>${formatPct(readiness.upRatio)}</b></div>
        </div>
        <div class="case-summary">命中標準：次日全市場等權重報酬 ≥ +2%，且上漲家數比例 ≥ 65%。事前機率：${esc(readiness.probability || readiness.probabilityLabel)}；樣本數 ${readiness.sampleCount}。</div>
      </div>`;
  }

  function strategyHtml(evaluation) {
    const isOversold = evaluation.target === 'close_return_gt_5';
    const extraKpis = isOversold
      ? `<div class="formal-strategy-kpi"><span>平均報酬</span><b>${formatPct(evaluation.averageReturn)}</b></div>
         <div class="formal-strategy-kpi"><span>報酬中位數</span><b>${formatPct(evaluation.medianReturn)}</b></div>
         <div class="formal-strategy-kpi"><span>平均市場超額</span><b>${formatPct(evaluation.averageMarketExcessReturn)}</b></div>`
      : '';
    return `
      <article class="registered-strategy-card" data-strategy-card="${esc(evaluation.strategyId)}">
        <div class="formal-strategy-head">
          <div>
            <div class="formal-strategy-badge">固定策略覆盤</div>
            <h2 style="margin-top:8px">${esc(evaluation.label)}</h2>
            <p class="strategy-description">評估目標：${esc(evaluation.targetLabel)}。候選資格只讀取預測時標籤，不使用收盤資料重新篩選。</p>
          </div>
        </div>
        <div class="formal-strategy-kpis ${isOversold ? 'strategy-kpis-wide' : ''}">
          <div class="formal-strategy-kpi"><span>事前候選</span><b>${evaluation.candidates}</b></div>
          <div class="formal-strategy-kpi"><span>有效覆盤</span><b>${evaluation.verifiedCandidates}</b></div>
          <div class="formal-strategy-kpi"><span>${isOversold ? '漲幅 >5% 命中' : '相對領漲命中'}</span><b>${evaluation.hits}</b></div>
          <div class="formal-strategy-kpi"><span>命中率</span><b>${formatPct(evaluation.hitRate)}</b></div>
          ${extraKpis}
        </div>
        <div class="formal-strategy-actions">
          <button type="button" class="formal-strategy-action" data-strategy="${esc(evaluation.strategyId)}" data-scope="candidates" ${evaluation.verifiedCandidates ? '' : 'disabled'}>查看有效候選（${evaluation.verifiedCandidates}）</button>
          <button type="button" class="formal-strategy-action" data-strategy="${esc(evaluation.strategyId)}" data-scope="hits" ${evaluation.hits ? '' : 'disabled'}>查看命中（${evaluation.hits}）</button>
          ${isOversold ? `<button type="button" class="formal-strategy-action" data-strategy="${esc(evaluation.strategyId)}" data-scope="misses" ${evaluation.missMembers.length ? '' : 'disabled'}>查看未命中（${evaluation.missMembers.length}）</button>` : ''}
        </div>
        <div class="formal-strategy-members"><b>候選：</b>${esc(memberText(evaluation, evaluation.members))}<br><b>命中：</b>${esc(memberText(evaluation, evaluation.hitMembers))}${isOversold ? `<br><b>未命中：</b>${esc(memberText(evaluation, evaluation.missMembers))}` : ''}${evaluation.missingReplayCandidates ? `<br><b>缺少收盤資料：</b>${evaluation.missingReplayCandidates} 檔` : ''}</div>
      </article>`;
  }

  function renderSection(readiness, evaluations) {
    selectionMembers.clear();
    for (const evaluation of evaluations) {
      selectionMembers.set(`${evaluation.strategyId}:candidates`, new Set(evaluation.stocks.filter(stock => stock.verified).map(stock => stock.stock_code)));
      selectionMembers.set(`${evaluation.strategyId}:hits`, new Set(evaluation.hitMembers));
      selectionMembers.set(`${evaluation.strategyId}:misses`, new Set(evaluation.missMembers));
    }
    installSelectionSupport();

    let section = document.getElementById('formalStrategyReplay');
    if (!section) {
      const style = document.createElement('style');
      style.id = 'formal-strategy-replay-style';
      style.textContent = `
        .formal-strategy-replay-grid{display:grid;gap:14px}.registered-strategy-card,.readiness-replay-card{border:1px solid #c4b5fd;border-radius:8px;background:#faf7ff;padding:16px}
        .readiness-replay-card{border-color:#93c5fd;background:#f7fbff}.formal-strategy-head{display:flex;align-items:flex-start;justify-content:space-between;gap:14px;flex-wrap:wrap}
        .formal-strategy-badge{display:inline-flex;padding:3px 8px;border-radius:999px;background:#ede9fe;color:#6d28d9;font-size:12px;font-weight:900}.readiness-replay-card .formal-strategy-badge{background:#dbeafe;color:#1d4ed8}
        .formal-strategy-kpis{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;margin-top:14px}.strategy-kpis-wide{grid-template-columns:repeat(auto-fit,minmax(130px,1fr))}
        .formal-strategy-kpi{border:1px solid #ddd6fe;border-radius:8px;background:#fff;padding:12px;min-width:0}.readiness-replay-card .formal-strategy-kpi{border-color:#bfdbfe}
        .formal-strategy-kpi span{display:block;color:#667085;font-size:12px;font-weight:800}.formal-strategy-kpi b{display:block;margin-top:5px;font-size:22px;overflow-wrap:anywhere}.formal-strategy-kpi .compact-value{font-size:17px}
        .formal-strategy-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:13px}.formal-strategy-action{border:1px solid #8b5cf6;border-radius:7px;background:#fff;color:#6d28d9;padding:7px 10px;font-weight:900;cursor:pointer}.formal-strategy-action:disabled{border-color:#d6d3d1;color:#a8a29e;cursor:not-allowed}
        .formal-strategy-members{margin-top:11px;color:#526173;font-size:13px;line-height:1.6;overflow-wrap:anywhere}.strategy-description{margin:5px 0 0;color:#667085;font-size:13px;line-height:1.5}.strategy-result{font-weight:900}.strategy-good{color:#12623a}.strategy-bad{color:#9e2f2f}
        @media(max-width:760px){.formal-strategy-kpis{grid-template-columns:1fr 1fr}}
      `;
      document.head.appendChild(style);
      section = document.createElement('section');
      section.id = 'formalStrategyReplay';
      section.className = 'section card';
      document.getElementById('kpis')?.insertAdjacentElement('afterend', section);
    }
    section.innerHTML = `<div class="formal-strategy-replay-grid">${readinessHtml(readiness)}${evaluations.map(strategyHtml).join('')}</div>`;
    section.onclick = event => {
      const button = event.target.closest('[data-strategy][data-scope]');
      if (!button || button.disabled || typeof setSelection !== 'function') return;
      const evaluation = evaluations.find(item => item.strategyId === button.dataset.strategy);
      if (!evaluation) return;
      const scope = button.dataset.scope;
      const labels = { candidates: '全部有效候選', hits: '命中', misses: '未命中' };
      setSelection('registered_strategy_scope', evaluation.strategyId, `${evaluation.label}－${labels[scope]}`, scope);
    };
  }

  async function install() {
    if (typeof state === 'undefined' || !state.summary || !Array.isArray(state.rows)) return false;
    if (!document.getElementById('kpis')) return false;
    try {
      const predictionSummary = await fetchJson(`data_predictions/${state.date}/summary.json`);
      const actualEnvironment = await fetchJson(`data_market_environment/${state.date}/actual_market_environment.json`).catch(() => null);
      const evaluations = DEFINITIONS.map(definition => computeStrategyEvaluation(predictionSummary, definition, actualEnvironment));
      renderSection(computeReadinessEvaluation(predictionSummary, actualEnvironment), evaluations);
    } catch (error) {
      const section = document.getElementById('formalStrategyReplay') || document.createElement('section');
      section.id = 'formalStrategyReplay';
      section.className = 'section card';
      section.innerHTML = `<div class="case-summary">固定策略覆盤載入失敗：${esc(error.message)}</div>`;
      if (!section.parentNode) document.getElementById('kpis')?.insertAdjacentElement('afterend', section);
    }
    return true;
  }

  let attempts = 0;
  const timer = setInterval(() => {
    attempts += 1;
    Promise.resolve(install()).then(installed => {
      if (installed || attempts >= 200) clearInterval(timer);
    }).catch(error => {
      clearInterval(timer);
      console.error('Unable to install registered strategy replay enhancement:', error);
    });
  }, 50);
})();
