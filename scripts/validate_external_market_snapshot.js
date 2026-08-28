#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const {
  ROOT,
  parseArgs,
  compactDate,
  readJson,
  primaryExternalValidation,
} = require('./market_environment_lib');
const { finalizeExternal } = require('./finalize_prediction_market_context');

function output(name, value) {
  if (process.env.GITHUB_OUTPUT) fs.appendFileSync(process.env.GITHUB_OUTPUT, `${name}=${String(value)}\n`, 'utf8');
}

function stageFinalContext() {
  if (process.env.GITHUB_ACTIONS !== 'true' || !fs.existsSync(path.join(ROOT, 'data_prediction_context'))) return;
  const staged = spawnSync('git', ['add', 'data_prediction_context'], { cwd: ROOT, encoding: 'utf8' });
  if (staged.status !== 0) {
    throw new Error(`Unable to stage final external market context: ${staged.stderr || staged.stdout}`);
  }
}

function main() {
  const args = parseArgs();
  const expectedDate = compactDate(args.get('expected-date'), 'expected date');
  const suppliedFile = args.get('file');
  const file = suppliedFile
    ? path.resolve(ROOT, suppliedFile)
    : path.join(ROOT, 'data_external_market', expectedDate, 'external_market_indicators.json');
  const payload = readJson(file, null);
  const validation = primaryExternalValidation(payload, expectedDate);

  // Legacy exact-date snapshots have no snapshot_status and remain valid for backward compatibility.
  // New schema v3 snapshots are ready only when the crawler explicitly marks them final.
  const hasSnapshotStatus = Boolean(payload?.snapshot_status);
  const isFinal = hasSnapshotStatus ? payload.snapshot_status?.is_final === true : true;
  const needsRefresh = hasSnapshotStatus ? payload.snapshot_status?.needs_refresh !== false : false;
  const dataStatus = payload?.snapshot_status?.data_status || (validation.exact ? 'legacy_final' : 'legacy_provisional');
  const ready = Boolean(payload && validation.exact && isFinal && !needsRefresh);

  output('ready', ready ? 'true' : 'false');
  output('actual_date', validation.actual_date || '');
  output('agreement', validation.primary_indicator_agreement);
  output('file', path.relative(ROOT, file).replaceAll(path.sep, '/'));
  output('data_status', dataStatus);
  output('is_final', isFinal ? 'true' : 'false');
  output('needs_refresh', needsRefresh ? 'true' : 'false');
  output('captured_at', payload?.snapshot_status?.captured_at || payload?.generated_at || '');

  let finalization = null;
  if (ready) {
    finalization = finalizeExternal({
      externalMarketDate: validation.actual_date,
      externalFile: path.relative(ROOT, file).replaceAll(path.sep, '/'),
    });
    stageFinalContext();
  }

  const result = {
    ready,
    expected_date: expectedDate,
    file: path.relative(ROOT, file),
    data_status: dataStatus,
    is_final: isFinal,
    needs_refresh: needsRefresh,
    captured_at: payload?.snapshot_status?.captured_at || payload?.generated_at || null,
    ...validation,
    prediction_context_finalization: finalization,
  };
  console.log(JSON.stringify(result));
  if (args.has('strict') && !ready) process.exitCode = 1;
}

main();
