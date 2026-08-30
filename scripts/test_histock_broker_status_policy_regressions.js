#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const assert = require('assert');
const {
  POLICY_VERSION,
  classifyNoRecordResponse,
  assessPersistedStatus,
} = require('./lib/histock_broker_status_policy');

assert.strictEqual(POLICY_VERSION, 'histock-broker-source-status-policy-v2');

const incomplete = classifyNoRecordResponse({
  text: '<table>broker rows present</table>',
  diagnostics: {
    http_status: 200,
    response_bytes: 93719,
    date_visible: true,
    broker_keywords_visible: true,
    table_rows: 16,
    incomplete_records: 30,
  },
});
assert.strictEqual(incomplete.outcome, 'source_rows_incomplete');
assert.strictEqual(incomplete.terminal_for_date, true);
assert.strictEqual(incomplete.retryable, false);
assert.strictEqual(incomplete.negative_evidence, false);
assert.strictEqual(assessPersistedStatus(incomplete).classification, 'confirmed_source_rows_incomplete');

const explicitEmpty = classifyNoRecordResponse({
  text: '很抱歉，沒有符合條件的資料!',
  diagnostics: { http_status: 200, table_rows: 1 },
});
assert.strictEqual(explicitEmpty.outcome, 'source_empty');
assert.strictEqual(explicitEmpty.negative_evidence, true);

const legacyDegraded = assessPersistedStatus({
  outcome: 'source_empty',
  diagnostics: {
    http_status: 200,
    response_bytes: 69876,
    date_visible: true,
    broker_keywords_visible: true,
    table_rows: 1,
  },
}, { referenceResponseBytes: 90926 });
assert.strictEqual(legacyDegraded.classification, 'ambiguous_degraded_source_empty');
assert.strictEqual(legacyDegraded.retryable, true);
assert.strictEqual(legacyDegraded.negative_evidence, false);

const repo = path.resolve(__dirname, '..');
const positivePath = path.join(repo, 'data_research', 'institutional-flow', 'histock', '1598', 'daily', '20260507.json');
const positive = JSON.parse(fs.readFileSync(positivePath, 'utf8'));
assert.strictEqual(positive.stock, '1598');
assert.strictEqual(positive.date, '2026-05-07');
assert.ok(Number(positive.response_bytes) >= 90000);
assert.ok(Number(positive.record_count) > 0);
const kgi = positive.records.find((r) => r.broker === '凱基-汐止');
const mega = positive.records.find((r) => r.broker === '兆豐-大同');
assert.ok(kgi, '1598@2026-05-07 must retain 凱基-汐止');
assert.strictEqual(kgi.net, -74);
assert.strictEqual(Number(kgi.avg_price), 20.49);
assert.ok(mega, '1598@2026-05-07 must retain 兆豐-大同');
assert.strictEqual(mega.net, 206);
assert.strictEqual(Number(mega.avg_price), 20.76);

const investigationPath = path.join(repo, 'data_research', 'institutional-flow', 'validation', 'histock-legacy-incomplete-investigation-v1.json');
const investigation = JSON.parse(fs.readFileSync(investigationPath, 'utf8'));
assert.strictEqual(investigation.generated_without_outcomes, true);
assert.strictEqual(investigation.counts.dates, 5);
assert.strictEqual(investigation.counts.complete_records, 0);
assert.strictEqual(investigation.counts.incomplete_records, 150);
for (const row of investigation.rows) {
  assert.strictEqual(row.stock, '7791');
  assert.strictEqual(row.diagnostics.http_status, 200);
  assert.strictEqual(row.diagnostics.table_rows, 16);
  assert.strictEqual(row.diagnostics.broker_blocks, 30);
  assert.strictEqual(row.diagnostics.complete_records, 0);
  assert.strictEqual(row.diagnostics.incomplete_records, 30);
}

console.log('HiStock Broker status-policy regressions passed');
