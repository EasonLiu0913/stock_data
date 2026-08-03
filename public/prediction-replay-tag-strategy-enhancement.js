(() => {
  'use strict';

  const PANEL_ID = 'predictionReplayTagStrategy';

  function normalizeSnapshot(source = {}) {
    const legacy = source.tag_strategy_registry || {};
    return {
      tags: source.tag_registry || legacy.tags || [],
      strategies: source.strategy_registry || source.strategy_registry_v2 || legacy.strategies || [],
      tagClassifications: source.tag_classifications || {},
      strategyClassifications: source.strategy_classifications || source.strategy_classifications_v2 || {},
      evaluationMode: source.evaluation_mode || source.strategy_snapshot_metadata?.evaluation_mode || 'live_snapshot',
      registryId: source.registry_id || source.strategy_snapshot_metadata?.registry_id || '',
      registryFingerprint: source.registry_fingerprint || source.strategy_snapshot_metadata?.registry_fingerprint || '',
      dataAsOf: source.data_as_of || source.strategy_snapshot_metadata?.data_as_of || null,
      generatedAt: source.generated_at || source.strategy_snapshot_metadata?.generated_at || null,
    };
  }

  function firstFinite(values) {
    for (const value of values) {
      const number = Number(value);
      if (value !== null && value !== undefined && value !== '' && Number.isFinite(number)) return number;
    }
    return null;
  }

  function actualReturn(row) {
    return firstFinite([row?.actual?.close_return, row?.close_return]);
  }

  function targetResult(row, target) {
    if (!row) return { verified: false, hit: null, measuredValue: null };
    if (target === 'relative_leadership') {
      return {
        verified: true,
        hit: row?.market_relative?.classification === 'relative_leadership',
        measuredValue: actualReturn(row),
      };
    }
    if (target === 'close_return_gt_5') {
      const value = actualReturn(row);
      return { verified: Number.isFinite(value), hit: Number.isFinite(value) ? value > 5 : null, measuredValue: value };
    }
    if (target === 'intraday_rebound_5d_10pct') {
      const value = firstFinite([
        row?.actual?.max_intraday_rebound_5d,
        row?.actual?.max_return_5d,
        row?.outcome?.max_intraday_rebound_5d,
        row?.outcome?.max_return_5d,
        row?.future?.max_return_5d,
      ]);
      return { verified: Number.isFinite(value), hit: Number.isFinite(value) ? value >= 10 : null, measuredValue: value };
    }
    return { verified: false, hit: null, measuredValue: null };
  }

  function evaluateStrategy(definition, classification, rows = []) {
    const byCode = new Map(rows.filter(row => row?.verified).map(row => [String(row.stock_code), row]));
    const members = (classification?.members || []).map(String);
    const stocks = members.map(code => {
      const row = byCode.get(code) || null;
      const result = targetResult(row, definition.evaluation_target);
      return { code, row, ...result, closeReturn: actualReturn(row) };
    });
    const verified = stocks.filter(item => item.verified);
    const hits = verified.filter(item => item.hit === true);
    const misses = verified.filter(item => item.hit === false);
    const returns = verified.map(item => item.closeReturn).filter(Number.isFinite);
    return {
      candidates: classification?.count ?? members.length,
      verified: verified.length,
      hits: hits.length,
      misses: misses.length,
      hitRate: verified.length ? hits.length / verified.length * 100 : null,
      averageReturn: returns.length ? returns.reduce((sum, value) => sum + value, 0) / returns.length : null,
      members,
      hitMembers: hits.map(item => item.code),
      missMembers: misses.map(item => item.code),
    };
  }

  const API = { normalizeSnapshot, firstFinite, targetResult, evaluateStrategy };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  if (window.__predictionReplayTagStrategyEnhancementInstalled) return;
  window.__predictionReplayTagStrategyEnhancementInstalled = true;

  const selectionMembers = new Map();
  let resolvedForecastDate = '';
  let replaySummary = {};
  let manifest = null;
  let currentSnapshot = null;

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

  function expressionText(definition, labels) {
    const expression = definition.expression || {};
    const parts = [];
    if ((expression.all || []).length) parts.push(`全部：${expression.all.map(id => labels.get(id) || id).join('＋')}`);
    if ((expression.any || []).length) parts.push(`至少一項：${expression.any.map(id => labels.get(id) || id).join('／')}`);
    if ((expression.not || []).length) parts.push(`排除：${expression.not.map(id => labels.get(id) || id).join('、')}`);
    return parts.join('；') || '沿用當時已保存的策略資格';
  }

  function scopeButton(key, label, count, unavailable = false) {
    return `<button type="button" class="tag-strategy-replay-action" data-scope-key="${esc(key)}" ${unavailable ? 'disabled' : ''}>${esc(label)}（${count ?? 0}）</button>`;
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
    if (note) note.textContent = `顯示「${label}」的預測快照成員；收盤資料只驗證結果，不重新決定候選資格。`;
    document.getElementById('caseRows')?.closest('.section')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function snapshotOptions() {
    const dateEntry = manifest?.dates?.[resolvedForecastDate] || {};
    const rows = [];
    if (dateEntry.live_snapshot) {
      rows.push({ ...dateEntry.live_snapshot, label: '當時實際版本', mode: 'live_snapshot' });
    }
    for (const item of dateEntry.historical_recalculations || []) {
      rows.push({
        ...item,
        label: `新版歷史重算｜${item.registry_id || 'registry'}｜${String(item.registry_fingerprint || '').slice(0, 8)}`,
        mode: 'historical_recalculation',
      });
    }
    return rows;
  }

  function selectedSnapshotFile() {
    return currentSnapshot?.__file || '';
  }

  async function switchSnapshot(file) {
    if (!file || file === selectedSnapshotFile()) return;
    const snapshot = await fetchJson(file);
    currentSnapshot = { ...snapshot, __file: file };
    render();
  }

  function hideLegacyStrategyCards() {
    document.querySelectorAll('#formalStrategyReplay .registered-strategy-card').forEach(card => {
      card.hidden = true;
    });
  }

  function render() {
    if (!currentSnapshot) return;
    const view = normalizeSnapshot(currentSnapshot);
    if (!view.tags.length && !view.strategies.length) return;
    installSelectionSupport();
    hideLegacyStrategyCards();
    selectionMembers.clear();
    const labels = new Map(view.tags.map(item => [item.tag_id, item.label]));
    const rows = typeof state !== 'undefined' && Array.isArray(state.rows) ? state.rows : [];
    const savedEvaluations = replaySummary?.tag_strategy_evaluations || {};
    const tags = view.tags.filter(item => item.enabled !== false && item.fixed_display !== false);
    const strategies = view.strategies.filter(item => item.enabled !== false && item.fixed_display !== false);

    for (const definition of tags) {
      selectionMembers.set(
        `tag:${definition.tag_id}:members`,
        new Set((view.tagClassifications[definition.tag_id]?.members || []).map(String)),
      );
    }

    const strategyRows = strategies.map(definition => {
      const classification = view.strategyClassifications[definition.strategy_id] || {};
      const saved = savedEvaluations[definition.strategy_id];
      const evaluation = saved ? {
        candidates: saved.candidates,
        verified: saved.verified_candidates,
        hits: saved.hits,
        misses: saved.misses ?? (saved.miss_members || []).length,
        hitRate: saved.hit_rate ?? saved.precision,
        averageReturn: saved.average_return ?? null,
        members: saved.members || classification.members || [],
        hitMembers: saved.hit_members || [],
        missMembers: saved.miss_members || [],
      } : evaluateStrategy(definition, classification, rows);
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

    const options = snapshotOptions();
    panel.innerHTML = `
      <div class="section-head tag-strategy-replay-head">
        <div>
          <div class="tag-strategy-replay-eyebrow">固定觀測｜預測快照與新版回算分離</div>
          <h2>標籤與多標籤策略覆盤</h2>
          <p>0 代表當時確實沒有候選；N/A 代表資料不足。候選資格使用所選快照，收盤資料只負責驗證。</p>
        </div>
        <label class="tag-strategy-version-select"><span>歷史視角</span><select data-snapshot-select>
          ${options.length ? options.map(item => `<option value="${esc(item.file)}" ${item.file === selectedSnapshotFile() ? 'selected' : ''}>${esc(item.label)}</option>`).join('') : '<option value="">目前摘要</option>'}
        </select></label>
      </div>
      <div class="tag-strategy-snapshot-meta">${esc(view.evaluationMode === 'live_snapshot' ? '當時實際版本' : '新版歷史重算')}｜Registry ${esc(view.registryId || 'N/A')}｜指紋 ${esc(view.registryFingerprint || 'N/A')}｜資料截點 ${esc(view.dataAsOf || 'N/A')}</div>
      <div class="tag-strategy-replay-card">
        <h3>原子標籤</h3>
        <div class="tag-strategy-replay-tags">
          ${tags.map(definition => {
            const classification = view.tagClassifications[definition.tag_id] || {};
            const unavailable = classification.calculation_status === 'unable_to_calculate';
            const count = unavailable ? 'N/A' : Number(classification.count || 0).toLocaleString('zh-TW');
            return `<button type="button" class="tag-strategy-replay-tag${unavailable ? ' unavailable' : ''}" data-scope-key="tag:${esc(definition.tag_id)}:members" ${unavailable ? 'disabled' : ''}><span>${esc(definition.label)}</span><b>${count}</b></button>`;
          }).join('')}
        </div>
      </div>
      <div class="tag-strategy-replay-grid">
        ${strategyRows.map(({ definition, classification, evaluation }) => {
          const unavailable = classification.calculation_status === 'unable_to_calculate';
          const candidateText = unavailable ? 'N/A' : Number(evaluation.candidates || 0).toLocaleString('zh-TW');
          const targetSupported = definition.evaluation_target !== 'intraday_rebound_5d_10pct' || evaluation.verified > 0;
          return `<article class="tag-strategy-replay-card">
            <div class="tag-strategy-replay-title"><div><span>固定策略｜v${esc(definition.version)}</span><h3>${esc(definition.label)}</h3></div><b>${candidateText} 檔</b></div>
            <p>${esc(expressionText(definition, labels))}</p>
            <div class="tag-strategy-replay-kpis"><div><span>有效覆盤</span><b>${evaluation.verified}</b></div><div><span>命中</span><b>${evaluation.hits}</b></div><div><span>未命中</span><b>${evaluation.misses}</b></div><div><span>命中率</span><b>${pct(evaluation.hitRate)}</b></div><div><span>平均收盤報酬</span><b>${pct(evaluation.averageReturn)}</b></div></div>
            ${targetSupported ? '' : '<div class="tag-strategy-replay-warning">目前每日覆盤尚無完整 5 日盤中反彈欄位，因此先保存候選，命中率顯示 N/A；資料累積後可回填。</div>'}
            <div class="tag-strategy-replay-actions">
              ${scopeButton(`strategy:${definition.strategy_id}:members`, '查看候選', evaluation.members.length, unavailable)}
              ${scopeButton(`strategy:${definition.strategy_id}:hits`, '查看命中', evaluation.hitMembers.length, !evaluation.hitMembers.length)}
              ${scopeButton(`strategy:${definition.strategy_id}:misses`, '查看未命中', evaluation.missMembers.length, !evaluation.missMembers.length)}
            </div>
          </article>`;
        }).join('')}
      </div>`;

    panel.querySelector('[data-snapshot-select]')?.addEventListener('change', event => {
      switchSnapshot(event.target.value).catch(error => console.error('Unable to switch strategy snapshot:', error));
    });
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
        resolvedForecastDate = date;
        const [summary, loadedReplay, loadedManifest] = await Promise.all([
          fetchJson(`data_predictions/${date}/summary.json`).catch(() => ({})),
          fetchJson(`data_predictions/${date}/replay-summary.json`).catch(() => ({})),
          fetchJson('data_prediction_analysis/strategy-snapshots/manifest.json').catch(() => null),
        ]);
        replaySummary = loadedReplay;
        manifest = loadedManifest;
        const options = snapshotOptions();
        const live = options.find(item => item.mode === 'live_snapshot');
        if (live?.file) {
          const snapshot = await fetchJson(live.file);
          currentSnapshot = { ...snapshot, __file: live.file };
        } else {
          currentSnapshot = {
            ...summary,
            strategy_registry: summary.strategy_registry_v2 || [],
            strategy_classifications: summary.strategy_classifications_v2 || {},
            evaluation_mode: 'live_snapshot',
            __file: '',
          };
        }
        render();
        return;
      }
      await new Promise(resolve => setTimeout(resolve, 50));
    }
  }

  const style = document.createElement('style');
  style.id = 'prediction-replay-tag-strategy-style';
  style.textContent = `
    .tag-strategy-replay-section{display:grid;gap:14px}.tag-strategy-replay-head{display:flex;justify-content:space-between;gap:14px;align-items:flex-start;flex-wrap:wrap}.tag-strategy-replay-section .section-head p{margin:7px 0 0;color:#64748b;font-size:13px;line-height:1.5}.tag-strategy-replay-eyebrow{font-size:12px;font-weight:900;color:#0f766e}.tag-strategy-version-select{display:grid;gap:4px;color:#64748b;font-size:11px;font-weight:900}.tag-strategy-version-select select{min-width:280px;height:38px;border:1px solid #99f6e4;border-radius:7px;background:#fff;padding:0 9px}.tag-strategy-snapshot-meta{border:1px solid #ccfbf1;background:#f0fdfa;border-radius:7px;padding:9px 11px;color:#526173;font-size:12px;font-weight:800}.tag-strategy-replay-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(310px,1fr));gap:14px}.tag-strategy-replay-card{border:1px solid #99f6e4;border-radius:8px;background:#f0fdfa;padding:15px;min-width:0}.tag-strategy-replay-card h3{margin:0;font-size:17px}.tag-strategy-replay-card>p{color:#64748b;font-size:12px;line-height:1.5}.tag-strategy-replay-title{display:flex;justify-content:space-between;gap:12px;align-items:flex-start}.tag-strategy-replay-title span{font-size:11px;font-weight:900;color:#0f766e}.tag-strategy-replay-title>div>h3{margin-top:4px}.tag-strategy-replay-title>b{font-size:20px}.tag-strategy-replay-tags{display:flex;gap:8px;flex-wrap:wrap;margin-top:10px}.tag-strategy-replay-tag{appearance:none;border:1px solid #5eead4;background:#fff;border-radius:999px;padding:6px 9px;display:flex;gap:8px;font:inherit;font-size:12px;font-weight:900;cursor:pointer}.tag-strategy-replay-tag.unavailable{border-style:dashed;color:#64748b}.tag-strategy-replay-tag:disabled{cursor:not-allowed;opacity:.72}.tag-strategy-replay-kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(105px,1fr));gap:8px;margin-top:12px}.tag-strategy-replay-kpis>div{border:1px solid #ccfbf1;background:#fff;border-radius:7px;padding:9px}.tag-strategy-replay-kpis span{display:block;color:#64748b;font-size:11px}.tag-strategy-replay-kpis b{display:block;margin-top:3px;font-size:17px}.tag-strategy-replay-actions{display:flex;gap:7px;flex-wrap:wrap;margin-top:12px}.tag-strategy-replay-action{appearance:none;border:1px solid #0f766e;background:#0f766e;color:#fff;border-radius:6px;padding:7px 9px;font:inherit;font-size:12px;font-weight:900;cursor:pointer}.tag-strategy-replay-action:disabled{border-color:#cbd5e1;background:#e2e8f0;color:#64748b;cursor:not-allowed}.tag-strategy-replay-warning{margin-top:10px;border:1px solid #fed7aa;background:#fff7ed;color:#9a3412;border-radius:6px;padding:8px 9px;font-size:12px;font-weight:800}@media(max-width:640px){.tag-strategy-replay-grid{grid-template-columns:1fr}.tag-strategy-version-select,.tag-strategy-version-select select{width:100%;min-width:0}}
  `;
  document.head.appendChild(style);
  load().catch(error => console.error('Unable to render replay tag strategy panel:', error));
})();
