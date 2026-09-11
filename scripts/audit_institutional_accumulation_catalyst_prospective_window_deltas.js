'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { auditObservations } = require('./audit_institutional_accumulation_catalyst_prospective_observations');

const DELTA_AUDIT_ID = 'institutional-accumulation-catalyst-prospective-window-delta-audit-v1';
const OBSERVATION_AUDIT_RELATIVE = 'data_research/institutional-flow/institutional-accumulation-catalyst-prospective-observation-audit-v1.json';
const OUTPUT_RELATIVE = 'data_research/institutional-flow/institutional-accumulation-catalyst-prospective-window-delta-audit-v1.json';
const EXPECTED_STOCKS = ['1102', '1104', '1216'];
const EXPECTED_INTERFACES = ['prospective_material_information_detail', 'prospective_material_information_listing'];
const ALLOWED_SOURCE_OBSERVATION_COUNTS = [12, 18];

function assertIsoTimestamp(value, label) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)) {
    throw new Error(`invalid_collected_at:${label}`);
  }
  const ms = Date.parse(value);
  if (!Number.isFinite(ms)) throw new Error(`invalid_collected_at:${label}`);
  return ms;
}

function assertCommittedObservationAudit(repoRoot, canonicalAudit) {
  const committedPath = path.join(repoRoot, ...OBSERVATION_AUDIT_RELATIVE.split('/'));
  let committed;
  try {
    committed = JSON.parse(fs.readFileSync(committedPath, 'utf8'));
  } catch (error) {
    throw new Error(`observation_audit_unreadable:${error.message}`);
  }
  if (JSON.stringify(committed) !== JSON.stringify(canonicalAudit)) {
    throw new Error('observation_audit_not_canonical_current_state');
  }
}

function buildWindowDeltaAudit(repoRoot, options = {}) {
  const observationOptions = options.rootRelative ? { rootRelative: options.rootRelative, requireCurrentBaseline: false } : { requireCurrentBaseline: false };
  const source = auditObservations(repoRoot, observationOptions);

  if (!ALLOWED_SOURCE_OBSERVATION_COUNTS.includes(source.valid_observation_count) || source.invalid_observation_count !== 0 || source.conflict_count !== 0) {
    throw new Error(`unexpected_observation_shape:${source.valid_observation_count}/${source.invalid_observation_count}/${source.conflict_count}`);
  }
  if (source.stock_count !== 3 || source.unique_immutable_snapshot_count !== source.valid_observation_count) throw new Error('unexpected_observation_identity_count');
  const sourceWindowCount = source.valid_observation_count / 6;
  for (const stock of EXPECTED_STOCKS) {
    const bucket = source.stocks[stock];
    if (!bucket || bucket.total !== sourceWindowCount * 2 || bucket.listing !== sourceWindowCount || bucket.detail !== sourceWindowCount) throw new Error(`unexpected_stock_window_shape:${stock}`);
  }
  if (source.source_interface_counts.prospective_material_information_listing !== sourceWindowCount * 3 || source.source_interface_counts.prospective_material_information_detail !== sourceWindowCount * 3) {
    throw new Error('unexpected_interface_window_shape');
  }

  if (options.skipCommittedAuditCheck !== true) assertCommittedObservationAudit(repoRoot, source);

  const pairs = [];
  const selectedObservations = [];
  for (const stock of EXPECTED_STOCKS) {
    for (const sourceInterface of EXPECTED_INTERFACES) {
      const occurrences = source.observations
        .filter(x => x.stock === stock && x.source_interface === sourceInterface)
        .map(x => ({ ...x, collected_ms: assertIsoTimestamp(x.collected_at, `${stock}:${sourceInterface}`) }))
        .sort((a, b) => a.collected_ms - b.collected_ms || a.source_path.localeCompare(b.source_path));
      if (occurrences.length !== sourceWindowCount) throw new Error(`pair_occurrence_count:${stock}:${sourceInterface}:${occurrences.length}`);
      const [window1, window2] = occurrences;
      if (!window1 || !window2) throw new Error(`pair_missing_first_two:${stock}:${sourceInterface}`);
      if (window1.collected_ms === window2.collected_ms) throw new Error(`collection_time_tie:${stock}:${sourceInterface}`);
      if (window1.source_request_key !== window2.source_request_key) throw new Error(`source_request_key_mismatch:${stock}:${sourceInterface}`);
      if (window1.immutable_snapshot_id === window2.immutable_snapshot_id) throw new Error(`duplicate_window_immutable_identity:${stock}:${sourceInterface}`);
      selectedObservations.push(window1, window2);
      pairs.push({
        stock,
        source_interface: sourceInterface,
        source_request_key: window1.source_request_key,
        window_1: {
          source_path: window1.source_path,
          collected_at: window1.collected_at,
          immutable_snapshot_id: window1.immutable_snapshot_id,
          response_sha256: window1.response_sha256,
          response_bytes: window1.response_bytes,
        },
        window_2: {
          source_path: window2.source_path,
          collected_at: window2.collected_at,
          immutable_snapshot_id: window2.immutable_snapshot_id,
          response_sha256: window2.response_sha256,
          response_bytes: window2.response_bytes,
        },
        elapsed_milliseconds: window2.collected_ms - window1.collected_ms,
        raw_content_changed: window1.response_sha256 !== window2.response_sha256,
        response_bytes_delta: window2.response_bytes - window1.response_bytes,
      });
    }
  }

  const changedPairCount = pairs.filter(x => x.raw_content_changed).length;
  const allTimes = selectedObservations.map(x => ({ value: x.collected_at, ms: assertIsoTimestamp(x.collected_at, x.source_path) })).sort((a, b) => a.ms - b.ms);
  return {
    schema_version: 1,
    audit_id: DELTA_AUDIT_ID,
    source_observation_audit_id: source.audit_id,
    network_collection_used: false,
    observation_count: 12,
    pair_count: pairs.length,
    changed_pair_count: changedPairCount,
    unchanged_pair_count: pairs.length - changedPairCount,
    collection_time_range: {
      first: allTimes[0]?.value || null,
      last: allTimes.at(-1)?.value || null,
    },
    pairs,
    interpretation: {
      raw_content_change_is_not_catalyst_significance: true,
      outcome_association_opened: false,
    },
  };
}

function serializeAudit(audit) {
  return `${JSON.stringify(audit, null, 2)}\n`;
}

function main() {
  const repoRoot = process.cwd();
  const audit = buildWindowDeltaAudit(repoRoot);
  const serialized = serializeAudit(audit);
  if (process.argv.includes('--write')) {
    const output = path.join(repoRoot, ...OUTPUT_RELATIVE.split('/'));
    fs.writeFileSync(output, serialized);
    process.stdout.write(`${OUTPUT_RELATIVE}\n`);
    return;
  }
  process.stdout.write(serialized);
}

if (require.main === module) {
  try { main(); }
  catch (error) {
    console.error(error.stack || error.message);
    process.exitCode = 1;
  }
}

module.exports = {
  DELTA_AUDIT_ID,
  OBSERVATION_AUDIT_RELATIVE,
  OUTPUT_RELATIVE,
  EXPECTED_STOCKS,
  EXPECTED_INTERFACES,
  ALLOWED_SOURCE_OBSERVATION_COUNTS,
  assertIsoTimestamp,
  buildWindowDeltaAudit,
  serializeAudit,
};
