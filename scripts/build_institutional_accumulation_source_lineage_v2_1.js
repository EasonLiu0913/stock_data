#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { VERSIONS, SOURCE_PATH, gitBlobSha, resolveFreezeVersion, sha256 } = require('./lib/institutional_accumulation_freeze_versions');

const ROOT = path.resolve(__dirname, '..');
const OUTPUT = path.join(ROOT, 'data_research/institutional-flow/institutional-accumulation-source-lineage-v2.1.json');
const CUTOFF = '2026-08-27';
const OBSERVED_MAIN = '30e35fd5a1a90f07fe0038d8ff0b19953023760d';
const OBSERVED_LATEST_SOURCE_BLOB = 'e8991ea4a67d5cfe04095413dac2eaadaa974771';
const OBSERVED_LATEST_SOURCE_SHA256 = '8af39f77620932d41507171b2b2b5c533107fd2f152b28b7aabb5f30f7b799da';
const OBSERVATION_SOURCES = ['price', 'foreign', 'dealer', 'margin', 'investment_trust'];
const FORBIDDEN_KEYS = new Set(['forward_return', 'mfe', 'mae', 'breakout', 'repricing_success', 'failure_label', 'future_catalyst']);

function runGit(args) {
  return execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' }).trim();
}

function readSourceAt(commit, relativePath) {
  return execFileSync('git', ['show', `${commit}:${relativePath}`], { cwd: ROOT, encoding: 'buffer' });
}

function dateMap(sourceBytes) {
  return JSON.parse(sourceBytes.toString('utf8'));
}

function compareSourceRows(oldRows, newRows) {
  const oldDates = Object.keys(oldRows).sort();
  const newDates = Object.keys(newRows).sort();
  const addedDates = newDates.filter(date => !(date in oldRows));
  const removedDates = oldDates.filter(date => !(date in newRows));
  const changedRows = [];
  for (const date of oldDates.filter(date => date in newRows)) {
    if (JSON.stringify(oldRows[date]) !== JSON.stringify(newRows[date])) {
      const fields = [...new Set([...Object.keys(oldRows[date] || {}), ...Object.keys(newRows[date] || {})])].sort()
        .filter(field => JSON.stringify(oldRows[date]?.[field]) !== JSON.stringify(newRows[date]?.[field]))
        .map(field => ({ field, old: oldRows[date]?.[field] ?? null, new: newRows[date]?.[field] ?? null }));
      changedRows.push({ date, fields });
    }
  }
  return { oldRows: oldDates.length, newRows: newDates.length, addedDates, removedDates, changedRows };
}

function compactProvenance(provenance) {
  if (!provenance) return null;
  return {
    source: provenance.source ?? null,
    source_file: provenance.source_file ?? null,
    session_date: provenance.session_date ?? null,
    known_at: provenance.known_at ?? null,
  };
}

function compareDevelopmentObservations(v1, v2) {
  const byKey = new Map(v2.anchors
    .filter(anchor => anchor.partition === 'methodology_development' && anchor.stock !== '2454')
    .map(anchor => [`${anchor.stock}:${anchor.t0}`, anchor]));
  const comparisons = [];
  const totals = { anchors: 0, observationComparisons: 0, stateChanges: 0, valueChanges: 0, provenanceChanges: 0 };
  for (const oldAnchor of v1.anchors) {
    if (oldAnchor.partition !== 'methodology_development' || oldAnchor.stock === '2454') continue;
    const key = `${oldAnchor.stock}:${oldAnchor.t0}`;
    const newAnchor = byKey.get(key);
    if (!newAnchor) throw new Error(`Version v2 is missing development anchor ${key}`);
    totals.anchors += 1;
    for (const label of Object.keys(oldAnchor.observations).sort()) {
      for (const source of OBSERVATION_SOURCES) {
        const oldObservation = oldAnchor.observations[label]?.[source] || null;
        const newObservation = newAnchor.observations[label]?.[source] || null;
        const oldValue = oldObservation?.value ?? null;
        const newValue = newObservation?.value ?? null;
        const oldState = oldObservation?.state ?? null;
        const newState = newObservation?.state ?? null;
        const oldProvenance = compactProvenance(oldObservation?.provenance);
        const newProvenance = compactProvenance(newObservation?.provenance);
        totals.observationComparisons += 1;
        if (JSON.stringify(oldState) !== JSON.stringify(newState)) totals.stateChanges += 1;
        if (JSON.stringify(oldValue) !== JSON.stringify(newValue)) totals.valueChanges += 1;
        if (JSON.stringify(oldProvenance) !== JSON.stringify(newProvenance)) totals.provenanceChanges += 1;
        comparisons.push({ stock: oldAnchor.stock, t0: oldAnchor.t0, label, source, v1: { state: oldState, value: oldValue, provenance: oldProvenance }, v2: { state: newState, value: newValue, provenance: newProvenance } });
      }
    }
  }
  for (const anchor of v2.anchors) {
    if (anchor.partition === 'methodology_development' && anchor.stock !== '2454' && !v1.anchors.some(old => old.stock === anchor.stock && old.t0 === anchor.t0 && old.partition === 'methodology_development')) {
      throw new Error(`Version v2 has an unexpected development anchor ${anchor.stock}:${anchor.t0}`);
    }
  }
  return { scope: 'methodology_development anchors only; protected and holdout partitions are excluded', totals, comparisons };
}

function buildManifest() {
  const v1 = resolveFreezeVersion('v1', { root: ROOT });
  const v2 = resolveFreezeVersion('v2', { root: ROOT });
  const v1Source = v1.sourceBytes;
  const v2Source = v2.sourceBytes;
  const oldRows = dateMap(v1Source);
  const newRows = dateMap(v2Source);
  const latestSource = readSourceAt(OBSERVED_MAIN, SOURCE_PATH);
  const latestBlob = runGit(['rev-parse', `${OBSERVED_MAIN}:${SOURCE_PATH}`]);
  if (latestBlob !== OBSERVED_LATEST_SOURCE_BLOB || gitBlobSha(latestSource) !== OBSERVED_LATEST_SOURCE_BLOB || sha256(latestSource) !== OBSERVED_LATEST_SOURCE_SHA256) {
    throw new Error('Observed later main source identity changed; do not silently regenerate this preregistered manifest');
  }
  const rowDiff = compareSourceRows(oldRows, newRows);
  if (rowDiff.oldRows !== 161 || rowDiff.newRows !== 226 || rowDiff.addedDates.length !== 65 || rowDiff.removedDates.length !== 0 || rowDiff.changedRows.length !== 0) {
    throw new Error('Pinned v1-to-v2 source row diff differs from preregistered baseline');
  }
  const addedOnOrBeforeCutoff = rowDiff.addedDates.filter(date => date.replaceAll('/', '').replaceAll('-', '') <= CUTOFF.replaceAll('-', ''));
  if (addedOnOrBeforeCutoff.length !== 17) throw new Error('Pinned v1-to-v2 cutoff-date addition count differs from preregistered baseline');
  const comparison = compareDevelopmentObservations(v1.payload, v2.payload);
  const expectedComparison = { anchors: 96, observationComparisons: 3360, stateChanges: 0, valueChanges: 0, provenanceChanges: 3 };
  if (JSON.stringify(comparison.totals) !== JSON.stringify(expectedComparison)) {
    throw new Error(`Frozen development observation comparison differs from preregistered baseline: ${JSON.stringify(comparison.totals)}`);
  }
  const manifest = {
    schema_version: 1,
    phase: 'institutional-accumulation-source-lineage-repair-v2.1',
    goal_contract_version: 'goal-v3/institutional-accumulation-goal-v2',
    generated_from_observed_main: OBSERVED_MAIN,
    frozen_cutoff: CUTOFF,
    resolution_policy: 'Resolve this lineage repair only against the registered data_history_sma/1213.json bytes, after checking the freeze blob and semantic hash. Preserve the full source_file_sha256 inventory as provenance; never substitute latest main data into an existing freeze. v1 remains the historical frozen view; regenerated content is a separately pinned v2 view.',
    freeze_versions: {
      v1: { freeze_path: VERSIONS.v1.freezePath, freeze_blob: VERSIONS.v1.freezeBlob, freeze_file_sha256: sha256(fs.readFileSync(path.join(ROOT, VERSIONS.v1.freezePath))), semantic_sha256: VERSIONS.v1.semanticSha256, freeze_id: v1.payload.freeze_id, source_commit: VERSIONS.v1.sourceCommit, source_path: SOURCE_PATH, source_blob: VERSIONS.v1.sourceBlob, source_file_sha256: VERSIONS.v1.sourceSha256, source_date_range: { first: Object.keys(oldRows).sort()[0], last: Object.keys(oldRows).sort().at(-1), row_count: Object.keys(oldRows).length } },
      v2: { freeze_path: VERSIONS.v2.freezePath, freeze_blob: VERSIONS.v2.freezeBlob, freeze_file_sha256: sha256(fs.readFileSync(path.join(ROOT, VERSIONS.v2.freezePath))), semantic_sha256: VERSIONS.v2.semanticSha256, freeze_id: v2.payload.freeze_id, source_commit: VERSIONS.v2.sourceCommit, source_path: SOURCE_PATH, source_blob: VERSIONS.v2.sourceBlob, source_file_sha256: VERSIONS.v2.sourceSha256, source_date_range: { first: Object.keys(newRows).sort()[0], last: Object.keys(newRows).sort().at(-1), row_count: Object.keys(newRows).length } },
    },
    source_commit_context: {
      v1: { commit: VERSIONS.v1.sourceCommit, parent_commit: runGit(['rev-parse', `${VERSIONS.v1.sourceCommit}^`]), source_blob: VERSIONS.v1.sourceBlob },
      v2: { commit: VERSIONS.v2.sourceCommit, parent_commit: runGit(['rev-parse', `${VERSIONS.v2.sourceCommit}^`]), source_blob: VERSIONS.v2.sourceBlob, commit_message: runGit(['show', '-s', '--format=%s', VERSIONS.v2.sourceCommit]) },
      later_observation: { main: OBSERVED_MAIN, source_blob: OBSERVED_LATEST_SOURCE_BLOB, fetched_or_modified_by_this_phase: false },
      retrieval_context: 'No network retrieval was performed in this phase. Source identities are recovered from committed Git history; remote main file identity is recorded as a later observation.'
    },
    later_source_observation: { observed_at_main: OBSERVED_MAIN, source_path: SOURCE_PATH, source_blob: OBSERVED_LATEST_SOURCE_BLOB, source_file_sha256: OBSERVED_LATEST_SOURCE_SHA256, interpretation: 'later observed source version only; not an input to either frozen view and not substituted into v1 or v2' },
    source_row_diff_v1_to_v2: { ...rowDiff, added_on_or_before_cutoff: addedOnOrBeforeCutoff.length, added_on_or_before_cutoff_dates: addedOnOrBeforeCutoff },
    frozen_observation_comparison: comparison,
    source_file_sha256_inventory: { v1: v1.payload.source_file_sha256, v2: v2.payload.source_file_sha256 },
    forbidden_research_access: { outcomes_opened: false, return_labels_opened: false, association_outputs_opened: false, protected_or_holdout_partitions_compared: false, source_network_requests: 0, source_data_writes: 0 },
  };
  for (const forbidden of FORBIDDEN_KEYS) {
    if (JSON.stringify(manifest).includes(`"${forbidden}"`)) throw new Error(`Forbidden outcome key entered lineage manifest: ${forbidden}`);
  }
  return manifest;
}

function main() {
  const text = `${JSON.stringify(buildManifest(), null, 2)}\n`;
  fs.mkdirSync(path.dirname(OUTPUT), { recursive: true });
  fs.writeFileSync(OUTPUT, text, 'utf8');
  process.stdout.write(`${path.relative(ROOT, OUTPUT)}\n`);
}

if (require.main === module) main();
module.exports = { OBSERVED_MAIN, buildManifest, compareDevelopmentObservations, compareSourceRows };
