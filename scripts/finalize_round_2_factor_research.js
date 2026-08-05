#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const FACTOR_ID_ALIASES = Object.freeze({
  volume_breakout_confirmation_v1: 'technical_volume_breakout_confirmation_v1',
  strong_pullback_volume_contraction_v1: 'technical_strong_pullback_volume_contraction_v1',
});

const FACTOR_IDS = Object.freeze([
  'technical_volume_breakout_confirmation_v1',
  'technical_strong_pullback_volume_contraction_v1',
  'margin_exit_price_resilience_v1',
  'margin_crowding_risk_v1',
]);

function canonicalFactorId(value) {
  const id = String(value || '');
  return FACTOR_ID_ALIASES[id] || id;
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function writeJsonAtomic(file, payload) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const temporary = `${file}.tmp-${process.pid}`;
  fs.writeFileSync(temporary, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  fs.renameSync(temporary, file);
}

function remapFactorObject(source = {}) {
  const target = {};
  for (const [rawId, value] of Object.entries(source || {})) {
    const factorId = canonicalFactorId(rawId);
    if (Object.prototype.hasOwnProperty.call(target, factorId)) {
      throw new Error(`Duplicate factor after canonicalization: ${factorId}`);
    }
    target[factorId] = value;
  }
  return target;
}

function normalizeResearchFactorIds(payload) {
  if (!payload || typeof payload !== 'object') throw new Error('Research payload must be an object');
  const normalized = {
    ...payload,
    factor_id_schema: 'strategy_tag_registry_ids_v1',
    factor_id_aliases: { ...FACTOR_ID_ALIASES },
    availability_observation_count: remapFactorObject(payload.availability_observation_count),
    signal_count: remapFactorObject(payload.signal_count),
    summaries: remapFactorObject(payload.summaries),
    events: Array.isArray(payload.events)
      ? payload.events.map(event => ({ ...event, factor_id: canonicalFactorId(event.factor_id) }))
      : [],
  };

  normalized.summaries = Object.fromEntries(Object.entries(normalized.summaries).map(([factorId, summary]) => [
    factorId,
    {
      ...(summary || {}),
      factor_id: factorId,
    },
  ]));

  const unknownIds = new Set([
    ...Object.keys(normalized.availability_observation_count || {}),
    ...Object.keys(normalized.signal_count || {}),
    ...Object.keys(normalized.summaries || {}),
    ...normalized.events.map(event => event.factor_id),
  ].filter(id => !FACTOR_IDS.includes(id)));
  if (unknownIds.size) throw new Error(`Unknown round-two factor ids: ${[...unknownIds].join(', ')}`);

  for (const factorId of FACTOR_IDS) {
    if (!Object.prototype.hasOwnProperty.call(normalized.summaries, factorId)) {
      throw new Error(`Research summary missing after canonicalization: ${factorId}`);
    }
    if (!Object.prototype.hasOwnProperty.call(normalized.signal_count, factorId)) {
      normalized.signal_count[factorId] = 0;
    }
    if (!Object.prototype.hasOwnProperty.call(normalized.availability_observation_count, factorId)) {
      normalized.availability_observation_count[factorId] = 0;
    }
  }
  return normalized;
}

function buildResearchSummary(payload, sourceFile = '') {
  return {
    schema_version: 1,
    research_id: payload.research_id,
    factor_id_schema: payload.factor_id_schema,
    generated_at: payload.generated_at,
    cutoff_date: payload.cutoff_date,
    source_date_range: payload.source_date_range,
    eligible_signal_date_range: payload.eligible_signal_date_range,
    chronological_splits: payload.chronological_splits,
    leakage_guard: payload.leakage_guard,
    thresholds: payload.thresholds,
    source_file: sourceFile || null,
    source_file_count: {
      price: Array.isArray(payload.source_files?.price) ? payload.source_files.price.length : 0,
      margin: Array.isArray(payload.source_files?.margin) ? payload.source_files.margin.length : 0,
      margin_failures: Array.isArray(payload.source_files?.margin_failures)
        ? payload.source_files.margin_failures.length
        : 0,
    },
    event_count: Array.isArray(payload.events) ? payload.events.length : 0,
    availability_observation_count: payload.availability_observation_count,
    signal_count: payload.signal_count,
    summaries: payload.summaries,
  };
}

function defaultSummaryFile(inputFile) {
  if (/\.json$/i.test(inputFile)) return inputFile.replace(/\.json$/i, '.summary.json');
  return `${inputFile}.summary.json`;
}

function parseArgs(argv) {
  const options = { input: '', summaryOutput: '' };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--input') options.input = argv[++index] || '';
    else if (arg === '--summary-output') options.summaryOutput = argv[++index] || '';
    else throw new Error(`Unknown argument: ${arg}`);
  }
  if (!options.input) throw new Error('--input is required');
  return options;
}

function finalizeRound2FactorResearch(options = {}) {
  const inputFile = path.resolve(options.input || '');
  if (!fs.existsSync(inputFile)) throw new Error(`Research input missing: ${inputFile}`);
  const summaryFile = path.resolve(options.summaryOutput || defaultSummaryFile(inputFile));
  const normalized = normalizeResearchFactorIds(readJson(inputFile));
  const relativeSource = path.relative(process.cwd(), inputFile).replaceAll(path.sep, '/');
  const summary = buildResearchSummary(normalized, relativeSource);
  writeJsonAtomic(inputFile, normalized);
  writeJsonAtomic(summaryFile, summary);
  return {
    input_file: relativeSource,
    summary_file: path.relative(process.cwd(), summaryFile).replaceAll(path.sep, '/'),
    factor_ids: FACTOR_IDS,
    event_count: summary.event_count,
    signal_count: summary.signal_count,
  };
}

function main(argv = process.argv.slice(2)) {
  const result = finalizeRound2FactorResearch(parseArgs(argv));
  console.log(JSON.stringify(result, null, 2));
  return result;
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error(error?.stack || error);
    process.exitCode = 1;
  }
}

module.exports = {
  FACTOR_ID_ALIASES,
  FACTOR_IDS,
  canonicalFactorId,
  remapFactorObject,
  normalizeResearchFactorIds,
  buildResearchSummary,
  defaultSummaryFile,
  parseArgs,
  finalizeRound2FactorResearch,
  main,
};
