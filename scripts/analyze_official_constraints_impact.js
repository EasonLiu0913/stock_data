#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function parseFrontMonthTxFromExcerpt(excerpt) {
  const text = String(excerpt || '').replace(/\s+/g, ' ');
  const pattern = /\bTX\s+(20\d{4}(?:W\d+)?)\s+([\d.-]+)\s+([\d.-]+)\s+([\d.-]+)\s+([\d.-]+)\s+[▲▼]?([+-]?[\d.]+)\s+[▲▼]?([+-]?[\d.]+)%\s+([\d,.-]+)/;
  const match = text.match(pattern);
  if (!match) return null;
  const number = (value) => {
    const n = Number(String(value).replaceAll(',', ''));
    return Number.isFinite(n) ? n : null;
  };
  return {
    contract_month: match[1],
    open: number(match[2]),
    high: number(match[3]),
    low: number(match[4]),
    last: number(match[5]),
    change: number(match[6]),
    change_percent: number(match[7]),
    volume: number(match[8]),
  };
}

function nightPoints(changePercent) {
  if (!Number.isFinite(changePercent)) return 0;
  if (changePercent >= 2) return 15;
  if (changePercent >= 1) return 8;
  if (changePercent >= 0.5) return 4;
  return 0;
}

function analyze({ date, formalFile, dispositionFile, readinessFile, dateQueryFile }) {
  const formal = readJson(formalFile);
  const disposition = readJson(dispositionFile).disposition;
  const readiness = readJson(readinessFile);
  const dateQuery = readJson(dateQueryFile);
  const evaluation = formal?.formal_strategy_evaluations?.oversold_electronics_rebound_v1;
  if (!evaluation || !Array.isArray(evaluation.members)) {
    throw new Error('Missing oversold_electronics_rebound_v1 members');
  }
  if (!disposition?.complete_market_coverage) {
    throw new Error('Disposition source coverage is incomplete');
  }
  const activeCodes = new Set(disposition.active_stock_codes || []);
  const excluded = evaluation.members.filter((code) => activeCodes.has(String(code))).sort();
  const sourceCandidate = dateQuery.candidates.find((item) => item.name === 'excel_get_lower'
    && item.ok && item.contains_target_date && item.contains_tx && item.contains_after_hours);
  const night = parseFrontMonthTxFromExcerpt(sourceCandidate?.relevant_excerpt);
  if (!night || !Number.isFinite(night.change_percent)) {
    throw new Error('Unable to parse front-month TX night result');
  }
  const existingNightCondition = (readiness.conditions || []).find((item) => item.id === 'night_futures_open_signal');
  const existingNightPoints = Number(existingNightCondition?.points || 0);
  const newNightPoints = nightPoints(night.change_percent);
  const scoreAfterNight = Math.max(0, Math.min(100,
    Number(readiness.score || 0) - existingNightPoints + newNightPoints));
  const effectiveWeightAfterNight = Math.max(0, Math.min(100,
    Number(readiness.effective_data_weight || 0)
      + (existingNightCondition?.status === 'na' ? Number(existingNightCondition.weight || 15) : 0)));
  return {
    schema_version: 1,
    target_date: date,
    generated_at: new Date().toISOString(),
    disposition_impact: {
      source_complete: true,
      active_record_count: disposition.active_record_count,
      active_unique_stock_count: new Set(disposition.active_stock_codes || []).size,
      strategy_candidate_count_before: evaluation.members.length,
      excluded_candidate_count: excluded.length,
      excluded_candidate_codes: excluded,
      strategy_candidate_count_after: evaluation.members.length - excluded.length,
    },
    night_futures_impact: {
      source: 'TAIFEX futDailyMarketExcel date query',
      trading_session: '盤後',
      contract: 'TX',
      ...night,
      readiness_score_before: readiness.score,
      existing_night_status: existingNightCondition?.status || null,
      existing_night_points: existingNightPoints,
      new_night_points: newNightPoints,
      readiness_score_after: scoreAfterNight,
      effective_data_weight_before: readiness.effective_data_weight,
      effective_data_weight_after: effectiveWeightAfterNight,
    },
  };
}

function parseArgs(argv) {
  const result = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg.startsWith('--')) result[arg.slice(2)] = argv[++index];
  }
  return result;
}

function main(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  const date = args.date;
  if (!/^20\d{6}$/.test(date || '')) throw new Error('date must be YYYYMMDD');
  const result = analyze({
    date,
    formalFile: path.resolve(ROOT, args['formal-file'] || `data_prediction_analysis/formal-strategy/${date}.json`),
    dispositionFile: path.resolve(ROOT, args['disposition-file']),
    readinessFile: path.resolve(ROOT, args['readiness-file'] || `data_market_environment/${date}/oversold_beta_rebound.json`),
    dateQueryFile: path.resolve(ROOT, args['date-query-file']),
  });
  if (args.output) {
    const output = path.resolve(ROOT, args.output);
    fs.mkdirSync(path.dirname(output), { recursive: true });
    fs.writeFileSync(output, `${JSON.stringify(result, null, 2)}\n`, 'utf8');
  }
  console.log(JSON.stringify(result, null, 2));
  return result;
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error(error.stack || error.message);
    process.exitCode = 1;
  }
}

module.exports = { parseFrontMonthTxFromExcerpt, nightPoints, analyze, main };
