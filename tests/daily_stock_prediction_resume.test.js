'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const workflow = fs.readFileSync(
  path.join(__dirname, '..', '.github', 'workflows', 'daily-stock-prediction.yml'),
  'utf8'
);

test('V1 reuse never gates the V2 job or strategy publication', () => {
  assert.doesNotMatch(workflow, /generate_v2:[\s\S]*?if:\s*needs\.generate_v1\.outputs\.should_run\s*==\s*'true'/);
  assert.doesNotMatch(workflow, /apply_strategy_registry:[\s\S]*?if:\s*needs\.generate_v1\.outputs\.should_run\s*==\s*'true'/);
  assert.match(workflow, /generate_v2:[\s\S]*?needs:\s*generate_v1/);
  assert.match(workflow, /apply_strategy_registry:[\s\S]*?needs:\s*\[generate_v1, generate_v2\]/);
});

test('V1 is reusable only with an explicit successful generation status and a valid manifest', () => {
  assert.match(workflow, /\[ -s "\$status_file" \]/);
  assert.match(workflow, /tr -d '\\r\\n' < "\$status_file"\)" = "success"/);
  assert.match(workflow, /Number\(m\.generated_reports\)<1/);
  assert.match(workflow, /m\.market_environment\?\.snapshot_hash/);
});

test('V2 has an independent completion decision and final manifest verification', () => {
  assert.match(workflow, /v2_manifest="data_predictions_v2\/\$date\/manifest\.json"/);
  assert.match(workflow, /V2：缺少或不完整，繼續產生/);
  assert.match(workflow, /Verify final V2 completion state/);
  assert.match(workflow, /V2 environment hash mismatch/);
});
