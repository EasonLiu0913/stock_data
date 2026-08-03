(() => {
  'use strict';
  if (window.__predictionReplayTagStrategyEnhancementInstalled) return;
  window.__predictionReplayTagStrategyEnhancementInstalled = true;

  const selectionMembers = new Map();
  const PANEL_ID = 'predictionReplayTagStrategy';

  const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[char]));
  const finite = value => value !== null && value !== undefined && Number.isFinite(Number(value));
  const pct = value => finite(value) ? `${Number(value).toFixed(2)}%` : 'N/A';

  async function fetchJson(file) {
    const response = await fetch(`../${file}`, { cache: 'no-store' });
    if (!response.ok) throw new Error(`找不到 ${file}`);
    return response.json();
  }

  function resolveDate() {
    const value = String(
      (typeof currentDate !== 'undefined' && currentDate)
      || (typeof state !== 'undefined' && (state.date || state.currentDate || state.selectedDate))
      || '',
    ).replaceAll('-', '').replaceAll('/', '');
    return /^20\d{6}$/.test(value) ? value : '';
  }

  function installSelectionSupport() {
    if (typeof rowMatchesSelection !== 'function' || window.__tagStrategySelectionSupportInstalled) return;
    const original = rowMatchesSelection;
    rowMatchesSelection = function enhancedTagStrategySelection(row, selection) {
      if (selection?.kind === 'tag_strategy_scope') {
        return row?.verified && Boolean(selectionMembers.get(selection.value)?.has(String(row?.stock_code ?? '')));
      }
      return original(row, selection);
    };
    window.__tagStrategySelectionSupportInstalled = true;
  }

  function actualReturn(row) {
    const value = Number(row?.actual?.close_return);
    return Number.isFinite(value) ? value : null;
  }

  function evaluateStrategy(definition, classification) {
    const byCode = new Map((typeof state !== 'undefined' && Array.isArray(state.rows) ? state.rows : [])
      .filter(row => row?.verified)
      .map(row => [String(row.stock_code), row]));
    const members = (classification?.members || []).map(String);
    const stocks = members.map(code => {
      const row = byCode.get(code) || null;
      const closeReturn = actualReturn(row);
      const hit = definition.evaluation_target === 'relative_leadership'
        ? (row ? row?.market_relative?.classification === 'relative_leadership' : null)
        : definition.evaluation_target === 'close_return_gt_5'
          ? (Number.isFinite(closeReturn) ? closeReturn > 5 : null)
          : null;
      return { code, row, verified: hit !== null, hit, closeReturn };
    });
    const verified = stocks.filter(item => item.verified);
    const hits = verified.filter(item => item.hit === true);
    const misses = verified.filter(item => item.hit === false);
    return {
      candidates: classification?.count ?? null,
      verified: verified.length,
      hits: hits.length,
      misses: misses.length,
      hitRate: verified.length ? hits.length / verified.length * 100 : null,
      members,
      hitMembers: hits.map(item => item.code),
      missMembers: misses.map(item => item.code),
    };
  }

  function expressionText(definition, labels) {
    const expression = definition.expression || {};
    const parts = [];
    if ((expression.all || []).length) parts.push(`全部：${expression.all.map(id => labels.get(id) || id).join('＋')}`);
    if ((expression.any || []).length) parts.push(`至少一項：${expression.any.map(id => labels.get(id) || id).join('／')}`);
    if ((expression.not || []).length) parts.push(`排除：${expression.not.map(id => labels.get(id) || id).join('、')}`);
    return parts.join('；') || '沿用當時已保存的策略資格';
  }

  function scopeButton(key, label, count, disabled = false) {
    return `<button type="button" class="tag-strategy-replay-action" data-scope-key="${esc(key)}" ${disabled ? 'disabled' : ''}>${esc(label)}（${count ?? 0}）</button>`;
  }

  function applySelection(key, label) {
    if (typeof state === 'undefined' || typeof renderCases !== 'function') return;
    state.selection = { kind: 'tag_strategy_scope', value: key, label };
    state.caseType = 'all';
    for (const id of ['caseSearch', 'caseDirection', 'caseIndustry']) {
      const control = document.getElementById(id);
      if (control) control.value = '';
    }
    renderCases();
    const note = document.getElementById('caseNote');
    if (note) note.textContent = `顯示「${label}」的預測當時成員；覆盤結果不會重新改寫候選資格。`;
    document.getElementById('caseRows')?.closest('.section')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function render(summary, replaySummary) {
    const registry = summary?.tag_strategy_registry;
    if (!registry) return;
    installSelectionSupport();
    selectionMembers.clear();
    const labels = new Map((registry.tags || []).map(item => [item.tag_id, item.label]));
    const tagClassifications = summary.tag_classifications || {};
    const strategyClassifications = summary.strategy_classifications || {};
    const savedEvaluations = replaySummary?.tag_strategy_evaluations || {};

    const tags = (registry.tags || []).filter(item => item.fixed_display !== false && item.category !== 'legacy_bridge');
    const strategies = (registry.strategies || []).filter(item => item.fixed_display !== false);
    for (const definition of tags) {
      const members = new Set((tagClassifications[definition.tag_id]?.members || []).map(String));
      selectionMembers.set(`tag:${definition.tag_id}:members`, members);
    }

    const strategyRows = strategies.map(definition => {
      const classification = strategyClassifications[definition.strategy_id] || {};
      const live = savedEvaluations[definition.strategy_id];
      const evaluation = live ? {
        candidates: live.candidates,
        verified: live.verified_candidates,
        hits: live.hits,
        misses: live.misses ?? (live.miss_members || []).length,
        hitRate: live.hit_rate ?? live.precision,
        members: live.members || [],
        hitMembers: live.hit_members || [],
        missMembers: live.miss_members || [],
      } : evaluateStrategy(definition, classification);
      selectionMembers.set(`strategy:${definition.strategy_id}:members`, new Set(evaluation.members.map(String)));
      selectionMembers.set(`strategy:${definition.strategy_id}:hits`, new Set(evaluation.hitMembers.map(String)));
      selectionMembers.set(`strategy:${definition.strategy_id}:misses`, new Set(evaluation.missMembers.map(String)));
      return { definition, classification, evaluation };
    });

    let panel = document.getElementById(PANEL_ID);
    if (!panel) {
      panel = document.createElement('section');
      panel.id = PANEL_ID;
      panel.className = 'section tag-strategy-replay-section';
      const formal = document.getElementById('formalStrategyReplay');
      if (formal?.parentNode) formal.insertAdjacentElement('afterend', panel);
      else document.getElementById('caseRows')?.closest('.section')?.insertAdjacentElement('beforebegin', panel);
    }

    panel.innerHTML = `
      <div class="section-head">
        <div>
          <div class="tag-strategy-replay-eyebrow">固定觀測｜預測快照與新版回算分離</div>
          <h2>標籤與多標籤策略覆盤</h2>
          <p>0 代表當時確實沒有候選；N/A 代表資料不足。此頁使用預測當時保存的成員，收盤資料只負責驗證。</p>
        </div>
      </div>
      <div class="tag-strategy-replay-card">
        <h3>原子標籤</h3>
        <div class="tag-strategy-replay-tags">
          ${tags.map(definition => {
            const classification = tagClassifications[definition.tag_id] || {};
            const unavailable = classification.calculation_status === 'unable_to_calculate';
            const count = unavailable ? 'N/A' : Number(classification.count || 0).toLocaleString('zh-TW');
            return `<button type="button" class="tag-strategy-replay-tag${unavailable ? ' unavailable' : ''}" data-scope-key="tag:${esc(definition.tag_id)}:members" ${unavailable || !classification.count ? 'disabled' : ''}><span>${esc(definition.label)}</span><b>${count}</b></button>`;
          }).join('')}
        </div>
      </div>
      <div class="tag-strategy-replay-grid">
        ${strategyRows.map(({ definition, classification, evaluation }) => {
          const unavailable = classification.calculation_status === 'unable_to_calculate';
          const candidateText = unavailable ? 'N/A' : Number(evaluation.candidates || 0).toLocaleString('zh-TW');
          const bridge = definition.source_mode === 'legacy_bridge' ? '既有策略相容' : '多標籤策略';
          return `<article class="tag-strategy-replay-card">
            <div class="tag-strategy-replay-title"><div><span>${esc(bridge)}｜v${esc(definition.version)}</span><h3>${esc(definition.label)}</h3></div><b>${candidateText} 檔</b></div>
            <p>${esc(expressionText(definition, labels))}</p>
            <div class="tag-strategy-replay-kpis"><div><span>有效覆盤</span><b>${evaluation.verified}</b></div><div><span>命中</span><b>${evaluation.hits}</b></div><div><span>未命中</span><b>${evaluation.misses}</b></div><div><span>命中率</span><b>${pct(evaluation.hitRate)}</b></div></div>
            <div class="tag-strategy-replay-actions">
              ${scopeButton(`strategy:${definition.strategy_id}:members`, '查看候選', evaluation.members.length, unavailable || !evaluation.members.length)}
              ${scopeButton(`strategy:${definition.strategy_id}:hits`, '查看命中', evaluation.hitMembers.length, !evaluation.hitMembers.length)}
              ${scopeButton(`strategy:${definition.strategy_id}:misses`, '查看未命中', evaluation.missMembers.length, !evaluation.missMembers.length)}
            </div>
          </article>`;
        }).join('')}
      </div>`;

    panel.querySelectorAll('[data-scope-key]').forEach(button => button.addEventListener('click', () => {
      const label = button.closest('article')?.querySelector('h3')?.textContent
        || button.querySelector('span')?.textContent
        || '標籤／策略';
      applySelection(button.dataset.scopeKey, label);
    }));
  }

  async function load() {
    for (let attempt = 0; attempt < 240; attempt += 1) {
      const date = resolveDate();
      if (date && typeof state !== 'undefined' && Array.isArray(state.rows)) {
        const [summary, replaySummary] = await Promise.all([
          fetchJson(`data_predictions/${date}/summary.json`),
          fetchJson(`data_predictions/${date}/replay-summary.json`).catch(() => ({})),
        ]);
        render(summary, replaySummary);
        return;
      }
      await new Promise(resolve => setTimeout(resolve, 50));
    }
  }

  const style = document.createElement('style');
  style.id = 'prediction-replay-tag-strategy-style';
  style.textContent = `
    .tag-strategy-replay-section{display:grid;gap:14px}.tag-strategy-replay-section .section-head p{margin:7px 0 0;color:#64748b;font-size:13px;line-height:1.5}.tag-strategy-replay-eyebrow{font-size:12px;font-weight:900;color:#0f766e}.tag-strategy-replay-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(310px,1fr));gap:14px}.tag-strategy-replay-card{border:1px solid #99f6e4;border-radius:8px;background:#f0fdfa;padding:15px;min-width:0}.tag-strategy-replay-card h3{margin:0;font-size:17px}.tag-strategy-replay-card>p{color:#64748b;font-size:12px;line-height:1.5}.tag-strategy-replay-title{display:flex;justify-content:space-between;gap:12px;align-items:flex-start}.tag-strategy-replay-title span{font-size:11px;font-weight:900;color:#0f766e}.tag-strategy-replay-title>div>h3{margin-top:4px}.tag-strategy-replay-title>b{font-size:20px}.tag-strategy-replay-tags{display:flex;gap:8px;flex-wrap:wrap;margin-top:10px}.tag-strategy-replay-tag{appearance:none;border:1px solid #5eead4;background:#fff;border-radius:999px;padding:6px 9px;display:flex;gap:8px;font:inherit;font-size:12px;font-weight:900;cursor:pointer}.tag-strategy-replay-tag.unavailable{border-style:dashed;color:#64748b}.tag-strategy-replay-tag:disabled{cursor:not-allowed;opacity:.72}.tag-strategy-replay-kpis{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px;margin-top:12px}.tag-strategy-replay-kpis>div{border:1px solid #ccfbf1;background:#fff;border-radius:7px;padding:9px}.tag-strategy-replay-kpis span{display:block;color:#64748b;font-size:11px}.tag-strategy-replay-kpis b{display:block;margin-top:3px;font-size:17px}.tag-strategy-replay-actions{display:flex;gap:7px;flex-wrap:wrap;margin-top:12px}.tag-strategy-replay-action{appearance:none;border:1px solid #0f766e;background:#0f766e;color:#fff;border-radius:6px;padding:7px 9px;font:inherit;font-size:12px;font-weight:900;cursor:pointer}.tag-strategy-replay-action:disabled{border-color:#cbd5e1;background:#e2e8f0;color:#64748b;cursor:not-allowed}@media(max-width:640px){.tag-strategy-replay-grid{grid-template-columns:1fr}.tag-strategy-replay-kpis{grid-template-columns:1fr 1fr}}
  `;
  document.head.appendChild(style);
  load().catch(error => console.error('Unable to render replay tag strategy panel:', error));
})();
