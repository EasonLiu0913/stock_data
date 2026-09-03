'use strict';

const { indicatorById, trailingReturn, round } = require('./market_environment_lib');

const OIL_UPSIDE_SHOCK_1D_PCT = 5;
const OIL_UPSIDE_SHOCK_5D_PCT = 10;
const OIL_DOWNSIDE_SHOCK_1D_PCT = -5;
const OIL_DOWNSIDE_SHOCK_5D_PCT = -10;

function finiteOrNull(value) {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function roundOrNull(value, digits = 2) {
  const number = finiteOrNull(value);
  return number === null ? null : round(number, digits);
}

function averageFinite(values) {
  const finite = values.filter(Number.isFinite);
  if (!finite.length) return null;
  return finite.reduce((sum, value) => sum + value, 0) / finite.length;
}

function instrumentMetrics(indicator) {
  if (!indicator) {
    return {
      available: false,
      market_date: null,
      close: null,
      change_1d_pct: null,
      return_5d_pct: null,
      return_20d_pct: null,
    };
  }
  return {
    available: true,
    market_date: indicator.market_date || null,
    close: finiteOrNull(indicator.close),
    change_1d_pct: roundOrNull(indicator.change_percent),
    return_5d_pct: roundOrNull(trailingReturn(indicator, 5)),
    return_20d_pct: roundOrNull(trailingReturn(indicator, 20)),
  };
}

function classifyOilTrend(wti, brent) {
  const mean5d = averageFinite([wti.return_5d_pct, brent.return_5d_pct]);
  const mean20d = averageFinite([wti.return_20d_pct, brent.return_20d_pct]);
  if (!Number.isFinite(mean5d) && !Number.isFinite(mean20d)) {
    return { code: 'unavailable', label: '資料不足', mean_5d_pct: null, mean_20d_pct: null };
  }

  const basis = Number.isFinite(mean5d) ? mean5d : mean20d;
  let code = 'flat';
  let label = '震盪';
  if (basis >= 8) {
    code = 'strong_up';
    label = '強勢上漲';
  } else if (basis >= 3) {
    code = 'up';
    label = '偏多';
  } else if (basis <= -8) {
    code = 'strong_down';
    label = '快速下跌';
  } else if (basis <= -3) {
    code = 'down';
    label = '偏空';
  }

  return {
    code,
    label,
    basis: Number.isFinite(mean5d) ? 'mean_wti_brent_5d' : 'mean_wti_brent_20d',
    mean_5d_pct: roundOrNull(mean5d),
    mean_20d_pct: roundOrNull(mean20d),
  };
}

function classifyOilShock(wti, brent) {
  const oneDay = [wti.change_1d_pct, brent.change_1d_pct].filter(Number.isFinite);
  const fiveDay = [wti.return_5d_pct, brent.return_5d_pct].filter(Number.isFinite);
  if (!oneDay.length && !fiveDay.length) {
    return {
      active: false,
      direction: 'unavailable',
      reason: 'insufficient_data',
    };
  }

  const max1d = oneDay.length ? Math.max(...oneDay) : null;
  const min1d = oneDay.length ? Math.min(...oneDay) : null;
  const max5d = fiveDay.length ? Math.max(...fiveDay) : null;
  const min5d = fiveDay.length ? Math.min(...fiveDay) : null;
  const upside = (Number.isFinite(max1d) && max1d >= OIL_UPSIDE_SHOCK_1D_PCT)
    || (Number.isFinite(max5d) && max5d >= OIL_UPSIDE_SHOCK_5D_PCT);
  const downside = (Number.isFinite(min1d) && min1d <= OIL_DOWNSIDE_SHOCK_1D_PCT)
    || (Number.isFinite(min5d) && min5d <= OIL_DOWNSIDE_SHOCK_5D_PCT);

  let direction = 'none';
  if (upside && downside) direction = 'mixed_extreme';
  else if (upside) direction = 'upside';
  else if (downside) direction = 'downside';

  return {
    active: upside || downside,
    direction,
    reason: upside || downside ? 'threshold_exceeded' : 'within_thresholds',
    observed: {
      max_1d_pct: roundOrNull(max1d),
      min_1d_pct: roundOrNull(min1d),
      max_5d_pct: roundOrNull(max5d),
      min_5d_pct: roundOrNull(min5d),
    },
    thresholds: {
      upside_1d_pct: OIL_UPSIDE_SHOCK_1D_PCT,
      upside_5d_pct: OIL_UPSIDE_SHOCK_5D_PCT,
      downside_1d_pct: OIL_DOWNSIDE_SHOCK_1D_PCT,
      downside_5d_pct: OIL_DOWNSIDE_SHOCK_5D_PCT,
    },
  };
}

function buildOilMarketContext(external) {
  const wti = instrumentMetrics(indicatorById(external, 'wti_crude_oil'));
  const brent = instrumentMetrics(indicatorById(external, 'brent_crude_oil'));
  return {
    source: 'yahoo_finance_futures',
    scoring_effect: 'none_shadow_context',
    instruments: { wti, brent },
    oil_trend: classifyOilTrend(wti, brent),
    oil_shock: classifyOilShock(wti, brent),
  };
}

module.exports = {
  buildOilMarketContext,
  classifyOilTrend,
  classifyOilShock,
  instrumentMetrics,
};
