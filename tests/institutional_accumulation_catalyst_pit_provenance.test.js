'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const SCRIPT = path.join(ROOT, 'scripts/audit_institutional_accumulation_catalyst_pit_provenance.js');
const FROZEN = path.join(ROOT, 'data_research/institutional-flow/institutional-accumulation-official-disclosure-artifact-reconstruction-v1.json');
const READINESS = path.join(ROOT, 'data_research/institutional-flow/institutional-accumulation-catalyst-artifact-reconstruction-readiness-v1.json');
const OUTPUT = path.join(ROOT, 'data_research/institutional-flow/institutional-accumulation-catalyst-pit-provenance-resolution-v1.json');

const readJson = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));
assert.strictEqual(execFileSync('git', ['rev-parse', '--is-shallow-repository'], { cwd: ROOT, encoding: 'utf8' }).trim(), 'false');
execFileSync(process.execPath, [SCRIPT], { cwd: ROOT, stdio: 'pipe' });

const frozen = readJson(FROZEN).decisions.filter((row) => row.state === 'source_missing');
const readiness = readJson(READINESS);
const output = readJson(OUTPUT);

assert.strictEqual(frozen.length, 33);
assert.strictEqual(readiness.identity_count, 33);
assert.strictEqual(readiness.ready_identity_count, 0);
assert.strictEqual(readiness.not_ready_identity_count, 33);
assert.strictEqual(output.identity_count, 33);
assert.strictEqual(output.decisions.length, 33);
assert.strictEqual(output.pit_ready_identity_count, 0);
assert.strictEqual(output.not_pit_ready_identity_count, 33);
assert.strictEqual(output.manual_review_identity_count, 0);
assert.strictEqual(output.network_collection_used, false);
assert.strictEqual(output.source_network_requests, 0);
assert.strictEqual(output.outcome_blind, true);
assert.strictEqual(output.protected_2454_outcomes_read, false);
assert.strictEqual(output.development_outcome_values_read, false);
assert.strictEqual(output.holdout_outcomes_read, false);
assert.strictEqual(output.catalyst_outcome_association_opened, false);
assert.strictEqual(output.methodology.present_day_visibility_is_not_pit_proof, true);
assert.strictEqual(output.methodology.source_event_date_alone_is_not_pit_proof, true);
assert.strictEqual(output.shared_evidence.wave_a_declared_pit_known_at, '20260902');
assert.strictEqual(output.shared_evidence.wave_a_version_safety, 'historical_timing_safe_value_version_unproven');
assert.strictEqual(output.shared_evidence.wave_c_source_timestamp_precision, 'listing_only');
assert.strictEqual(output.shared_evidence.wave_c_version_safety, 'historical_timing_safe_value_version_unproven');
assert.strictEqual(output.shared_evidence.wave_c_declared_pit_known_at, null);
assert.deepStrictEqual(output.shared_evidence.decision_reason_codes, [
  'wave_a_declared_known_after_t0',
  'wave_a_no_durable_path_commit_at_or_before_t0',
  'wave_c_no_durable_path_commit_at_or_before_t0',
  'wave_a_immutable_value_version_unproven',
  'wave_c_immutable_value_version_unproven',
  'wave_c_pit_known_at_unproven',
]);
assert.strictEqual(output.protected_state.phase_2_semantic_sha256, '66ddb3bbf99e40bb1babb9e25a5257612a61206d827e273e6fb9b45b9c35e25b');
assert.strictEqual(output.protected_state.methodology_development_identity_count, 41);

const frozenKeys = frozen.map((row) => `${row.stock}|${row.t0}`).sort();
const outputKeys = output.decisions.map((row) => row.source_identity).sort();
assert.deepStrictEqual(outputKeys, frozenKeys);
assert.strictEqual(new Set(outputKeys).size, 33);

for (const row of output.decisions) {
  assert.strictEqual(row.decision, 'not_pit_ready');
  assert.strictEqual(row.positive_imputation, false);
  assert.deepStrictEqual(row.wave_a_commits_at_or_before_t0, []);
  assert.deepStrictEqual(row.wave_c_commits_at_or_before_t0, []);
  assert.ok(fs.existsSync(path.join(ROOT, output.shared_evidence.wave_a_source_meta_path)));
  assert.ok(fs.existsSync(path.join(ROOT, row.wave_c_source_meta_path)));
}

const scriptText = fs.readFileSync(SCRIPT, 'utf8');
for (const forbidden of ['fetch(', 'https.request', 'http.request', 'axios', 'node-fetch', 'curl ']) {
  assert.strictEqual(scriptText.includes(forbidden), false, `network primitive forbidden in PIT provenance audit: ${forbidden}`);
}

console.log('institutional accumulation catalyst PIT provenance regression: PASS');
