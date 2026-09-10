'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const SCRIPT = path.join(ROOT, 'scripts/reconstruct_institutional_accumulation_catalyst_artifact_readiness.js');
const FROZEN = path.join(ROOT, 'data_research/institutional-flow/institutional-accumulation-official-disclosure-artifact-reconstruction-v1.json');
const OUTPUT = path.join(ROOT, 'data_research/institutional-flow/institutional-accumulation-catalyst-artifact-reconstruction-readiness-v1.json');

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

execFileSync(process.execPath, [SCRIPT], { cwd: ROOT, stdio: 'pipe' });

const frozen = readJson(FROZEN).decisions.filter((row) => row.state === 'source_missing');
const output = readJson(OUTPUT);

assert.strictEqual(frozen.length, 33);
assert.strictEqual(output.identity_count, 33);
assert.strictEqual(output.decisions.length, 33);
assert.strictEqual(output.network_collection_used, false);
assert.strictEqual(output.outcome_blind, true);
assert.strictEqual(output.protected_2454_outcomes_read, false);
assert.strictEqual(output.development_outcome_values_read, false);
assert.strictEqual(output.holdout_outcomes_read, false);
assert.strictEqual(output.ready_identity_count, 0);
assert.strictEqual(output.not_ready_identity_count, 33);

const frozenKeys = frozen.map((row) => `${row.stock}|${row.t0}`).sort();
const outputKeys = output.decisions.map((row) => row.source_identity).sort();
assert.deepStrictEqual(outputKeys, frozenKeys);
assert.strictEqual(new Set(outputKeys).size, 33);

for (const row of output.decisions) {
  assert.strictEqual(row.readiness_state, 'not_pit_ready');
  assert.strictEqual(row.manual_review, true);
  assert.strictEqual(row.positive_imputation, false);
  assert.ok(row.reason_codes.includes('wave_a_known_after_t0'));
  assert.ok(row.reason_codes.includes('wave_c_historical_value_version_unproven'));
  assert.ok(row.reason_codes.includes('wave_c_pit_known_at_unproven'));
  assert.strictEqual(row.wave_c_source_timestamp_precision, 'listing_only');
  assert.strictEqual(row.wave_c_parser_version, 'institutional-accumulation-material-information-wave-c-v1');
  assert.strictEqual(row.wave_c_version_safety, 'historical_timing_safe_value_version_unproven');
  assert.strictEqual(row.wave_c_pit_known_at, null);
  assert.ok(fs.existsSync(path.join(ROOT, row.wave_c_listing_source_meta_path)));
}

const scriptText = fs.readFileSync(SCRIPT, 'utf8');
for (const forbidden of ['fetch(', 'https.request', 'http.request', 'axios', 'node-fetch']) {
  assert.strictEqual(scriptText.includes(forbidden), false, `network primitive forbidden in reconstruction script: ${forbidden}`);
}

console.log('institutional accumulation catalyst artifact readiness regression: PASS');
