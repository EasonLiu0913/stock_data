#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { ROOT, readJson } = require('./market_environment_lib');
const {
  OVERSOLD_ELECTRONICS_STRATEGY_ID,
} = require('./apply_formal_market_strategy_tags');

function compactDate(value) {
  const compact = String(value || '').replaceAll('-', '').replaceAll('/', '');
  return /^20\d{6}$/.test(compact) ? compact : '';
}

function finiteNumber(value) {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function sameMembers(left, right) {
  return JSON.stringify([...(left || [])].map(String).sort()) === JSON.stringify([...(right || [])].map(String).sort());
}

function verifyOfficialConstraintsIntegration(date) {
  const target = compactDate(date);
  if (!target) throw new Error('date must be YYYYMMDD');
  const constraintDir = path.join(ROOT, 'data_market_constraints', target);
  const disposition = readJson(path.join(constraintDir, 'disposition.json'), null);
  const night = readJson(path.join(constraintDir, 'night-futures.json'), null);
  const summary = readJson(path.join(ROOT, 'data_predictions', target, 'summary.json'), null);
  const groupSummary = readJson(path.join(ROOT, 'data_predictions', target, 'group-summary.json'), null);
  const readiness = readJson(path.join(ROOT, 'data_market_environment', target, 'oversold_beta_rebound.json'), null);
  if (!Array.isArray(summary?.stocks)) throw new Error('Missing prediction summary');
  const classification = summary?.formal_strategy_classifications?.[OVERSOLD_ELECTRONICS_STRATEGY_ID];
  if (!classification) throw new Error('Missing oversold electronics classification');
  const group = (groupSummary?.groups || []).find((item) => item?.strategy_id === OVERSOLD_ELECTRONICS_STRATEGY_ID);
  if (!group) throw new Error('Missing oversold electronics group');
  if (!sameMembers(classification.members, group.members)) throw new Error('Classification and group members differ');
  if (classification.calculation_status === 'completed' && classification.count !== classification.members.length) {
    throw new Error('Classification count does not match members');
  }

  let excludedCount = 0;
  if (disposition?.complete_market_coverage === true) {
    const active = new Set((disposition.active_stock_codes || []).map(String));
    const leaked = (classification.members || []).map(String).filter((code) => active.has(code));
    if (leaked.length) throw new Error(`Disposition candidates leaked: ${leaked.join(',')}`);
    excludedCount = classification?.disposition_filter?.excluded_count || 0;
    if (classification?.disposition_filter?.status !== 'completed') {
      throw new Error('Disposition filter metadata is not completed');
    }
  }

  if (night?.available === true && night?.target_date === target) {
    const expected = finiteNumber(night.change_percent);
    const actual = finiteNumber(readiness?.inputs?.night_futures_change_pct);
    if (expected === null || actual === null || Math.abs(expected - actual) > 1e-9) {
      throw new Error(`Night futures mismatch: expected ${expected}, actual ${actual}`);
    }
    const condition = (readiness?.conditions || []).find((item) => item.id === 'night_futures_open_signal');
    if (!condition || condition.status === 'na') throw new Error('Night futures readiness condition is still N/A');
  }

  const formalReplayFile = path.join(ROOT, 'data_prediction_analysis', 'formal-strategy', `${target}.json`);
  const formalReplay = fs.existsSync(formalReplayFile) ? readJson(formalReplayFile, null) : null;
  const evaluation = formalReplay?.formal_strategy_evaluations?.[OVERSOLD_ELECTRONICS_STRATEGY_ID];
  if (evaluation && !sameMembers(evaluation.members, classification.members)) {
    throw new Error('Replay evaluation members do not match prediction classification');
  }

  return {
    date: target,
    disposition_complete: disposition?.complete_market_coverage === true,
    disposition_active_stock_count: disposition?.active_stock_count ?? null,
    excluded_count: excludedCount,
    strategy_candidate_count: classification.members.length,
    night_futures_available: night?.available === true,
    night_futures_change_percent: finiteNumber(night?.change_percent),
    readiness_score: finiteNumber(readiness?.score),
    effective_data_weight: finiteNumber(readiness?.effective_data_weight),
    replay_verified: Boolean(evaluation),
  };
}

function main(argv = process.argv.slice(2)) {
  const index = argv.indexOf('--date');
  const result = verifyOfficialConstraintsIntegration(index >= 0 ? argv[index + 1] : '');
  console.log(JSON.stringify(result));
  return result;
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error(`Error: ${error.stack || error.message}`);
    process.exitCode = 1;
  }
}

module.exports = { verifyOfficialConstraintsIntegration, main };
