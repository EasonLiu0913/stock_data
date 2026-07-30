'use strict';

function finite(value) {
  return Number.isFinite(Number(value));
}

function triggerMap(triggers) {
  return new Map((Array.isArray(triggers) ? triggers : []).map((item) => [item.id, item]));
}

function evaluateFirstDayShockGate(triggers) {
  const byId = triggerMap(triggers);
  const soxOneDay = Number(byId.get('sox_1d_drop')?.value);
  const taiwanNotRepriced = byId.has('twse_not_repriced');
  const accumulatedExternalDrop = byId.has('sox_3d_drop');
  const foreignShortAcceleration = byId.has('foreign_futures_short_increase');
  const severeExternalOneDayDrop = finite(soxOneDay) && soxOneDay <= -3;
  const externalAcceleration = accumulatedExternalDrop || foreignShortAcceleration || severeExternalOneDayDrop;

  return {
    passed: taiwanNotRepriced && externalAcceleration,
    required_conditions: {
      taiwan_not_repriced: taiwanNotRepriced,
      external_acceleration: externalAcceleration,
    },
    supporting_conditions: {
      accumulated_external_drop: accumulatedExternalDrop,
      foreign_short_acceleration: foreignShortAcceleration,
      severe_external_one_day_drop: severeExternalOneDayDrop,
    },
    explanation: taiwanNotRepriced
      ? externalAcceleration
        ? '台股尚未補跌，且外部跌勢或外資空單仍在惡化。'
        : '台股尚未補跌，但缺少外部跌勢持續惡化的確認。'
      : '台股前一日已明顯下跌，不能再視為尚未反映外部衝擊的首日。',
  };
}

function classifyPredictedEnvironment({ score, triggers, previousActualCode = null, dataValid = true }) {
  const numericScore = Number(score);
  const shockGate = evaluateFirstDayShockGate(triggers);

  if (!dataValid) return { code: 'data_invalid', shock_gate: shockGate };
  if (previousActualCode === 'systemic_selloff_first_day') {
    return { code: 'post_shock_day_1', shock_gate: shockGate };
  }
  if (['post_shock_stress', 'market_stress'].includes(previousActualCode)) {
    return { code: 'post_shock_day_2', shock_gate: shockGate };
  }
  if (Number.isFinite(numericScore) && numericScore >= 6 && shockGate.passed) {
    return { code: 'shock_first_day_warning', shock_gate: shockGate };
  }
  if (Number.isFinite(numericScore) && numericScore >= 4) {
    return { code: 'risk_warning', shock_gate: shockGate };
  }
  return { code: 'normal', shock_gate: shockGate };
}

module.exports = {
  evaluateFirstDayShockGate,
  classifyPredictedEnvironment,
};
