(() => {
  if (window.__replayFormalStrategyEnhancementInstalled) return;
  window.__replayFormalStrategyEnhancementInstalled = true;

  const STRATEGY_ID = 'post_shock_high_confidence_core_v1';
  const STRATEGY_LABEL = '衝擊後高信心核心';
  const candidateCodes = new Set();
  const hitCodes = new Set();

  const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[char]));
  const formatPct = value => value !== null && value !== undefined && Number.isFinite(Number(value))
    ? `${Number(value).toFixed(2)}%`
    : 'NA';
  const isCandidate = stock => stock?.formal_market_strategy?.strategy_id === STRATEGY_ID
    || (stock?.strategy_tags || []).includes(STRATEGY_LABEL);
  const isRelativeLeader = row => row?.market_relative?.classification === 'relative_leadership';

  async function fetchJson(path) {
    const response = await fetch(`../${path}`, { cache: 'no-store' });
    if (!response.ok) throw new Error(`找不到 ${path}`);
    return response.json();
  }

  async function computeEvaluation() {
    const predictionSummary = await fetchJson(`data_predictions/${state.date}/summary.json`);
    const candidates = (predictionSummary.stocks || []).filter(isCandidate);
    const replayByCode = new Map(
      (state.rows || []).filter(row => row?.verified).map(row => [String(row.stock_code), row]),
    );
    const stocks = candidates.map(stock => {
      const code = String(stock.stock_code);
      const replay = replayByCode.get(code) || null;
      return {
        stock_code: code,
        stock_name: stock.stock_name || replay?.stock_name || '',
        verified: Boolean(replay),
        relative_leadership: replay ? isRelativeLeader(replay) : null,
        market_percentile: replay?.market_relative?.market_percentile ?? null,
      };
    });
    const verified = stocks.filter(stock => stock.verified);
    const hits = verified.filter(stock => stock.relative_leadership === true);
    const classification = predictionSummary.formal_strategy_classifications?.[STRATEGY_ID] || {};
    return {
      strategy_id: STRATEGY_ID,
      label: STRATEGY_LABEL,
      active: classification.active === true,
      environment_code: classification.environment_code || null,
      candidates: stocks.length,
      verified_candidates: verified.length,
      hits: hits.length,
      precision: verified.length ? hits.length / verified.length * 100 : null,
      missing_replay_candidates: stocks.length - verified.length,
      members: stocks.map(stock => stock.stock_code),
      hit_members: hits.map(stock => stock.stock_code),
      stocks,
    };
  }

  function installSelectionSupport() {
    if (typeof rowMatchesSelection !== 'function' || window.__formalStrategySelectionSupportInstalled) return;
    const originalRowMatchesSelection = rowMatchesSelection;
    rowMatchesSelection = function enhancedRowMatchesSelection(row, selection) {
      const code = String(row?.stock_code ?? '');
      if (selection?.kind === 'formal_strategy_candidates') return row?.verified && candidateCodes.has(code);
      if (selection?.kind === 'formal_strategy_hits') return row?.verified && hitCodes.has(code);
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

  function renderSection(evaluation) {
    candidateCodes.clear();
    hitCodes.clear();
    evaluation.members.forEach(code => candidateCodes.add(String(code)));
    evaluation.hit_members.forEach(code => hitCodes.add(String(code)));
    installSelectionSupport();

    let section = document.getElementById('formalStrategyReplay');
    if (!section) {
      const style = document.createElement('style');
      style.id = 'formal-strategy-replay-style';
      style.textContent = `
        .formal-strategy-card{border-color:#c4b5fd;background:#faf7ff}
        .formal-strategy-head{display:flex;align-items:flex-start;justify-content:space-between;gap:14px;flex-wrap:wrap}
        .formal-strategy-badge{display:inline-flex;padding:3px 8px;border-radius:999px;background:#ede9fe;color:#6d28d9;font-size:12px;font-weight:900}
        .formal-strategy-kpis{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;margin-top:14px}
        .formal-strategy-kpi{border:1px solid #ddd6fe;border-radius:8px;background:#fff;padding:12px}
        .formal-strategy-kpi span{display:block;color:#667085;font-size:12px;font-weight:800}
        .formal-strategy-kpi b{display:block;margin-top:5px;font-size:22px}
        .formal-strategy-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:13px}
        .formal-strategy-action{border:1px solid #8b5cf6;border-radius:7px;background:#fff;color:#6d28d9;padding:7px 10px;font-weight:900;cursor:pointer}
        .formal-strategy-action:disabled{border-color:#d6d3d1;color:#a8a29e;cursor:not-allowed}
        .formal-strategy-members{margin-top:11px;color:#526173;font-size:13px;line-height:1.6;overflow-wrap:anywhere}
        @media(max-width:760px){.formal-strategy-kpis{grid-template-columns:1fr 1fr}}
      `;
      document.head.appendChild(style);
      section = document.createElement('section');
      section.id = 'formalStrategyReplay';
      section.className = 'section card formal-strategy-card';
      document.getElementById('kpis')?.insertAdjacentElement('afterend', section);
    }

    const persisted = state.summary?.formal_strategy_evaluation;
    const persistedStatus = persisted
      ? '已寫入 replay-summary.json'
      : '頁面即時計算；尚未寫入 replay-summary.json';
    const activeText = evaluation.active ? '當日策略啟用' : '當日策略未啟用';
    section.innerHTML = `
      <div class="formal-strategy-head">
        <div>
          <div class="formal-strategy-badge">正式策略覆盤</div>
          <h2 style="margin-top:8px">${esc(evaluation.label)}</h2>
          <p style="margin:5px 0 0;color:#667085;font-size:13px;line-height:1.5">評估目標：收盤後是否成為相對領漲股；不是一般方向命中率。${esc(activeText)}，環境 ${esc(evaluation.environment_code || 'NA')}。</p>
        </div>
        <div class="status-note">${esc(persistedStatus)}</div>
      </div>
      <div class="formal-strategy-kpis">
        <div class="formal-strategy-kpi"><span>正式候選</span><b>${evaluation.candidates}</b></div>
        <div class="formal-strategy-kpi"><span>有效覆盤</span><b>${evaluation.verified_candidates}</b></div>
        <div class="formal-strategy-kpi"><span>相對領漲命中</span><b>${evaluation.hits}</b></div>
        <div class="formal-strategy-kpi"><span>策略精準率</span><b>${formatPct(evaluation.precision)}</b></div>
      </div>
      <div class="formal-strategy-actions">
        <button type="button" class="formal-strategy-action" data-formal-scope="candidates" ${evaluation.verified_candidates ? '' : 'disabled'}>查看候選覆盤（${evaluation.verified_candidates}）</button>
        <button type="button" class="formal-strategy-action" data-formal-scope="hits" ${evaluation.hits ? '' : 'disabled'}>查看相對領漲命中（${evaluation.hits}）</button>
      </div>
      <div class="formal-strategy-members"><b>候選：</b>${esc(memberText(evaluation, evaluation.members))}<br><b>命中：</b>${esc(memberText(evaluation, evaluation.hit_members))}${evaluation.missing_replay_candidates ? `<br><b>缺少覆盤：</b>${evaluation.missing_replay_candidates} 檔` : ''}</div>
    `;

    section.onclick = event => {
      const button = event.target.closest('[data-formal-scope]');
      if (!button || button.disabled || typeof setSelection !== 'function') return;
      const hitsOnly = button.dataset.formalScope === 'hits';
      setSelection(
        hitsOnly ? 'formal_strategy_hits' : 'formal_strategy_candidates',
        STRATEGY_ID,
        hitsOnly ? `${STRATEGY_LABEL}－相對領漲命中` : `${STRATEGY_LABEL}－全部候選`,
        'all',
      );
    };
  }

  async function install() {
    if (typeof state === 'undefined' || !state.summary || !Array.isArray(state.rows)) return false;
    if (!document.getElementById('kpis')) return false;
    try {
      renderSection(await computeEvaluation());
    } catch (error) {
      renderSection({
        strategy_id: STRATEGY_ID,
        label: STRATEGY_LABEL,
        active: false,
        environment_code: null,
        candidates: 0,
        verified_candidates: 0,
        hits: 0,
        precision: null,
        missing_replay_candidates: 0,
        members: [],
        hit_members: [],
        stocks: [],
      });
      const section = document.getElementById('formalStrategyReplay');
      section?.insertAdjacentHTML('beforeend', `<div class="case-summary">正式策略覆盤載入失敗：${esc(error.message)}</div>`);
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
      console.error('Unable to install formal strategy replay enhancement:', error);
    });
  }, 50);
})();
