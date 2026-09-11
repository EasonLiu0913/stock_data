'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { auditObservations } = require('./audit_institutional_accumulation_catalyst_prospective_observations');

const AUDIT_ID = 'institutional-accumulation-catalyst-prospective-cross-day-audit-v1';
const OUTPUT_RELATIVE = 'data_research/institutional-flow/institutional-accumulation-catalyst-prospective-cross-day-audit-v1.json';
const EXPECTED_STOCKS = ['1102', '1104', '1216'];
const EXPECTED_INTERFACES = ['prospective_material_information_detail', 'prospective_material_information_listing'];
const MIN_ELAPSED_MS = 12 * 60 * 60 * 1000;

function parseUtc(value, label) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)) throw new Error(`invalid_collected_at:${label}`);
  const ms = Date.parse(value);
  if (!Number.isFinite(ms)) throw new Error(`invalid_collected_at:${label}`);
  return ms;
}

function taipeiDate(ms) {
  return new Date(ms + 8 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

function buildCrossDayAudit(repoRoot, options = {}) {
  const observationOptions = options.rootRelative ? { rootRelative: options.rootRelative } : {};
  const source = auditObservations(repoRoot, observationOptions);
  if (source.valid_observation_count !== 18 || source.invalid_observation_count !== 0 || source.conflict_count !== 0) {
    throw new Error(`unexpected_observation_shape:${source.valid_observation_count}/${source.invalid_observation_count}/${source.conflict_count}`);
  }
  if (source.unique_immutable_snapshot_count !== 18 || source.stock_count !== 3) throw new Error('unexpected_observation_identity_count');
  for (const stock of EXPECTED_STOCKS) {
    const bucket = source.stocks[stock];
    if (!bucket || bucket.total !== 6 || bucket.listing !== 3 || bucket.detail !== 3) throw new Error(`unexpected_stock_window_shape:${stock}`);
  }

  const chains = [];
  let latestPriorMs = -Infinity;
  let earliestThirdMs = Infinity;
  for (const stock of EXPECTED_STOCKS) {
    for (const sourceInterface of EXPECTED_INTERFACES) {
      const occurrences = source.observations
        .filter(x => x.stock === stock && x.source_interface === sourceInterface)
        .map(x => ({ ...x, collected_ms: parseUtc(x.collected_at, `${stock}:${sourceInterface}`) }))
        .sort((a, b) => a.collected_ms - b.collected_ms || a.source_path.localeCompare(b.source_path));
      if (occurrences.length !== 3) throw new Error(`occurrence_count:${stock}:${sourceInterface}:${occurrences.length}`);
      if (new Set(occurrences.map(x => x.source_request_key)).size !== 1) throw new Error(`source_request_key_mismatch:${stock}:${sourceInterface}`);
      for (let i = 1; i < occurrences.length; i += 1) {
        if (occurrences[i - 1].collected_ms === occurrences[i].collected_ms) throw new Error(`collection_time_tie:${stock}:${sourceInterface}`);
      }
      const [w1, w2, w3] = occurrences;
      latestPriorMs = Math.max(latestPriorMs, w2.collected_ms);
      earliestThirdMs = Math.min(earliestThirdMs, w3.collected_ms);
      chains.push({
        stock,
        source_interface: sourceInterface,
        source_request_key: w1.source_request_key,
        windows: [w1, w2, w3].map((x, index) => ({
          window: index + 1,
          source_path: x.source_path,
          collected_at: x.collected_at,
          asia_taipei_date: taipeiDate(x.collected_ms),
          immutable_snapshot_id: x.immutable_snapshot_id,
          response_sha256: x.response_sha256,
          response_bytes: x.response_bytes,
        })),
        window_2_to_3_elapsed_milliseconds: w3.collected_ms - w2.collected_ms,
      });
    }
  }

  const latestPriorDate = taipeiDate(latestPriorMs);
  const earliestThirdDate = taipeiDate(earliestThirdMs);
  const elapsedMs = earliestThirdMs - latestPriorMs;
  if (earliestThirdDate <= latestPriorDate) throw new Error(`cross_day_requirement_failed:${latestPriorDate}:${earliestThirdDate}`);
  if (elapsedMs < MIN_ELAPSED_MS) throw new Error(`minimum_elapsed_requirement_failed:${elapsedMs}`);

  return {
    schema_version: 1,
    audit_id: AUDIT_ID,
    source_observation_audit_id: source.audit_id,
    network_collection_used: false,
    observation_count: 18,
    chain_count: 6,
    stock_count: 3,
    unique_immutable_snapshot_count: source.unique_immutable_snapshot_count,
    unique_response_sha256_count: source.unique_response_sha256_count,
    collection_time_range: source.collection_time_range,
    cross_day_gate: {
      latest_prior_collected_at: new Date(latestPriorMs).toISOString(),
      latest_prior_asia_taipei_date: latestPriorDate,
      earliest_third_collected_at: new Date(earliestThirdMs).toISOString(),
      earliest_third_asia_taipei_date: earliestThirdDate,
      elapsed_milliseconds: elapsedMs,
      minimum_elapsed_milliseconds: MIN_ELAPSED_MS,
      later_asia_taipei_date: true,
      minimum_elapsed_satisfied: true,
    },
    chains,
    interpretation: {
      raw_content_change_is_not_catalyst_significance: true,
      outcome_association_opened: false,
      scheduler_authorized: false,
      broad_universe_authorized: false,
    },
  };
}

function serializeAudit(audit) { return `${JSON.stringify(audit, null, 2)}\n`; }

function main() {
  const audit = buildCrossDayAudit(process.cwd());
  const serialized = serializeAudit(audit);
  if (process.argv.includes('--write')) {
    const output = path.join(process.cwd(), ...OUTPUT_RELATIVE.split('/'));
    fs.writeFileSync(output, serialized);
    process.stdout.write(`${OUTPUT_RELATIVE}\n`);
    return;
  }
  process.stdout.write(serialized);
}

if (require.main === module) {
  try { main(); } catch (error) { console.error(error.stack || error.message); process.exitCode = 1; }
}

module.exports = { AUDIT_ID, OUTPUT_RELATIVE, EXPECTED_STOCKS, EXPECTED_INTERFACES, MIN_ELAPSED_MS, parseUtc, taipeiDate, buildCrossDayAudit, serializeAudit };
