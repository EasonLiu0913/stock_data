#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const ROOT = path.resolve(__dirname, '..');
const { DAILY_GAINERS_AI_CONTRACT: CONTRACT } = require(path.join(ROOT, 'scripts/lib/daily_gainers_ai_contract'));
const BASE = path.join(ROOT, 'data_daily_gain_over_5');

function readJson(file) { return JSON.parse(fs.readFileSync(file, 'utf8')); }
function rel(file) { return path.relative(ROOT, file).replaceAll('\\', '/'); }
function assert(ok, msg) { if (!ok) throw new Error(msg); }
function fallbackAnalysis(fact) {
  return {
    code: String(fact.code),
    cause_type: fact?.technical?.low_liquidity === true ? 'low_liquidity' : 'unknown',
    cause_tags: ['deterministic_fallback'],
    evidence_strength: 'none',
    reason_summary: '未找到明確公開催化劑；目前僅有 deterministic 價量與籌碼 facts，待 AI 與公開來源重新驗證。',
    evidence: ['本筆僅保留可重現的行情、技術面與籌碼事實，不以股價上漲倒果為因。'],
    confidence: 'low',
    follow_up: ['補做公司公告、重大新聞、法說與產業題材的公開來源交叉驗證。'],
    sources: [],
  };
}
function main() {
  const date = process.argv[2];
  const fallback = process.argv.includes('--fallback');
  assert(/^20\d{6}$/.test(String(date || '')), 'Usage: node scripts/publish_daily_gainers_unified_analysis.js YYYYMMDD [--fallback]');
  const factsFile = path.join(BASE, 'analysis-facts', `${date}.json`);
  const aiFile = path.join(ROOT, 'research_pending', 'daily-gainers-ai', `${date}.json`);
  assert(fs.existsSync(factsFile), `Missing facts: ${rel(factsFile)}`);
  const facts = readJson(factsFile);
  assert(facts.schema_version === CONTRACT.facts.schema_version && facts.methodology_version === CONTRACT.facts.methodology_version, 'facts are not current contract');
  let ai = null;
  if (fs.existsSync(aiFile)) ai = readJson(aiFile);
  if (!ai && !fallback) throw new Error(`Missing current AI synthesis: ${rel(aiFile)}`);
  if (ai) {
    assert(ai.schema_version === CONTRACT.ai.schema_version && ai.methodology_version === CONTRACT.ai.methodology_version && ai.model_role === CONTRACT.ai.model_role, 'AI synthesis is not current contract');
    assert(ai.target_date === date, 'AI target_date mismatch');
  }
  const aiByCode = new Map((ai?.analyses || []).map((item) => [String(item.code), item]));
  const analyses = facts.stocks.map((fact) => {
    const semantic = aiByCode.get(String(fact.code)) || fallbackAnalysis(fact);
    return {
      code: String(fact.code),
      name: fact.name,
      change_pct: fact?.price?.change_pct ?? null,
      cause_type: semantic.cause_type,
      cause_tags: semantic.cause_tags,
      evidence_strength: semantic.evidence_strength,
      reason_summary: semantic.reason_summary,
      evidence: semantic.evidence,
      confidence: semantic.confidence,
      flow: fact.flow,
      technical: fact.technical,
      follow_up: semantic.follow_up,
      sources: semantic.sources,
    };
  });
  const payload = {
    schema_version: CONTRACT.published.schema_version,
    methodology_version: CONTRACT.published.methodology_version,
    contract_version: CONTRACT.contract_version,
    contract_policy: CONTRACT.policy,
    target_date: date,
    previous_date: facts.previous_date,
    generated_at: new Date().toISOString(),
    source_list_file: facts.source_list_file,
    source_facts_file: rel(factsFile),
    source_ai_file: ai ? rel(aiFile) : null,
    generation_mode: ai ? 'ai_verified' : 'deterministic_fallback',
    stock_count: analyses.length,
    market_context: facts.market_context || null,
    market_summary: ai?.market_summary || null,
    priority_watchlist: ai?.priority_watchlist || [],
    analyses,
  };
  const out = path.join(BASE, 'analysis', `${date}.json`);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, `${JSON.stringify(payload, null, 2)}\n`);
  console.log(JSON.stringify({ output: rel(out), stock_count: analyses.length, generation_mode: payload.generation_mode, methodology_version: payload.methodology_version }, null, 2));
}
try { main(); } catch (error) { console.error(error.stack || error.message); process.exit(1); }
