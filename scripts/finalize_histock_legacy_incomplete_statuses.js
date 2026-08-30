#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { POLICY_VERSION, assessPersistedStatus } = require('./lib/histock_broker_status_policy');

const repo = path.resolve(__dirname, '..');
const investigationFile = path.join(repo, 'data_research', 'institutional-flow', 'validation', 'histock-legacy-incomplete-investigation-v1.json');
const investigation = JSON.parse(fs.readFileSync(investigationFile, 'utf8'));
if (investigation.generated_without_outcomes !== true || investigation.counts?.dates !== 5) throw new Error('Unexpected legacy investigation contract');

const changed = [];
for (const row of investigation.rows || []) {
  const compact = row.date.replaceAll('-', '');
  const statusDir = path.join(repo, 'data_research', 'institutional-flow', 'histock', row.stock, 'batch-status');
  const statusFile = path.join(statusDir, `exact-source-date-${compact}.json`);
  const archiveDir = path.join(statusDir, 'archive');
  const archiveFile = path.join(archiveDir, `exact-source-date-${compact}-legacy-source-empty-before-incomplete-evidence-v1.json`);
  if (!fs.existsSync(statusFile)) throw new Error(`Missing legacy status ${statusFile}`);
  const previous = JSON.parse(fs.readFileSync(statusFile, 'utf8'));

  if (previous.outcome === 'source_rows_incomplete') {
    const assessed = assessPersistedStatus(previous);
    if (assessed.classification !== 'confirmed_source_rows_incomplete') throw new Error(`Invalid existing finalized status ${statusFile}`);
    continue;
  }
  if (previous.outcome !== 'source_empty') throw new Error(`Expected source_empty before finalization: ${statusFile}`);
  if (Number(previous.diagnostics?.table_rows) !== 16 || Number(previous.diagnostics?.incomplete_records) !== 30) {
    throw new Error(`Legacy status diagnostics do not match investigated incomplete-row signature: ${statusFile}`);
  }
  if (Number(row.diagnostics?.http_status) !== 200 || Number(row.diagnostics?.table_rows) !== 16 || Number(row.diagnostics?.broker_blocks) !== 30 || Number(row.diagnostics?.complete_records) !== 0 || Number(row.diagnostics?.incomplete_records) !== 30) {
    throw new Error(`Fresh probe does not confirm incomplete-row state: ${row.stock}@${row.date}`);
  }

  fs.mkdirSync(archiveDir, { recursive: true });
  if (!fs.existsSync(archiveFile)) {
    fs.writeFileSync(archiveFile, `${JSON.stringify({
      ...previous,
      archive_metadata: {
        archived_at: new Date().toISOString(),
        reason: 'superseded_by_outcome_blind_fresh_runner_evidence_of_source_rows_present_but_zero_complete_records',
        investigation_file: path.relative(repo, investigationFile),
      },
    }, null, 2)}\n`);
  }

  const payload = {
    schema_version: 2,
    research: 'institutional-withdrawal-validation-coverage-v1',
    stock: row.stock,
    date: row.date,
    outcome: 'source_rows_incomplete',
    terminal_for_date: true,
    retryable: false,
    negative_evidence: false,
    coverage_usable: false,
    planner_action: 'skip_exact_date_and_continue_alternate_dates',
    status_policy_version: POLICY_VERSION,
    updated_at: new Date().toISOString(),
    provenance: {
      legacy_status_archived_to: path.relative(repo, archiveFile),
      investigation_file: path.relative(repo, investigationFile),
      investigation_methodology: investigation.methodology,
      investigation_generated_without_outcomes: true,
    },
    source_rows_incomplete_evidence: {
      confirmed: true,
      rule: 'fresh_runner_http_200_context_visible_16_rows_30_blocks_zero_complete_records_v1',
      interpretation: 'source Broker rows exist, but every row has one or more blank source-side fields under frozen strict completeness semantics; this is unusable coverage, not evidence of no Broker data',
    },
    diagnostics: row.diagnostics,
  };
  const assessed = assessPersistedStatus(payload);
  if (assessed.classification !== 'confirmed_source_rows_incomplete' || assessed.negative_evidence !== false) {
    throw new Error(`Finalized status policy assessment failed: ${row.stock}@${row.date}`);
  }
  fs.writeFileSync(statusFile, `${JSON.stringify(payload, null, 2)}\n`);
  changed.push(path.relative(repo, statusFile), path.relative(repo, archiveFile));
}

console.log(JSON.stringify({ finalized: changed.length / 2, changed_paths: changed }, null, 2));
