#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');

function assert(ok, message) {
  if (!ok) throw new Error(message);
}

function readJsonText(text, label) {
  try {
    return JSON.parse(text);
  } catch (error) {
    throw new Error(`Invalid JSON in ${label}: ${error.message}`);
  }
}

function canonicalizeAnalysis(value) {
  const copy = JSON.parse(JSON.stringify(value));
  delete copy.generated_at;
  return copy;
}

function canonicalizeSummary(value) {
  const copy = JSON.parse(JSON.stringify(value));
  delete copy.generated_at;
  if (copy.source_lineage?.analysis) {
    delete copy.source_lineage.analysis.sha256;
  }
  return copy;
}

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.keys(value).sort().map((key) => [key, stable(value[key])]),
    );
  }
  return value;
}

function equivalent(a, b) {
  return JSON.stringify(stable(a)) === JSON.stringify(stable(b));
}

function headText(relPath) {
  const result = spawnSync('git', ['show', `HEAD:${relPath}`], {
    cwd: ROOT,
    encoding: 'utf8',
  });
  if (result.status !== 0) return null;
  return result.stdout;
}

function restore(relPath, text) {
  fs.writeFileSync(path.join(ROOT, relPath), text);
}

function main() {
  const date = process.argv[2];
  assert(/^20\d{6}$/.test(String(date || '')),
    'Usage: node scripts/daily_gainers_semantic_equality_gate.js YYYYMMDD');

  const analysisPath = `data_daily_gain_over_5/analysis/${date}.json`;
  const summaryPath = `data_daily_gain_over_5/market-summary/${date}.json`;
  const currentAnalysisText = fs.readFileSync(path.join(ROOT, analysisPath), 'utf8');
  const currentSummaryText = fs.readFileSync(path.join(ROOT, summaryPath), 'utf8');
  const previousAnalysisText = headText(analysisPath);
  const previousSummaryText = headText(summaryPath);

  if (previousAnalysisText === null || previousSummaryText === null) {
    console.log(JSON.stringify({
      date,
      semantic_equal: false,
      reason: 'previous_published_output_missing',
    }, null, 2));
    return;
  }

  const analysisEqual = equivalent(
    canonicalizeAnalysis(readJsonText(currentAnalysisText, analysisPath)),
    canonicalizeAnalysis(readJsonText(previousAnalysisText, `HEAD:${analysisPath}`)),
  );
  const summaryEqual = equivalent(
    canonicalizeSummary(readJsonText(currentSummaryText, summaryPath)),
    canonicalizeSummary(readJsonText(previousSummaryText, `HEAD:${summaryPath}`)),
  );
  const semanticEqual = analysisEqual && summaryEqual;

  if (semanticEqual) {
    restore(analysisPath, previousAnalysisText);
    restore(summaryPath, previousSummaryText);
  }

  console.log(JSON.stringify({
    date,
    semantic_equal: semanticEqual,
    analysis_equal: analysisEqual,
    summary_equal: summaryEqual,
    ignored_volatile_fields: [
      'analysis.generated_at',
      'market-summary.generated_at',
      'market-summary.source_lineage.analysis.sha256',
    ],
    action: semanticEqual ? 'restored_head_outputs_no_promotion' : 'keep_generated_outputs_for_promotion',
  }, null, 2));
}

try {
  main();
} catch (error) {
  console.error(error.stack || error.message);
  process.exit(1);
}
