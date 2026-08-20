(() => {
  'use strict';

  function installResponsiveVisibility() {
    if (document.getElementById('dailyGainersMobileVisibilityStyle')) return;
    const style = document.createElement('style');
    style.id = 'dailyGainersMobileVisibilityStyle';
    style.textContent = `
      @media (max-width: 760px) {
        .table-wrap { display: none !important; }
        .mobile-content { display: block !important; }
      }
    `;
    document.head.appendChild(style);
  }

  function asArray(value) {
    return Array.isArray(value) ? value : [];
  }

  function asMap(payload) {
    return new Map(asArray(payload?.analyses).map(item => [String(item.code || ''), item]));
  }

  function factsMap(payload) {
    return new Map(asArray(payload?.stocks).map(item => [String(item.code || ''), item]));
  }

  function legacyActor(value) {
    if (value === null || value === undefined || value === 'unavailable') {
      return { net_lots: null, record_status: 'unavailable' };
    }
    const n = Number(value);
    if (!Number.isFinite(n)) return { net_lots: null, record_status: 'unavailable' };
    return { net_lots: n, record_status: n === 0 ? 'zero_net' : 'reported' };
  }

  function actor(fact, flow, factKey, flowKey) {
    const current = fact?.institutional?.[factKey];
    if (current && typeof current === 'object') return current;
    return legacyActor(flow?.[flowKey]);
  }

  function normalizeFollowUp(value) {
    if (Array.isArray(value)) return value.filter(Boolean).map(String);
    return value ? [String(value)] : [];
  }

  function sourceMerge(...groups) {
    const seen = new Set();
    const out = [];
    groups.flatMap(asArray).forEach(source => {
      const url = source?.url ? String(source.url) : '';
      const title = source?.title ? String(source.title) : '';
      const key = `${url}|${title}`;
      if (!url || seen.has(key)) return;
      seen.add(key);
      out.push({ title: title || url, url });
    });
    return out;
  }

  function fallbackVerification(fact, ai) {
    if (ai?.institutional_verification) return ai.institutional_verification;
    if (fact?.institutional?.verification_required) {
      return {
        status: 'inconclusive',
        summary: '此檔法人資料需要外部查證，但目前尚未取得正式 AI 查證結果。',
        sources: []
      };
    }
    return {
      status: 'not_required',
      summary: '目前可用資料未標記為需要額外法人查證。',
      sources: []
    };
  }

  function buildRows(payload, analysisPayload, flowPayload, factsPayload, aiPayload) {
    const reasons = asMap(analysisPayload);
    const flows = asMap(flowPayload);
    const facts = factsMap(factsPayload);
    const ais = asMap(aiPayload);

    return asArray(payload?.stocks).map(stock => {
      const code = String(stock.code || '');
      const reason = reasons.get(code) || null;
      const flow = flows.get(code) || null;
      const fact = facts.get(code) || null;
      const ai = ais.get(code) || null;
      const verification = fallbackVerification(fact, ai);
      const catalyst = reason?.reason_summary || fact?.catalyst_context?.reason_summary || '';
      const fallbackSummary = flow?.flow_interpretation || flow?.institutional_summary || catalyst || '尚無完整 AI 籌碼解讀。';
      const summary = ai?.synthesis || ai?.funding_structure || fallbackSummary;
      const supporting = asArray(ai?.supporting_signals).slice();
      if (catalyst && !supporting.includes(catalyst)) supporting.unshift(`上漲原因：${catalyst}`);
      const followUp = [
        ...normalizeFollowUp(ai?.follow_up),
        ...normalizeFollowUp(reason?.follow_up),
        ...normalizeFollowUp(flow?.follow_up),
      ];

      return {
        code,
        name: stock.name || '',
        changePct: Number(stock.change_pct),
        continuationBias: ai?.continuation_bias || 'neutral',
        confidence: ai?.confidence || reason?.confidence || flow?.confidence || '',
        summary,
        institutional: {
          foreign: actor(fact, flow, 'foreign', 'foreign_net'),
          trust: actor(fact, flow, 'trust', 'trust_net'),
          dealer: actor(fact, flow, 'dealer', 'dealer_net'),
        },
        marginDelta: fact?.margin?.margin_delta ?? null,
        top5BuySharePct: fact?.broker?.top5_buy_share_pct ?? null,
        volume: fact?.price?.volume ?? stock.volume ?? null,
        supportingSignals: supporting,
        conflictingSignals: asArray(ai?.conflicting_signals),
        risks: asArray(ai?.risks),
        followUp,
        verification: {
          status: verification.status || 'inconclusive',
          summary: verification.summary || '',
          sources: sourceMerge(verification.sources, reason?.sources),
        },
      };
    });
  }

  function render(container, payload, analysisPayload, flowPayload, factsPayload, aiPayload) {
    if (!window.ResponsiveStockCard) throw new Error('ResponsiveStockCard component is not loaded');
    const rows = buildRows(payload, analysisPayload, flowPayload, factsPayload, aiPayload);
    return window.ResponsiveStockCard.render(container, rows);
  }

  installResponsiveVisibility();
  window.DailyGainersMobileCards = { buildRows, render };
})();
