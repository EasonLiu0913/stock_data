(() => {
  if (window.__replayFormalStrategyEnhancementInstalled) return;
  window.__replayFormalStrategyEnhancementInstalled = true;

  const FALLBACK_DEFINITIONS = [
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
    {
      strategyId: 'oversold_margin_exit_rebound_v1',
      legacyIds: [],
      label: '融資退場型跌深反彈',
      legacyLabels: [],
      target: 'close_return_gt_5',
      targetLabel: '當日是否出現「跌深反彈」標籤（收盤報酬 > 5%）',
    },
  ];
  const selectionMembers = new Map();
  const strategyEvaluations = new Map();

  const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[char]));
  const finite = value => value !== null && value !== undefined && Number.isFinite(Number(value));
  const formatPct = value => finite(value) ? `${Number(value).toFixed(2)}%` : 'N/A';

  async function fetchJson(path) {
    const response = await fetch(`../${path}`, { cache: 'no-store' });
    if (!response.ok) throw new Error(`找不到 ${path}`);
    return response.json();
  }

  function targetLabel(target) {
    return ({
      relative_leadership: '收盤後是否成為相對領漲股',
      close_return_gt_5: '當日收盤報酬嚴格大於 5.00%',
      intraday_rebound_5d_10pct: '候選日起 5 個交易日內盤中反彈達 10%',
    })[target] || target || '依策略版本定義';
  }

  function metadataFor(stock, definition) {
    return stock?.formal_market_strategies?.[definition.strategyId]
      || ([definition.strategyId, ...(definition.legacyIds || [])].includes(stock?.formal_market_strategy?.strategy_id)
        ? stock.formal_market_strategy
        : null);
  }

  function isCandidate(stock, definition) {
    const ids = [definition.strategyId, ...(definition.legacyIds || [])];
    const labels = [definition.label, ...(definition.legacyLabels || [])];
    return ids.includes(stock?.formal_market_strategy?.strategy_id)
      || ids.some(id => Boolean(stock?.formal_market_strategies?.[id]))
      || labels.some(label => (stock?.strategy_tags || []).includes(label));
  }

  function actualReturn(row) {
    const value = Number(row?.actual?.close_return);
    return Number.isFinite(value) ? value : null;
  }

  function computeLegacyEvaluation(predictionSummary, definition, actualEnvironment) {
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
        : definition.target === 'close_return_gt_5'
          ? (Number.isFinite(closeReturn) ? closeReturn > 5 : null)
          : null;
      return {
        stock_code: code,
        stock_name: stock.stock_name || replay?.stock_name || '',
        verified: definition.target === 'relative_leadership'
          ? Boolean(replay)
          : Boolean(replay && Number.isFinite(closeReturn)),
        hit,
        close_return: closeReturn,
        market_excess_return: Number.isFinite(closeReturn) && Number.isFinite(marketReturn)
          ? closeReturn - marketReturn
          : null,
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
      calculationStatus: 'completed',
      evaluationMode: 'legacy_recomputed',
      candidates: stocks.length,
      verifiedCandidates: verified.length,
      hits: hits.length,
      misses: misses.length,
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

  function registryDefinitions(tagStrategyReplay) {
    const registryStrategies = tagStrategyReplay?.registry?.strategies;
    if (!Array.isArray(registryStrategies) || !registryStrategies.length) return FALLBACK_DEFINITIONS;
    return registryStrategies
      .filter(item => item && item.enabled !== false && item.fixed_display !== false)
      .map(item => ({
        strategyId: item.strategy_id,
        legacyIds: [],
        label: item.label || item.strategy_id,
        legacyLabels: [],
        target: item.evaluation_target,
        targetLabel: targetLabel(item.evaluation_target),
        version: item.version,
      }));
  }

  function canonicalEvaluation(definition, raw = {}) {
    const members = (raw.members || []).map(String);
    const hitMembers = (raw.hit_members || []).map(String);
    const missMembers = (raw.miss_members || []).map(String);
    const verifiedSet = new Set([...hitMembers, ...missMembers]);
    const hitSet = new Set(hitMembers);
    const replayByCode = new Map((state.rows || []).map(row => [String(row.stock_code), row]));
    const stocks = members.map(code => {
      const replay = replayByCode.get(code) || null;
      return {
        stock_code: code,
        stock_name: replay?.stock_name || '',
        verified: verifiedSet.has(code),
        hit: verifiedSet.has(code) ? hitSet.has(code) : null,
        close_return: actualReturn(replay),
        market_excess_return: replay?.market_relative?.excess_return ?? null,
      };
    });
    const verifiedCandidates = Number(raw.verified_candidates || 0);
    return {
      ...definition,
      target: raw.evaluation_target || definition.target,
      targetLabel: targetLabel(raw.evaluation_target || definition.target),
      calculationStatus: raw.calculation_status || 'completed',
      evaluationMode: raw.evaluation_mode || 'live_snapshot',
      candidates: Number(raw.candidates || members.length || 0),
      verifiedCandidates,
      hits: Number(raw.hits || 0),
      misses: Number(raw.misses || 0),
      hitRate: finite(raw.hit_rate) ? Number(raw.hit_rate) : null,
      missingReplayCandidates: Number(raw.missing_replay_candidates || 0),
      averageReturn: verifiedCandidates && finite(raw.average_return) ? Number(raw.average_return) : null,
      medianReturn: verifiedCandidates && finite(raw.median_return) ? Number(raw.median_return) : null,
      averageMarketExcessReturn: verifiedCandidates && finite(raw.average_market_excess_return)
        ? Number(raw.average_market_excess_return)
        : null,
      members,
      hitMembers,
      missMembers,
      stocks,
    };
  }

  function canonicalEvaluations(tagStrategyReplay) {
    const definitions = registryDefinitions(tagStrategyReplay);
    const rawEvaluations = tagStrategyReplay?.evaluations || {};
    return definitions.map(definition => canonicalEvaluation(
      definition,
      rawEvaluations[definition.strategyId] || {},
    ));
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

  function decorateStrategyResultRows() {
    if (typeof state === 'undefined' || state.selection?.kind !== 'registered_strategy_scope') return;
    const evaluation = strategyEvaluations.get(String(state.selection.value || ''));
    if (!evaluation) return;
    const hitSet = new Set(evaluation.hitMembers);
    const missSet = new Set(evaluation.missMembers);
    document.querySelectorAll('#caseRows tr').forEach(row => {
      const code = row.querySelector('td:first-child b')?.textContent?.trim();
      const resultCell = row.children?.[5];
      if (!code || !resultCell) return;
      let label = '尚未驗證';
      let className = '';
      if (hitSet.has(code)) {
        label = '明顯準確';
        className = 'hit';
      } else if (missSet.has(code)) {
        label = '明顯不準';
        className = 'miss';
      }
      resultCell.innerHTML = `<span class="pill ${className}">${esc(label)}</span>`;
    });
  }

  function installSelectionSupport() {
    if (typeof rowMatchesSelection !== 'function' || typeof renderCases !== 'function' || window.__formalStrategySelectionSupportInstalled) return;
    const originalRowMatchesSelection = rowMatchesSelection;
    const originalRenderCases = renderCases;
    rowMatchesSelection = function enhancedRowMatchesSelection(row, selection) {
      if (selection?.kind === 'registered_strategy_scope') {
        const key = `${selection.value}:${selection.scope || 'candidates'}`;
        return Boolean(selectionMembers.get(key)?.has(String(row?.stock_code ?? '')));
      }
      return originalRowMatchesSelection(row, selection);
    };
    renderCases = function enhancedStrategyRenderCases(...args) {
      const result = originalRenderCases(...args);
      queueMicrotask(decorateStrategyResultRows);
      return result;
    };
    window.__formalStrategySelectionSupportInstalled = true;
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

  function statusLabel(evaluation) {
    if (evaluation.calculationStatus === 'partial') return '等待後續交易日';
    if (evaluation.calculationStatus === 'unable_to_calculate') return '資料不足';
    if (!evaluation.verifiedCandidates) return evaluation.candidates ? '尚無可驗證結果' : '當日 0 檔';
    return evaluation.hits ? '已有命中' : '尚未命中';
  }

  function hitMetricLabel(evaluation) {
    if (evaluation.target === 'relative_leadership') return '相對領漲命中';
    if (evaluation.strategyId === 'oversold_margin_exit_rebound_v1') return '當日跌深反彈標籤';
    if (evaluation.target === 'intraday_rebound_5d_10pct') return '五日盤中反彈命中';
    return '漲幅 >5% 命中';
  }

  function displayTargetLabel(evaluation) {
    if (evaluation.strategyId === 'oversold_margin_exit_rebound_v1'
      && evaluation.target === 'close_return_gt_5') {
      return '當日是否出現「跌深反彈」標籤（收盤報酬 > 5%）';
    }
    return evaluation.targetLabel;
  }

  function strategyHtml(evaluation) {
    const hasReturnMetrics = evaluation.target !== 'relative_leadership';
    const extraKpis = hasReturnMetrics
      ? `<div class="formal-strategy-kpi"><span>平均報酬</span><b>${formatPct(evaluation.averageReturn)}</b></div>
         <div class="formal-strategy-kpi"><span>報酬中位數</span><b>${formatPct(evaluation.medianReturn)}</b></div>
         <div class="formal-strategy-kpi"><span>平均市場超額</span><b>${formatPct(evaluation.averageMarketExcessReturn)}</b></div>`
      : '';
    const missingNote = evaluation.missingReplayCandidates
      ? `；另有 ${evaluation.missingReplayCandidates} 檔尚未取得完整驗證資料`
      : '';
    return `
      <article class="registered-strategy-card" data-strategy-card="${esc(evaluation.strategyId)}">
        <div class="formal-strategy-head">
          <div>
            <div class="formal-strategy-badge">固定策略覆盤</div>
            <h2 style="margin-top:8px">${esc(evaluation.label)}</h2>
            <p class="strategy-description">評估目標：${esc(displayTargetLabel(evaluation))}。候選資格只讀取預測當時保存的版本化快照，不使用事後資料重新篩選。</p>
          </div>
          <div class="strategy-result">${esc(statusLabel(evaluation))}</div>
        </div>
        <div class="formal-strategy-kpis ${hasReturnMetrics ? 'strategy-kpis-wide' : ''}">
          <div class="formal-strategy-kpi"><span>事前候選</span><b>${evaluation.candidates}</b></div>
          <div class="formal-strategy-kpi"><span>有效覆盤</span><b>${evaluation.verifiedCandidates}</b></div>
          <div class="formal-strategy-kpi"><span>${esc(hitMetricLabel(evaluation))}</span><b>${evaluation.hits}</b></div>
          <div class="formal-strategy-kpi"><span>命中率</span><b>${formatPct(evaluation.hitRate)}</b></div>
          ${extraKpis}
        </div>
        <div class="formal-strategy-actions">
          <button type="button" class="formal-strategy-action" data-strategy="${esc(evaluation.strategyId)}" data-scope="candidates" ${evaluation.candidates ? '' : 'disabled'}>查看全部候選（${evaluation.candidates}）</button>
          <button type="button" class="formal-strategy-action" data-strategy="${esc(evaluation.strategyId)}" data-scope="hits" ${evaluation.hits ? '' : 'disabled'}>查看明顯準確（${evaluation.hits}）</button>
          <button type="button" class="formal-strategy-action" data-strategy="${esc(evaluation.strategyId)}" data-scope="misses" ${evaluation.missMembers.length ? '' : 'disabled'}>查看明顯不準（${evaluation.missMembers.length}）</button>
        </div>
        <div class="formal-strategy-note">資料來源：${esc(evaluation.evaluationMode)}；計算狀態：${esc(evaluation.calculationStatus)}${missingNote}。</div>
      </article>`;
  }

  function clearCaseControls() {
    const search = document.getElementById('caseSearch');
    const direction = document.getElementById('caseDirection');
    const industry = document.getElementById('caseIndustry');
    if (search) search.value = '';
    if (direction) direction.value = '';
    if (industry) industry.value = '';
  }

  function applyStrategySelection(section, evaluation, scope) {
    if (typeof state === 'undefined' || typeof renderCases !== 'function') return;
    const labels = { candidates: '全部候選', hits: '明顯準確', misses: '明顯不準' };
    state.selection = {
      kind: 'registered_strategy_scope',
      value: evaluation.strategyId,
      label: `${evaluation.label}－${labels[scope]}`,
      scope,
    };
    state.caseType = 'all';
    clearCaseControls();
    renderCases();
    const caseNote = document.getElementById('caseNote');
    if (caseNote) {
      caseNote.textContent = evaluation.strategyId === 'oversold_margin_exit_rebound_v1'
        ? `顯示「${evaluation.label}」${labels[scope]}；明顯準確只代表當日已有「跌深反彈」標籤，不再等待五個交易日。`
        : `顯示「${evaluation.label}」${labels[scope]}，使用該固定策略自己的驗證目標。`;
    }
    section.querySelectorAll('.formal-strategy-action').forEach(button => {
      const active = button.dataset.strategy === evaluation.strategyId && button.dataset.scope === scope;
      button.classList.toggle('active', active);
      button.setAttribute('aria-pressed', String(active));
    });
    document.getElementById('caseRows')?.closest('.section')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function renderSection(readiness, evaluations) {
    selectionMembers.clear();
    strategyEvaluations.clear();
    for (const evaluation of evaluations) {
      strategyEvaluations.set(evaluation.strategyId, evaluation);
      selectionMembers.set(`${evaluation.strategyId}:candidates`, new Set(evaluation.members));
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
        .formal-strategy-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:13px}.formal-strategy-action{border:1px solid #8b5cf6;border-radius:7px;background:#fff;color:#6d28d9;padding:7px 10px;font-weight:900;cursor:pointer}.formal-strategy-action.active{background:#6d28d9;color:#fff}.formal-strategy-action:disabled{border-color:#d6d3d1;color:#a8a29e;cursor:not-allowed}
        .formal-strategy-note{margin-top:11px;color:#526173;font-size:13px;line-height:1.6}.strategy-description{margin:5px 0 0;color:#667085;font-size:13px;line-height:1.5}.strategy-result{font-weight:900}.strategy-good{color:#12623a}.strategy-bad{color:#9e2f2f}
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
      if (!button || button.disabled) return;
      const evaluation = evaluations.find(item => item.strategyId === button.dataset.strategy);
      if (!evaluation) return;
      applyStrategySelection(section, evaluation, button.dataset.scope);
    };
  }

  async function install() {
    if (typeof state === 'undefined' || !state.summary || !Array.isArray(state.rows)) return false;
    if (!document.getElementById('kpis')) return false;
    try {
      const predictionSummary = await fetchJson(`data_predictions/${state.date}/summary.json`);
      const actualEnvironment = await fetchJson(`data_market_environment/${state.date}/actual_market_environment.json`).catch(() => null);
      const tagStrategyReplay = await fetchJson(`data_prediction_analysis/tag-strategy/${state.date}.json`).catch(() => null);
      const evaluations = tagStrategyReplay?.evaluations
        ? canonicalEvaluations(tagStrategyReplay)
        : FALLBACK_DEFINITIONS.map(definition => computeLegacyEvaluation(
          predictionSummary,
          definition,
          actualEnvironment,
        ));
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
