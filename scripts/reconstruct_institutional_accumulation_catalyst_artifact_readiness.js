'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const FROZEN_PATH = path.join(ROOT, 'data_research/institutional-flow/institutional-accumulation-official-disclosure-artifact-reconstruction-v1.json');
const WAVE_A_META = path.join(ROOT, 'data_research/institutional-flow/official-disclosure-raw/mops-monthly-revenue/202607/source-meta.json');
const OUTPUT_PATH = path.join(ROOT, 'data_research/institutional-flow/institutional-accumulation-catalyst-artifact-reconstruction-readiness-v1.json');

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function parseYYYYMMDD(value) {
  if (!/^\d{8}$/.test(String(value || ''))) throw new Error(`Invalid YYYYMMDD: ${value}`);
  return Number(value);
}

function listingMetaPath(stock) {
  return path.join(ROOT, 'data_research/institutional-flow/official-disclosure-raw/mops-material-information/listings/115', String(stock), 'source-meta.json');
}

function main() {
  const frozen = readJson(FROZEN_PATH);
  const missing = frozen.decisions.filter((row) => row.state === 'source_missing');
  if (missing.length !== 33) throw new Error(`Expected exactly 33 frozen source_missing identities, got ${missing.length}`);
  const frozenKeys = missing.map((row) => `${row.stock}|${row.t0}`);
  if (new Set(frozenKeys).size !== 33) throw new Error('Frozen source_missing identities contain duplicates');

  const waveA = readJson(WAVE_A_META);
  if (waveA.quality_state !== 'quality_passed') throw new Error('Wave A quality not passed');

  const decisions = missing.map((row) => {
    const waveCPath = listingMetaPath(row.stock);
    const waveC = readJson(waveCPath);
    if (waveC.stock_id !== String(row.stock)) throw new Error(`Wave C stock mismatch for ${row.stock}`);
    if (waveC.quality_state !== 'quality_passed') throw new Error(`Wave C quality not passed for ${row.stock}`);
    if (waveC.source_timestamp_precision !== 'listing_only') throw new Error(`Unexpected Wave C timestamp precision for ${row.stock}`);
    if (waveC.parser_version !== 'institutional-accumulation-material-information-wave-c-v1') throw new Error(`Unexpected Wave C parser for ${row.stock}`);
    if (!String(waveC.version_safety || '').includes('unproven')) throw new Error(`Wave C version safety unexpectedly promoted for ${row.stock}`);
    if (waveC.pit_known_at != null) throw new Error(`Wave C PIT known-at unexpectedly populated for ${row.stock}`);
    if (waveA.pit_known_at == null || parseYYYYMMDD(waveA.pit_known_at) <= parseYYYYMMDD(row.t0)) {
      throw new Error(`Wave A PIT timing unexpectedly became usable for ${row.stock}|${row.t0}`);
    }
    return {
      stock: String(row.stock),
      t0: String(row.t0),
      source_identity: `${row.stock}|${row.t0}`,
      wave_c_listing_source_meta_path: path.relative(ROOT, waveCPath).replaceAll(path.sep, '/'),
    };
  });

  const output = {
    schema_version: 1,
    reconstruction_id: 'institutional-accumulation-catalyst-artifact-reconstruction-readiness-v1',
    generated_from_checked_in_evidence_only: true,
    network_collection_used: false,
    outcome_blind: true,
    protected_2454_outcomes_read: false,
    development_outcome_values_read: false,
    holdout_outcomes_read: false,
    identity_count: 33,
    ready_identity_count: 0,
    not_ready_identity_count: 33,
    pit_disclaimer: 'Current collection time/API visibility is audit metadata only and never historical PIT proof. Evidence is readiness-positive only when checked-in provenance establishes historical known-at timing and acceptable value-version safety.',
    wave_a: {
      source_meta_path: path.relative(ROOT, WAVE_A_META).replaceAll(path.sep, '/'),
      source_provider: waveA.source_provider ?? null,
      source_interface: waveA.source_interface ?? null,
      source_reported_date: waveA.source_reported_date ?? null,
      source_reported_time: waveA.source_reported_time ?? null,
      source_timestamp_precision: waveA.source_timestamp_precision ?? null,
      parser_version: waveA.parser_version ?? null,
      quality_state: waveA.quality_state ?? null,
      version_safety: waveA.version_safety ?? null,
      pit_known_at: waveA.pit_known_at ?? null,
      readiness_effect: 'not_pit_ready_for_all_frozen_t0s',
    },
    decision_defaults: {
      original_state: 'source_missing',
      readiness_state: 'not_pit_ready',
      manual_review: true,
      positive_imputation: false,
      wave_a_pit_known_at: waveA.pit_known_at ?? null,
      wave_a_version_safety: waveA.version_safety ?? null,
      wave_c_source_timestamp_precision: 'listing_only',
      wave_c_parser_version: 'institutional-accumulation-material-information-wave-c-v1',
      wave_c_version_safety: 'historical_timing_safe_value_version_unproven',
      wave_c_pit_known_at: null,
      reason_codes: [
        'wave_a_known_after_t0',
        'wave_c_historical_value_version_unproven',
        'wave_c_pit_known_at_unproven',
      ],
    },
    decisions,
  };

  fs.writeFileSync(OUTPUT_PATH, `${JSON.stringify(output, null, 2)}\n`);
  console.log(JSON.stringify({ output: path.relative(ROOT, OUTPUT_PATH).replaceAll(path.sep, '/'), identities: 33, ready: 0, not_ready: 33, network_requests: 0 }));
}

if (require.main === module) main();
module.exports = { main };
