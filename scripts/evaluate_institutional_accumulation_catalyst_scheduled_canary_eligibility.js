'use strict';

const MIN_ELAPSED_MS = 12 * 60 * 60 * 1000;
const FROZEN_STOCKS = Object.freeze(['1102', '1104', '1216']);
const CANDIDATE_LOCAL_TIME = '11:30';
const CANDIDATE_TIMEZONE = 'Asia/Taipei';
const LIST_ENDPOINT = 'https://mops.twse.com.tw/mops/api/t05st01';
const DETAIL_ENDPOINT = 'https://mops.twse.com.tw/mops/api/t05st01_detail';

const ELIGIBLE = 'eligible';
const INELIGIBLE_DATE = 'ineligible_same_or_earlier_taipei_date';
const INELIGIBLE_ELAPSED = 'ineligible_elapsed_under_12h';
const INVALID = 'invalid_or_conflicted_state';

function taipeiDate(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: CANDIDATE_TIMEZONE,
    year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(d);
  const values = Object.fromEntries(parts.map(p => [p.type, p.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function validateCanonicalObservationState(state) {
  if (!state || typeof state !== 'object') return false;
  if (state.invalid_observation_count !== 0 || state.conflict_count !== 0) return false;
  if (!Number.isInteger(state.valid_observation_count) || state.valid_observation_count <= 0) return false;
  if (state.stock_count !== 3) return false;
  if (JSON.stringify(Object.keys(state.stocks || {}).sort()) !== JSON.stringify([...FROZEN_STOCKS].sort())) return false;
  const latest = state.collection_time_range?.last;
  if (!latest || Number.isNaN(new Date(latest).getTime())) return false;
  if (!Array.isArray(state.observations) || state.observations.length !== state.valid_observation_count) return false;
  const max = state.observations.reduce((m, row) => {
    const t = Date.parse(row?.collected_at);
    return Number.isFinite(t) && t > m ? t : m;
  }, -Infinity);
  if (!Number.isFinite(max) || new Date(max).toISOString() !== new Date(latest).toISOString()) return false;
  return true;
}

function evaluateEligibility(state, candidateTimestamp) {
  if (!validateCanonicalObservationState(state)) {
    return {
      result: INVALID,
      source_requests_authorized: 0,
      latest_accepted_timestamp: state?.collection_time_range?.last ?? null,
      candidate_timestamp: candidateTimestamp ?? null,
      latest_asia_taipei_date: null,
      candidate_asia_taipei_date: taipeiDate(candidateTimestamp),
      elapsed_milliseconds: null,
    };
  }

  const candidateMs = Date.parse(candidateTimestamp);
  const latest = state.collection_time_range.last;
  const latestMs = Date.parse(latest);
  const latestDate = taipeiDate(latest);
  const candidateDate = taipeiDate(candidateTimestamp);
  if (!Number.isFinite(candidateMs) || !candidateDate) {
    return {
      result: INVALID,
      source_requests_authorized: 0,
      latest_accepted_timestamp: latest,
      candidate_timestamp: candidateTimestamp ?? null,
      latest_asia_taipei_date: latestDate,
      candidate_asia_taipei_date: candidateDate,
      elapsed_milliseconds: null,
    };
  }

  const elapsed = candidateMs - latestMs;
  if (candidateDate <= latestDate) {
    return {
      result: INELIGIBLE_DATE,
      source_requests_authorized: 0,
      latest_accepted_timestamp: latest,
      candidate_timestamp: candidateTimestamp,
      latest_asia_taipei_date: latestDate,
      candidate_asia_taipei_date: candidateDate,
      elapsed_milliseconds: elapsed,
    };
  }
  if (elapsed < MIN_ELAPSED_MS) {
    return {
      result: INELIGIBLE_ELAPSED,
      source_requests_authorized: 0,
      latest_accepted_timestamp: latest,
      candidate_timestamp: candidateTimestamp,
      latest_asia_taipei_date: latestDate,
      candidate_asia_taipei_date: candidateDate,
      elapsed_milliseconds: elapsed,
    };
  }

  return {
    result: ELIGIBLE,
    source_requests_authorized: 6,
    latest_accepted_timestamp: latest,
    candidate_timestamp: candidateTimestamp,
    latest_asia_taipei_date: latestDate,
    candidate_asia_taipei_date: candidateDate,
    elapsed_milliseconds: elapsed,
  };
}

function buildObservabilityRecord(evaluation) {
  const requestCountPerStock = Object.fromEntries(FROZEN_STOCKS.map(s => [s, 0]));
  const snapshotCountPerStock = Object.fromEntries(FROZEN_STOCKS.map(s => [s, 0]));
  const terminalReason = evaluation.result === ELIGIBLE ? 'eligible_not_executed_in_readiness_round' : evaluation.result;
  return {
    candidate_contract: {
      enabled: false,
      local_time: CANDIDATE_LOCAL_TIME,
      timezone: CANDIDATE_TIMEZONE,
    },
    eligibility_latest_accepted_timestamp: evaluation.latest_accepted_timestamp,
    eligibility_candidate_timestamp: evaluation.candidate_timestamp,
    eligibility_latest_asia_taipei_date: evaluation.latest_asia_taipei_date,
    eligibility_asia_taipei_date: evaluation.candidate_asia_taipei_date,
    eligibility_elapsed_milliseconds: evaluation.elapsed_milliseconds,
    eligibility_result: evaluation.result,
    source_requests_authorized: evaluation.result === ELIGIBLE ? 6 : 0,
    request_count_per_stock: requestCountPerStock,
    snapshot_count_per_stock: snapshotCountPerStock,
    source_endpoints_used: [],
    admitted_source_endpoints: [LIST_ENDPOINT, DETAIL_ENDPOINT],
    accepted_snapshot_paths: [],
    accepted_snapshot_ids: [],
    terminal_reason: terminalReason,
  };
}

module.exports = {
  MIN_ELAPSED_MS,
  FROZEN_STOCKS,
  CANDIDATE_LOCAL_TIME,
  CANDIDATE_TIMEZONE,
  LIST_ENDPOINT,
  DETAIL_ENDPOINT,
  ELIGIBLE,
  INELIGIBLE_DATE,
  INELIGIBLE_ELAPSED,
  INVALID,
  taipeiDate,
  validateCanonicalObservationState,
  evaluateEligibility,
  buildObservabilityRecord,
};
