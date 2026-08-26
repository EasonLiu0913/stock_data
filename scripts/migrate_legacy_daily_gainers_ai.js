#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { DAILY_GAINERS_AI_CONTRACT: CONTRACT } = require('./lib/daily_gainers_ai_contract');

function read(file) { return JSON.parse(fs.readFileSync(file, 'utf8')); }
function text(value) { return String(value || '').trim(); }
function allText(item) {
  return [item.reason_summary, ...(Array.isArray(item.evidence) ? item.evidence : []), ...(Array.isArray(item.sources) ? item.sources.map((s) => s?.title) : [])]
    .map(text).filter(Boolean).join(' ');
}
function tagsFor(item, fact) {
  const t = allText(item).toLowerCase();
  const tags = new Set(['legacy_research_migrated']);
  const rules = [
    [/cpo|矽光子|silicon photon/i, 'cpo'],
    [/pcb|印刷電路/i, 'pcb'],
    [/ccl|銅箔基板/i, 'ccl'],
    [/ptfe/i, 'ptfe'],
    [/ai伺服器|ai server/i, 'ai_server'],
    [/散熱|液冷|均熱/i, 'cooling'],
    [/光學|鏡頭/i, 'optics'],
    [/蘋果|iphone|apple/i, 'apple_supply_chain'],
    [/生技|新藥|臨床|再生醫療/i, 'biotech'],
    [/臨床/i, 'clinical_trial'],
    [/拆股|1拆|面額變更/i, 'stock_split'],
    [/半導體/i, 'semiconductor'],
    [/特殊氣體|特氣/i, 'specialty_gas'],
    [/投資|攜手|合作|併購/i, 'strategic_investment'],
    [/營收|獲利|毛利|訂單|出貨|報價|漲價|需求|產能|擴產/i, 'fundamental_improvement'],
    [/外資|投信|法人|買超/i, 'institutional_buying'],
    [/risk.?on|風險偏好|大盤.*上漲|台股.*上漲/i, 'market_risk_on'],
    [/低流動|成交量只有|成交量僅/i, 'low_liquidity'],
    [/漲停|動能|強勢|資金輪動/i, 'momentum'],
  ];
  for (const [re, tag] of rules) if (re.test(t)) tags.add(tag);
  if (fact?.technical?.low_liquidity === true) tags.add('low_liquidity');
  return [...tags];
}
function causeType(item, fact, tags) {
  const t = allText(item);
  const noCatalyst = /未找到明確|未找到公司級|未見單一公司事件|未找到單一公司|未找到.*催化/i.test(t);
  if (fact?.technical?.low_liquidity === true && (noCatalyst || !item.sources?.length)) return 'low_liquidity';
  if (/拆股|1拆|面額變更|臨床|公司宣布|宣布攜手|共同投資|併購|處分|取得訂單|重大訊息/i.test(t)) return 'company_event';
  if (/營收|獲利|毛利|報價|漲價|出貨|訂單|產能|擴產|需求改善/i.test(t) && !noCatalyst) return 'fundamental';
  if (/外資|投信|法人|買超/i.test(t) && !/族群|題材/i.test(t)) return 'institutional_flow';
  if (tags.includes('market_risk_on') && noCatalyst && tags.filter((x) => !['legacy_research_migrated','market_risk_on','momentum'].includes(x)).length === 0) return 'market_risk_on';
  if (/族群|題材|cpo|pcb|光學|散熱|ai伺服器|生技|光通訊|矽光子/i.test(t) && item.sources?.length) return 'industry_theme';
  if (noCatalyst && !item.sources?.length) return 'unknown';
  if (item.sources?.length && tags.length >= 3) return 'mixed';
  if (/技術|動能|突破|漲停|資金輪動/i.test(t)) return 'technical_momentum';
  return item.sources?.length ? 'mixed' : 'unknown';
}
function evidenceStrength(item, cause) {
  const sources = Array.isArray(item.sources) ? item.sources.filter((s) => s?.url) : [];
  if (!sources.length) return Array.isArray(item.evidence) && item.evidence.length ? 'circumstantial' : 'none';
  if (item.confidence === 'high' && ['company_event','fundamental'].includes(cause)) return 'direct';
  return 'corroborated';
}
function normalizeFollowUp(value) {
  if (Array.isArray(value)) return value.map(text).filter(Boolean);
  const v = text(value);
  return v ? [v] : ['持續追蹤後續公開資訊與價量/籌碼是否延續。'];
}
function main() {
  const [legacyFile, factsFile, outputFile] = process.argv.slice(2);
  if (!legacyFile || !factsFile || !outputFile) throw new Error('Usage: node scripts/migrate_legacy_daily_gainers_ai.js LEGACY_JSON FACTS_JSON OUTPUT_JSON');
  const legacy = read(legacyFile);
  const facts = read(factsFile);
  if (legacy.target_date !== facts.target_date) throw new Error('legacy/facts target_date mismatch');
  if (!Array.isArray(legacy.analyses) || !Array.isArray(facts.stocks)) throw new Error('invalid legacy or facts payload');
  const oldByCode = new Map(legacy.analyses.map((x) => [String(x.code), x]));
  const analyses = facts.stocks.map((fact) => {
    const old = oldByCode.get(String(fact.code));
    if (!old) throw new Error(`Legacy research missing stock ${fact.code}`);
    const tags = tagsFor(old, fact);
    let cause = causeType(old, fact, tags);
    let confidence = CONTRACT.confidence_values.includes(old.confidence) ? old.confidence : 'low';
    if (['unknown','low_liquidity'].includes(cause)) confidence = 'low';
    const evidence_strength = evidenceStrength(old, cause);
    return {
      code: String(fact.code),
      cause_type: cause,
      cause_tags: tags,
      evidence_strength,
      reason_summary: text(old.reason_summary) || '未找到明確公開催化劑',
      evidence: Array.isArray(old.evidence) ? old.evidence.map(text).filter(Boolean) : [],
      confidence,
      follow_up: normalizeFollowUp(old.follow_up),
      sources: Array.isArray(old.sources) ? old.sources.filter((s) => s && s.url).map((s) => ({
        title: text(s.title) || '公開來源',
        url: text(s.url),
        ...(s.published_at ? { published_at: s.published_at } : {}),
      })) : [],
    };
  });
  const payload = {
    schema_version: CONTRACT.ai.schema_version,
    methodology_version: CONTRACT.ai.methodology_version,
    model_role: CONTRACT.ai.model_role,
    contract_version: CONTRACT.contract_version,
    contract_policy: CONTRACT.policy,
    target_date: facts.target_date,
    generated_at: new Date().toISOString(),
    source_facts_file: `data_daily_gain_over_5/analysis-facts/${facts.target_date}.json`,
    migration_source: {
      kind: 'legacy_chatgpt_public_web_research',
      source_schema_version: legacy.schema_version ?? null,
      source_generated_at: legacy.generated_at ?? null,
    },
    stock_count: analyses.length,
    market_summary: {
      summary: legacy.methodology_note || `沿用 ${facts.target_date} 當日已完成的公開來源事後歸因研究，並依目前 cause taxonomy 重新結構化。`,
      common_flow_clues: [],
    },
    priority_watchlist: analyses.filter((x) => x.confidence === 'high').map((x) => x.code),
    analyses,
  };
  fs.mkdirSync(path.dirname(outputFile), { recursive: true });
  fs.writeFileSync(outputFile, JSON.stringify(payload, null, 2) + '\n');
  const counts = analyses.reduce((acc, x) => { acc[x.cause_type] = (acc[x.cause_type] || 0) + 1; return acc; }, {});
  console.log(JSON.stringify({ target_date: facts.target_date, stock_count: analyses.length, cause_counts: counts, output: outputFile }, null, 2));
}

try { main(); } catch (error) { console.error(error.stack || error.message); process.exit(1); }
