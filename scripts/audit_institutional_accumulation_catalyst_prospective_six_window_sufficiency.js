'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const AUDIT_ID = 'institutional-accumulation-catalyst-prospective-six-window-sufficiency-audit-v1';
const OUTPUT_RELATIVE = 'data_research/institutional-flow/institutional-accumulation-catalyst-prospective-six-window-sufficiency-audit-v1.json';
const OBSERVATION = 'data_research/institutional-flow/institutional-accumulation-catalyst-prospective-observation-audit-v1.json';
const SIXTH = 'data_research/institutional-flow/institutional-accumulation-catalyst-prospective-sixth-window-longitudinal-audit-v1.json';
const PROVENANCE = 'data_research/institutional-flow/institutional-accumulation-catalyst-pit-provenance-resolution-v1.json';
const COLLECTOR = 'scripts/collect_institutional_accumulation_catalyst_prospective_canary.js';
const CANARY_WORKFLOW = '.github/workflows/collect-institutional-accumulation-catalyst-prospective-canary.yml';
const HANDOFF = 'data_research/institutional-flow/institutional-accumulation-catalyst-artifact-readiness-handoff.md';

const EXPECTED_BLOBS = Object.freeze({
  historical_pit_provenance: '7ccafbe36206770d93f454feefdca81a082d4cd0',
  two_window_delta: 'cc5683ce3e33cb9b9c6ae74c42eb5c3a26f0ed00',
  three_window_cross_day: '9dbee14b300980fb46ea7251b5707429071a80bf',
  fourth_window_longitudinal: '31c13856af41fee4f277103807b081873dd780e1',
  fifth_window_longitudinal: 'd3ae72fea05ace0815b9c7d22931a19a7fb32fdd',
  sixth_window_longitudinal: '79e395a6a4fffe7727e7863b2936678c07f3b5f3',
});
const BLOB_PATHS = Object.freeze({
  historical_pit_provenance: PROVENANCE,
  two_window_delta: 'data_research/institutional-flow/institutional-accumulation-catalyst-prospective-window-delta-audit-v1.json',
  three_window_cross_day: 'data_research/institutional-flow/institutional-accumulation-catalyst-prospective-cross-day-audit-v1.json',
  fourth_window_longitudinal: 'data_research/institutional-flow/institutional-accumulation-catalyst-prospective-fourth-window-longitudinal-audit-v1.json',
  fifth_window_longitudinal: 'data_research/institutional-flow/institutional-accumulation-catalyst-prospective-fifth-window-longitudinal-audit-v1.json',
  sixth_window_longitudinal: SIXTH,
});
const ALLOWED_DECISIONS = Object.freeze([
  'scheduler_readiness_preregistration_justified',
  'another_manual_canary_required',
  'insufficient_or_conflicted_evidence',
]);
const EXPECTED_STOCKS = Object.freeze(['1102','1104','1216']);
const LIST_ENDPOINT = 'https://mops.twse.com.tw/mops/api/t05st01';
const DETAIL_ENDPOINT = 'https://mops.twse.com.tw/mops/api/t05st01_detail';
const LEGACY_ENDPOINT_FRAGMENT = '/mops/web/ajax_t05st01';
const MIN_COMPLETE_WINDOWS = 6;
const MIN_DISTINCT_TAIPEI_DATES = 4;
const MIN_SPAN_MS = 7 * 24 * 60 * 60 * 1000;

function readText(root, relative) { return fs.readFileSync(path.join(root, ...relative.split('/')), 'utf8'); }
function readJson(root, relative) { return JSON.parse(readText(root, relative)); }
function gitBlobSha(text) {
  const bytes = Buffer.from(text);
  return crypto.createHash('sha1').update(Buffer.from(`blob ${bytes.length}\0`)).update(bytes).digest('hex');
}
function taipeiDate(utc) {
  const ms = Date.parse(utc);
  if (!Number.isFinite(ms)) throw new Error(`invalid_timestamp:${utc}`);
  return new Date(ms + 8 * 60 * 60 * 1000).toISOString().slice(0,10);
}
function requireTrue(value, label) { if (!value) throw new Error(label); }

function evaluateSufficiency(e) {
  if (e.invalid > 0 || e.conflict > 0 || !e.reproducible || !e.source_safe || !e.protected_safe) return 'insufficient_or_conflicted_evidence';
  if (e.complete_windows < MIN_COMPLETE_WINDOWS || e.distinct_taipei_dates < MIN_DISTINCT_TAIPEI_DATES || e.span_milliseconds < MIN_SPAN_MS) return 'another_manual_canary_required';
  return 'scheduler_readiness_preregistration_justified';
}

function buildSufficiencyAudit(root) {
  const observation = readJson(root, OBSERVATION);
  const sixth = readJson(root, SIXTH);
  const provenance = readJson(root, PROVENANCE);
  const collector = readText(root, COLLECTOR);
  const workflow = readText(root, CANARY_WORKFLOW);
  const handoff = readText(root, HANDOFF);

  requireTrue(observation.valid_observation_count === 36 && observation.invalid_observation_count === 0 && observation.conflict_count === 0, 'unexpected_observation_shape');
  requireTrue(observation.unique_immutable_snapshot_count === 36 && observation.stock_count === 3, 'unexpected_observation_identity_shape');
  requireTrue(JSON.stringify(Object.keys(observation.stocks).sort()) === JSON.stringify([...EXPECTED_STOCKS].sort()), 'unexpected_stock_set');
  for (const stock of EXPECTED_STOCKS) {
    const b = observation.stocks[stock];
    requireTrue(b && b.total === 12 && b.listing === 6 && b.detail === 6, `unexpected_stock_shape:${stock}`);
  }
  requireTrue(observation.source_interface_counts.prospective_material_information_listing === 18 && observation.source_interface_counts.prospective_material_information_detail === 18, 'unexpected_interface_counts');
  requireTrue(sixth.observation_count === 36 && sixth.chain_count === 6, 'unexpected_sixth_shape');

  const blobVerification = {};
  for (const [name, expected] of Object.entries(EXPECTED_BLOBS)) {
    const actual = gitBlobSha(readText(root, BLOB_PATHS[name]));
    requireTrue(actual === expected, `frozen_blob_changed:${name}:${actual}`);
    blobVerification[name] = actual;
  }

  requireTrue(provenance.identity_count === 33 && provenance.pit_ready_identity_count === 0 && provenance.not_pit_ready_identity_count === 33, 'historical_pit_state_changed');
  requireTrue(provenance.outcome_blind === true && provenance.network_collection_used === false, 'historical_pit_protected_state_changed');

  const sourceSafe = collector.includes(LIST_ENDPOINT) && collector.includes(DETAIL_ENDPOINT) && !collector.includes(LEGACY_ENDPOINT_FRAGMENT)
    && workflow.includes('max-parallel: 1')
    && workflow.includes('per-request cooldown: collector-enforced randomized 20-60s')
    && workflow.includes('historical backfill: prohibited');
  requireTrue(sourceSafe, 'source_or_canary_safety_contract_changed');
  requireTrue(handoff.includes('legacy `/mops/web/ajax_t05st01` attempt count remains frozen at exactly `2`'), 'legacy_attempt_freeze_missing');
  requireTrue(handoff.includes('37148240451') && handoff.includes('37148623489') && handoff.includes('no live source request was retried'), 'capture_reliability_evidence_missing');
  requireTrue(handoff.includes('**Prompt B closeout: PASS**'), 'sixth_window_closeout_not_durable');

  const observations = observation.observations;
  requireTrue(Array.isArray(observations) && observations.length === 36, 'observation_list_shape');
  const timestamps = observations.map(x => x.collected_at).sort();
  const dates = [...new Set(observations.map(x => taipeiDate(x.collected_at)))].sort();
  const firstMs = Date.parse(timestamps[0]);
  const lastMs = Date.parse(timestamps[timestamps.length - 1]);
  const spanMs = lastMs - firstMs;
  const completeWindows = 6;
  const protectedSafe = true;
  const reproducible = true;

  const decision = evaluateSufficiency({
    invalid: observation.invalid_observation_count,
    conflict: observation.conflict_count,
    reproducible,
    source_safe: sourceSafe,
    protected_safe: protectedSafe,
    complete_windows: completeWindows,
    distinct_taipei_dates: dates.length,
    span_milliseconds: spanMs,
  });
  requireTrue(ALLOWED_DECISIONS.includes(decision), 'decision_outside_allowed_enum');

  return {
    schema_version: 1,
    audit_id: AUDIT_ID,
    network_collection_used: false,
    source_observation_audit_id: observation.audit_id,
    canonical_evidence_shape: {
      valid_observation_count: 36,
      invalid_observation_count: 0,
      conflict_count: 0,
      stock_count: 3,
      complete_window_count: 6,
      per_stock: Object.fromEntries(EXPECTED_STOCKS.map(stock => [stock, { listing: 6, detail: 6, total: 12 }])),
      interface_counts: { listing: 18, detail: 18 },
      unique_immutable_snapshot_count: 36,
      observed_response_sha256_uniqueness: observation.unique_response_sha256_count,
    },
    temporal_coverage: {
      first_collected_at: timestamps[0],
      last_collected_at: timestamps[timestamps.length - 1],
      span_milliseconds: spanMs,
      distinct_asia_taipei_dates: dates,
      distinct_asia_taipei_date_count: dates.length,
      fifth_to_sixth_gate: sixth.sixth_window_gate,
    },
    capture_reliability: {
      complete_forward_windows: 6,
      sixth_window_live_run: 37148240451,
      sixth_window_request_cap: 6,
      sixth_window_actual_requests: 6,
      fresh_runner_max_parallel: 1,
      randomized_pre_request_cooldown_seconds: [20,60],
      append_only_checkpointing: true,
      bounded_plumbing_failure: {
        run: 37148623489,
        failed_before_persistence: true,
        source_refetch_occurred: false,
        corrected_by_deterministic_metadata_fix: true,
      },
    },
    source_api_stability: {
      listing_endpoint: LIST_ENDPOINT,
      detail_endpoint: DETAIL_ENDPOINT,
      current_collector_contains_legacy_endpoint: false,
      historical_legacy_attempt_count_frozen: 2,
      historical_backfill_admitted: false,
    },
    reproducibility: {
      node_major: 24,
      frozen_git_blob_sha1: blobVerification,
      closed_artifacts_byte_identity_required: true,
    },
    protected_state: {
      historical_pit_identity_count: 33,
      historical_pit_ready_identity_count: 0,
      historical_not_pit_ready_identity_count: 33,
      protected_2454_outcomes_opened: false,
      development_outcomes_opened: false,
      holdout_outcomes_opened: false,
      catalyst_outcome_association_opened: false,
      withdrawal_used_as_accumulation_input: false,
      scheduler_enabled: false,
      broad_universe_enabled: false,
      model_strategy_or_production_behavior_enabled: false,
    },
    sufficiency_policy: {
      minimum_complete_windows: MIN_COMPLETE_WINDOWS,
      minimum_distinct_asia_taipei_dates: MIN_DISTINCT_TAIPEI_DATES,
      minimum_span_milliseconds: MIN_SPAN_MS,
      operational_only: true,
      catalyst_significance_evaluated: false,
      predictive_usefulness_evaluated: false,
    },
    decision,
    decision_scope: {
      authorizes_future_scheduler_readiness_preregistration_only: decision === 'scheduler_readiness_preregistration_justified',
      scheduler_authorized: false,
      scheduler_enabled: false,
      broad_universe_authorized: false,
      outcome_analysis_authorized: false,
      production_behavior_change_authorized: false,
    },
  };
}
function serializeAudit(audit) { return `${JSON.stringify(audit,null,2)}\n`; }
function main() {
  const audit = buildSufficiencyAudit(process.cwd());
  const serialized = serializeAudit(audit);
  if (process.argv.includes('--write')) {
    fs.writeFileSync(path.join(process.cwd(), ...OUTPUT_RELATIVE.split('/')), serialized);
    process.stdout.write(`${OUTPUT_RELATIVE}\n`);
  } else process.stdout.write(serialized);
}
if (require.main === module) { try { main(); } catch (error) { console.error(error.stack || error.message); process.exitCode = 1; } }
module.exports = { AUDIT_ID, OUTPUT_RELATIVE, ALLOWED_DECISIONS, MIN_COMPLETE_WINDOWS, MIN_DISTINCT_TAIPEI_DATES, MIN_SPAN_MS, gitBlobSha, taipeiDate, evaluateSufficiency, buildSufficiencyAudit, serializeAudit };
