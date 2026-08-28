#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { DAILY_GAINERS_AI_CONTRACT, isLatestPublished } = require('./lib/daily_gainers_ai_contract');

const ROOT = path.resolve(__dirname, '..');
const BASE = path.join(ROOT, 'data_daily_gain_over_5');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function main() {
  const date = String(process.argv[2] || '');
  assert(/^20\d{6}$/.test(date), 'Usage: node scripts/migrate_daily_gainers_unified_to_news.js YYYYMMDD');

  const rawPath = path.join(BASE, `${date}.json`);
  const unifiedPath = path.join(BASE, 'analysis', `${date}.json`);
  const newsPath = path.join(BASE, 'analysis-news', `${date}.json`);
  assert(fs.existsSync(rawPath), `Missing raw file: ${rawPath}`);
  assert(fs.existsSync(unifiedPath), `Missing unified analysis: ${unifiedPath}`);

  const raw = JSON.parse(fs.readFileSync(rawPath, 'utf8'));
  const unified = JSON.parse(fs.readFileSync(unifiedPath, 'utf8'));
  assert(String(raw.target_date) === date, 'raw target_date mismatch');
  assert(isLatestPublished(unified), 'Unified analysis is not on latest published contract');
  assert(String(unified.target_date) === date, 'unified target_date mismatch');

  const rawRows = Array.isArray(raw.stocks) ? raw.stocks : [];
  const analyses = Array.isArray(unified.analyses) ? unified.analyses : [];
  assert(rawRows.length === analyses.length, 'Unified analysis count does not match raw list');
  for (let i = 0; i < rawRows.length; i += 1) {
    assert(String(rawRows[i].code) === String(analyses[i].code), `stock order mismatch at index ${i}`);
  }

  const news = {
    schema_version: DAILY_GAINERS_AI_CONTRACT.news.schema_version,
    methodology_version: DAILY_GAINERS_AI_CONTRACT.news.methodology_version,
    model_role: DAILY_GAINERS_AI_CONTRACT.news.model_role,
    contract_version: DAILY_GAINERS_AI_CONTRACT.contract_version,
    contract_policy: DAILY_GAINERS_AI_CONTRACT.policy,
    target_date: date,
    generated_at: new Date().toISOString(),
    source_list_file: `data_daily_gain_over_5/${date}.json`,
    source_migration_file: `data_daily_gain_over_5/analysis/${date}.json`,
    migration_note: 'Recovered the news/theme semantic layer from an already verified Unified Analysis created before analysis-news became a separate first-stage artifact. Flow/technical fields are intentionally excluded.',
    stock_count: rawRows.length,
    analyses: analyses.map((item, index) => ({
      code: String(item.code),
      name: item.name || rawRows[index].name || '',
      change_pct: Number(item.change_pct ?? rawRows[index].change_pct),
      cause_type: item.cause_type,
      cause_tags: Array.isArray(item.cause_tags) ? item.cause_tags : [],
      evidence_strength: item.evidence_strength,
      reason_summary: item.reason_summary,
      evidence: Array.isArray(item.evidence) ? item.evidence : [],
      confidence: item.confidence,
      follow_up: Array.isArray(item.follow_up) ? item.follow_up : [],
      sources: Array.isArray(item.sources) ? item.sources : [],
    })),
  };

  fs.mkdirSync(path.dirname(newsPath), { recursive: true });
  fs.writeFileSync(newsPath, `${JSON.stringify(news, null, 2)}\n`);
  console.log(JSON.stringify({ output: path.relative(ROOT, newsPath), date, stock_count: news.stock_count }, null, 2));
}

main();
