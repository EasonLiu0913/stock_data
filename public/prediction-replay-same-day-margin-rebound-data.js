(() => {
  'use strict';

  if (window.__sameDayMarginReboundReplayDataInstalled) return;
  window.__sameDayMarginReboundReplayDataInstalled = true;

  const STRATEGY_ID = 'oversold_margin_exit_rebound_v1';
  const REBOUND_TAG = '跌深反彈';
  const originalFetch = window.fetch.bind(window);

  const finiteNumber = value => {
    if (value === null || value === undefined || value === '') return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  };
  const round = (value, digits = 2) => Number.isFinite(value)
    ? Number(value.toFixed(digits))
    : null;
  const average = values => {
    const valid = values.filter(Number.isFinite);
    return valid.length ? valid.reduce((sum, value) => sum + value, 0) / valid.length : null;
  };
  const median = values => {
    const valid = values.filter(Number.isFinite).sort((left, right) => left - right);
    if (!valid.length) return null;
    const middle = Math.floor(valid.length / 2);
    return valid.length % 2 ? valid[middle] : (valid[middle - 1] + valid[middle]) / 2;
  };

  function rewriteEvaluation(payload) {
    const evaluation = payload?.evaluations?.[STRATEGY_ID];
    if (!evaluation) return payload;

    const stocks = Array.isArray(evaluation.stocks) ? evaluation.stocks : [];
    const replayRows = typeof state !== 'undefined' && Array.isArray(state.rows) ? state.rows : [];
    const replayByCode = new Map(replayRows.map(row => [String(row.stock_code), row]));
    const normalizedStocks = (evaluation.members || []).map(codeValue => {
      const code = String(codeValue);
      const existing = stocks.find(item => String(item.stock_code) === code) || {};
      const replay = replayByCode.get(code) || null;
      const closeReturn = finiteNumber(replay?.actual?.close_return ?? existing.close_return);
      const verified = Boolean(replay?.verified ?? Number.isFinite(closeReturn)) && Number.isFinite(closeReturn);
      const hit = verified ? closeReturn > 5 : null;
      if (hit && replay?.actual) {
        const tags = new Set(Array.isArray(replay.actual.pattern_tags) ? replay.actual.pattern_tags : []);
        tags.add(REBOUND_TAG);
        replay.actual.pattern_tags = [...tags];
      }
      return {
        ...existing,
        stock_code: code,
        stock_name: replay?.stock_name || existing.stock_name || null,
        verified,
        hit,
        verification_label: hit === true ? '明顯準確' : hit === false ? '明顯不準' : '尚未驗證',
        outcome_tags: hit === true ? [REBOUND_TAG] : [],
        close_return: closeReturn,
        market_excess_return: finiteNumber(
          replay?.market_relative?.excess_return ?? existing.market_excess_return,
        ),
      };
    });
    const verified = normalizedStocks.filter(item => item.verified);
    const hits = verified.filter(item => item.hit === true);
    const misses = verified.filter(item => item.hit === false);
    const returns = verified.map(item => item.close_return).filter(Number.isFinite);
    const excessReturns = verified.map(item => item.market_excess_return).filter(Number.isFinite);

    Object.assign(evaluation, {
      evaluation_target: 'close_return_gt_5',
      calculation_status: 'completed',
      verified_candidates: verified.length,
      hits: hits.length,
      misses: misses.length,
      hit_rate: verified.length ? round(hits.length / verified.length * 100) : null,
      missing_replay_candidates: normalizedStocks.length - verified.length,
      average_return: round(average(returns)),
      median_return: round(median(returns)),
      average_market_excess_return: round(average(excessReturns)),
      hit_members: hits.map(item => item.stock_code),
      miss_members: misses.map(item => item.stock_code),
      stocks: normalizedStocks,
    });

    const definition = payload?.registry?.strategies?.find(item => item.strategy_id === STRATEGY_ID);
    if (definition) definition.evaluation_target = 'close_return_gt_5';
    return payload;
  }

  window.fetch = async function sameDayMarginReboundFetch(input, init) {
    const response = await originalFetch(input, init);
    const url = typeof input === 'string' ? input : input?.url || '';
    if (!response.ok || !url.includes('data_prediction_analysis/tag-strategy/')) return response;
    try {
      const payload = rewriteEvaluation(await response.clone().json());
      const headers = new Headers(response.headers);
      headers.set('content-type', 'application/json; charset=utf-8');
      return new Response(JSON.stringify(payload), {
        status: response.status,
        statusText: response.statusText,
        headers,
      });
    } catch (error) {
      console.warn('Unable to normalize same-day margin rebound replay data:', error);
      return response;
    }
  };
})();
