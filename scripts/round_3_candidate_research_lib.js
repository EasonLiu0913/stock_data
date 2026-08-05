'use strict';

function finiteNumber(value) {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(String(value).replaceAll(',', '').trim());
  return Number.isFinite(parsed) ? parsed : null;
}

function round(value, digits = 4) {
  if (!Number.isFinite(value)) return null;
  const scale = 10 ** digits;
  return Math.round(value * scale) / scale;
}

function percentile(values, percentileValue) {
  const sorted = values.filter(Number.isFinite).sort((left, right) => left - right);
  if (!sorted.length) return null;
  const bounded = Math.min(1, Math.max(0, Number(percentileValue)));
  const index = (sorted.length - 1) * bounded;
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  if (lower === upper) return sorted[lower];
  return sorted[lower] + ((sorted[upper] - sorted[lower]) * (index - lower));
}

function median(values) {
  return percentile(values, 0.5);
}

function average(values) {
  const usable = values.filter(Number.isFinite);
  return usable.length ? usable.reduce((sum, value) => sum + value, 0) / usable.length : null;
}

function rate(values, predicate) {
  const usable = values.filter(Number.isFinite);
  return usable.length ? (usable.filter(predicate).length / usable.length) * 100 : null;
}

function periodReturn(rows, periods) {
  const usable = rows.filter(row => Number.isFinite(row?.close) && row.close > 0);
  const required = Number(periods) + 1;
  if (usable.length < required) return null;
  const selected = usable.slice(-required);
  return ((selected.at(-1).close / selected[0].close) - 1) * 100;
}

function latestReturn(rows) {
  return periodReturn(rows, 1);
}

function classifyMarketRegime(return20dPct, options = {}) {
  const bullMin = Number.isFinite(options.bullMinReturnPct) ? options.bullMinReturnPct : 3;
  const bearMax = Number.isFinite(options.bearMaxReturnPct) ? options.bearMaxReturnPct : -3;
  if (!Number.isFinite(return20dPct)) return 'unknown';
  if (return20dPct >= bullMin) return 'bull';
  if (return20dPct <= bearMax) return 'bear';
  return 'sideways';
}

function calculateCrowdingWeakening(rows, crowdingState, options = {}) {
  const return5dMax = Number.isFinite(options.priceReturn5dLtePct)
    ? options.priceReturn5dLtePct
    : -2;
  const return1dMax = Number.isFinite(options.latestReturn1dLtPct)
    ? options.latestReturn1dLtPct
    : 0;
  const latest = rows.at(-1) || null;
  const return5d = periodReturn(rows, 5);
  const return1d = latestReturn(rows);
  const gapSma20 = Number.isFinite(latest?.close) && Number.isFinite(latest?.sma20) && latest.sma20 > 0
    ? ((latest.close / latest.sma20) - 1) * 100
    : null;
  const available = crowdingState?.available === true
    && Number.isFinite(return5d)
    && Number.isFinite(return1d)
    && Number.isFinite(gapSma20);
  if (!available) {
    return {
      available: false,
      pass: null,
      price_return_5d_pct: round(return5d),
      latest_return_1d_pct: round(return1d),
      sma20_gap_pct: round(gapSma20),
    };
  }
  return {
    available: true,
    pass: crowdingState.pass === true
      && return5d <= return5dMax
      && gapSma20 < 0
      && return1d < return1dMax,
    crowding_pass: crowdingState.pass === true,
    price_return_5d_pct: round(return5d),
    latest_return_1d_pct: round(return1d),
    sma20_gap_pct: round(gapSma20),
  };
}

function normalizeState(value) {
  if (value === true || value === false) return value;
  return null;
}

function evaluateExpression(expression = {}, states = {}) {
  const all = Array.isArray(expression.all) ? expression.all : [];
  const any = Array.isArray(expression.any) ? expression.any : [];
  const not = Array.isArray(expression.not) ? expression.not : [];
  const allStates = all.map(id => normalizeState(states[id]));
  const anyStates = any.map(id => normalizeState(states[id]));
  const notStates = not.map(id => normalizeState(states[id]));

  if (allStates.includes(false)) return false;
  if (notStates.includes(true)) return false;
  if (any.length && anyStates.every(value => value === false)) return false;

  const hasUnknown = allStates.includes(null)
    || notStates.includes(null)
    || (any.length && !anyStates.includes(true) && anyStates.includes(null));
  if (hasUnknown) return null;
  return true;
}

function deduplicateEvents(events, eligibleDates, cooldownTradingDays = 5) {
  const dateIndex = new Map((eligibleDates || []).map((date, index) => [date, index]));
  const groups = new Map();
  for (const event of events || []) {
    const key = `${event.candidate_id}::${event.stock_code}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(event);
  }
  const kept = [];
  const suppressed = [];
  const cooldown = Math.max(1, Number(cooldownTradingDays) || 5);
  for (const group of groups.values()) {
    group.sort((left, right) => String(left.signal_date).localeCompare(String(right.signal_date)));
    let previousIndex = null;
    for (const event of group) {
      const currentIndex = dateIndex.get(event.signal_date);
      if (!Number.isInteger(currentIndex)) {
        kept.push({ ...event, independent_event: true, cooldown_distance: null });
        continue;
      }
      if (previousIndex === null || currentIndex - previousIndex >= cooldown) {
        kept.push({
          ...event,
          independent_event: true,
          cooldown_distance: previousIndex === null ? null : currentIndex - previousIndex,
        });
        previousIndex = currentIndex;
      } else {
        suppressed.push({
          candidate_id: event.candidate_id,
          stock_code: event.stock_code,
          signal_date: event.signal_date,
          suppressed_by_cooldown: true,
          cooldown_distance: currentIndex - previousIndex,
        });
      }
    }
  }
  kept.sort((left, right) => String(left.signal_date).localeCompare(String(right.signal_date))
    || String(left.candidate_id).localeCompare(String(right.candidate_id))
    || String(left.stock_code).localeCompare(String(right.stock_code)));
  suppressed.sort((left, right) => String(left.signal_date).localeCompare(String(right.signal_date))
    || String(left.candidate_id).localeCompare(String(right.candidate_id))
    || String(left.stock_code).localeCompare(String(right.stock_code)));
  return { kept, suppressed };
}

function summarizeEventGroup(events) {
  const returns1d = events.map(item => item.outcome?.forward_return_1d_pct);
  const returns3d = events.map(item => item.outcome?.forward_return_3d_pct);
  const returns5d = events.map(item => item.outcome?.forward_return_5d_pct);
  const excess5d = events.map(item => item.outcome?.forward_excess_return_5d_pct);
  return {
    event_count: events.length,
    stock_count: new Set(events.map(item => item.stock_code)).size,
    average_return_1d_pct: round(average(returns1d)),
    average_return_3d_pct: round(average(returns3d)),
    average_return_5d_pct: round(average(returns5d)),
    median_return_5d_pct: round(median(returns5d)),
    positive_return_5d_rate_pct: round(rate(returns5d, value => value > 0), 2),
    rebound_4pct_5d_rate_pct: round(rate(returns5d, value => value >= 4), 2),
    average_excess_return_5d_pct: round(average(excess5d)),
    positive_excess_return_5d_rate_pct: round(rate(excess5d, value => value > 0), 2),
  };
}

function summarizeCandidate(events, definition) {
  const selected = events.filter(event => event.candidate_id === definition.candidate_id);
  const byRegime = {};
  const testByRegime = {};
  for (const regime of ['bull', 'sideways', 'bear', 'unknown']) {
    byRegime[regime] = summarizeEventGroup(selected.filter(event => event.market_regime === regime));
    testByRegime[regime] = summarizeEventGroup(selected.filter(
      event => event.split === 'test' && event.market_regime === regime,
    ));
  }
  return {
    candidate_id: definition.candidate_id,
    family_id: definition.family_id,
    version: definition.version,
    label: definition.label,
    kind: definition.kind,
    objective: definition.objective,
    all: summarizeEventGroup(selected),
    train: summarizeEventGroup(selected.filter(event => event.split === 'train')),
    validation: summarizeEventGroup(selected.filter(event => event.split === 'validation')),
    test: summarizeEventGroup(selected.filter(event => event.split === 'test')),
    by_regime: byRegime,
    test_by_regime: testByRegime,
  };
}

function compareMinimum(actual, expected, label, reasons) {
  if (!Number.isFinite(actual) || actual < expected) {
    reasons.push(`${label}: ${actual ?? 'null'} < ${expected}`);
  }
}

function compareMaximum(actual, expected, label, reasons) {
  if (!Number.isFinite(actual) || actual > expected) {
    reasons.push(`${label}: ${actual ?? 'null'} > ${expected}`);
  }
}

function evaluatePromotionGate(summary, definition) {
  const gate = definition.promotion_gate || {};
  const reasons = [];
  compareMinimum(summary.validation.event_count, Number(gate.min_validation_events || 0), 'validation events', reasons);
  compareMinimum(summary.test.event_count, Number(gate.min_test_events || 0), 'test events', reasons);

  if (definition.objective === 'risk_filter') {
    compareMaximum(
      summary.validation.average_excess_return_5d_pct,
      Number(gate.max_validation_average_excess_return_5d_pct ?? 0),
      'validation average excess return',
      reasons,
    );
    compareMaximum(
      summary.test.average_excess_return_5d_pct,
      Number(gate.max_test_average_excess_return_5d_pct ?? 0),
      'test average excess return',
      reasons,
    );
    compareMaximum(
      summary.test.positive_excess_return_5d_rate_pct,
      Number(gate.max_test_positive_excess_return_5d_rate_pct ?? 50),
      'test positive excess rate',
      reasons,
    );
  } else {
    compareMinimum(
      summary.validation.average_excess_return_5d_pct,
      Number(gate.min_validation_average_excess_return_5d_pct ?? 0),
      'validation average excess return',
      reasons,
    );
    compareMinimum(
      summary.test.average_excess_return_5d_pct,
      Number(gate.min_test_average_excess_return_5d_pct ?? 0),
      'test average excess return',
      reasons,
    );
    compareMinimum(
      summary.test.positive_excess_return_5d_rate_pct,
      Number(gate.min_test_positive_excess_return_5d_rate_pct ?? 50),
      'test positive excess rate',
      reasons,
    );
  }

  const minRegimeEvents = Number(gate.min_test_regime_events || 0);
  const qualifyingRegimes = Object.entries(summary.test_by_regime || {})
    .filter(([regime, group]) => regime !== 'unknown' && group.event_count >= minRegimeEvents);
  compareMinimum(
    qualifyingRegimes.length,
    Number(gate.min_test_regimes || 0),
    'qualified test regimes',
    reasons,
  );
  for (const [regime, group] of qualifyingRegimes) {
    if (definition.objective === 'risk_filter') {
      if (!Number.isFinite(group.average_excess_return_5d_pct) || group.average_excess_return_5d_pct >= 0) {
        reasons.push(`${regime} test regime did not underperform market`);
      }
    } else if (!Number.isFinite(group.average_excess_return_5d_pct) || group.average_excess_return_5d_pct <= 0) {
      reasons.push(`${regime} test regime did not outperform market`);
    }
  }
  return {
    status: reasons.length ? 'hold_research' : 'promotion_eligible',
    passed: reasons.length === 0,
    reasons,
    qualified_test_regimes: qualifyingRegimes.map(([regime]) => regime),
  };
}

function summarizeCandidates(events, definitions, rawSignalCount = {}, suppressedCount = {}) {
  const result = {};
  for (const definition of definitions) {
    const summary = summarizeCandidate(events, definition);
    summary.raw_signal_count = Number(rawSignalCount[definition.candidate_id] || 0);
    summary.independent_event_count = summary.all.event_count;
    summary.cooldown_suppressed_count = Number(suppressedCount[definition.candidate_id] || 0);
    summary.promotion_assessment = evaluatePromotionGate(summary, definition);
    result[definition.candidate_id] = summary;
  }
  return result;
}

function buildCompactSummary(payload) {
  return {
    schema_version: 1,
    research_id: payload.research_id,
    candidate_registry_id: payload.candidate_registry_id,
    generated_at: payload.generated_at,
    cutoff_date: payload.cutoff_date,
    source_date_range: payload.source_date_range,
    eligible_signal_date_range: payload.eligible_signal_date_range,
    chronological_splits: payload.chronological_splits,
    cooldown_trading_days: payload.cooldown_trading_days,
    market_regime_definition: payload.market_regime_definition,
    market_regime_signal_date_count: payload.market_regime_signal_date_count,
    leakage_guard: payload.leakage_guard,
    source_file_count: payload.source_file_count,
    candidate_definitions: payload.candidate_definitions,
    availability_observation_count: payload.availability_observation_count,
    raw_signal_count: payload.raw_signal_count,
    independent_event_count: Array.isArray(payload.events) ? payload.events.length : 0,
    cooldown_suppressed_count: Array.isArray(payload.cooldown_suppressed_events)
      ? payload.cooldown_suppressed_events.length
      : 0,
    summaries: payload.summaries,
  };
}

module.exports = {
  finiteNumber,
  round,
  percentile,
  median,
  average,
  rate,
  periodReturn,
  latestReturn,
  classifyMarketRegime,
  calculateCrowdingWeakening,
  normalizeState,
  evaluateExpression,
  deduplicateEvents,
  summarizeEventGroup,
  summarizeCandidate,
  evaluatePromotionGate,
  summarizeCandidates,
  buildCompactSummary,
};
