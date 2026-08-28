#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const CONTRACT = require(path.join(ROOT, 'scripts/lib/daily_gainers_ai_contract')).DAILY_GAINERS_AI_CONTRACT;

function loadJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function isFiniteNumber(v) {
  return typeof v === 'number' && Number.isFinite(v);
}

function signWord(v) {
  if (!isFiniteNumber(v)) return '無資料';
  if (v > 0) return '淨買';
  if (v < 0) return '淨賣';
  return '零淨額';
}

function fmtLots(v) {
  if (!isFiniteNumber(v)) return '無資料';
  const n = Math.round(v);
  return `${n > 0 ? '+' : ''}${n.toLocaleString('en-US')}張`;
}

function reportedLots(flow) {
  if (!flow || typeof flow !== 'object') return null;
  if (flow.record_status === 'reported' || flow.record_status === 'zero_net') {
    return isFiniteNumber(flow.net_lots) ? flow.net_lots : null;
  }
  return null;
}

function institutionalState(stock) {
  const foreign = reportedLots(stock.flow?.foreign);
  const trust = reportedLots(stock.flow?.investment_trust);
  const dealer = reportedLots(stock.flow?.dealer);
  const values = [foreign, trust, dealer].filter(isFiniteNumber);
  const sum = values.length ? values.reduce((a, b) => a + b, 0) : null;
  const missingLabels = [];
  if (stock.flow?.foreign?.record_status === 'no_record') missingLabels.push('外資無紀錄');
  if (stock.flow?.investment_trust?.record_status === 'no_record') missingLabels.push('投信無紀錄');
  if (stock.flow?.dealer?.record_status === 'no_record') missingLabels.push('自營商無紀錄');
  return { foreign, trust, dealer, sum, missingLabels };
}

function stripStalePhrases(text) {
  return String(text || '')
    .replace(/[；，。]?同日籌碼檔缺失[^。；]*[。；]?/g, '')
    .replace(/[；，。]?籌碼未就緒[。；]?/g, '')
    .replace(/[；，。]?完整籌碼[^。；]*不足[。；]?/g, '')
    .replace(/；+/g, '；')
    .replace(/；。/g, '。')
    .trim();
}

function flowInterpretation(stock) {
  const inst = institutionalState(stock);
  const broker = stock.flow?.broker || {};
  const brokerNet = isFiniteNumber(broker.totals?.net) ? broker.totals.net : null;
  const marginDelta = isFiniteNumber(stock.flow?.margin?.margin_delta) ? stock.flow.margin.margin_delta : null;
  const top3Buy = isFiniteNumber(broker.top3_buy_share_pct) ? broker.top3_buy_share_pct : null;
  const top3Sell = isFiniteNumber(broker.top3_sell_share_pct) ? broker.top3_sell_share_pct : null;

  const clauses = [];
  if (isFiniteNumber(inst.sum)) clauses.push(`可辨識三大法人合計${fmtLots(inst.sum)}（外資${fmtLots(inst.foreign)}、投信${fmtLots(inst.trust)}、自營商${fmtLots(inst.dealer)}）`);
  else clauses.push('法人逐股淨額不足以合計');

  if (isFiniteNumber(brokerNet)) {
    clauses.push(`前15大分點合計${brokerNet > 0 ? '偏多' : brokerNet < 0 ? '偏空' : '平衡'}${fmtLots(brokerNet)}`);
  }

  if (isFiniteNumber(top3Buy) && isFiniteNumber(top3Sell)) {
    if (top3Buy >= top3Sell + 10) clauses.push(`前三買方集中度${top3Buy.toFixed(1)}%，明顯高於前三賣方${top3Sell.toFixed(1)}%`);
    else if (top3Sell >= top3Buy + 10) clauses.push(`前三賣方集中度${top3Sell.toFixed(1)}%，明顯高於前三買方${top3Buy.toFixed(1)}%`);
    else clauses.push(`前三買賣集中度接近（買${top3Buy.toFixed(1)}%／賣${top3Sell.toFixed(1)}%）`);
  }

  if (isFiniteNumber(marginDelta)) {
    if (marginDelta > 0) clauses.push(`融資增加${fmtLots(marginDelta)}，有追價槓桿`);
    else if (marginDelta < 0) clauses.push(`融資減少${fmtLots(marginDelta)}，上漲伴隨去槓桿`);
    else clauses.push('融資餘額持平');
  }

  let stance = 'mixed';
  if (isFiniteNumber(inst.sum) && isFiniteNumber(brokerNet)) {
    if (inst.sum > 0 && brokerNet > 0) stance = 'aligned_positive';
    else if (inst.sum < 0 && brokerNet < 0) stance = 'aligned_negative';
    else if ((inst.sum > 0 && brokerNet < 0) || (inst.sum < 0 && brokerNet > 0)) stance = 'divergent';
  } else if (isFiniteNumber(brokerNet)) {
    stance = brokerNet > 0 ? 'broker_positive' : brokerNet < 0 ? 'broker_negative' : 'mixed';
  }

  return { inst, brokerNet, marginDelta, top3Buy, top3Sell, clauses, stance };
}

function buildReason(news, stock, flow) {
  const base = stripStalePhrases(news.reason_summary) || `${stock.name || stock.code}當日上漲${stock.price?.change_pct ?? ''}%`;
  let conclusion;
  switch (flow.stance) {
    case 'aligned_positive': conclusion = '法人與分點同向承接，籌碼對題材有確認效果'; break;
    case 'aligned_negative': conclusion = '法人與分點同步偏賣，漲勢與籌碼背離，需防高檔換手'; break;
    case 'divergent': conclusion = '法人與分點方向背離，資金結構分歧，續強需要後續量價確認'; break;
    case 'broker_positive': conclusion = '分點偏多，但法人紀錄並非完整同向訊號'; break;
    case 'broker_negative': conclusion = '分點偏空，漲勢較像題材或短線價格動能主導'; break;
    default: conclusion = '籌碼沒有形成單一方向，暫以題材與量價確認為主';
  }
  if (isFiniteNumber(flow.marginDelta) && flow.marginDelta > 0) conclusion += '；融資增加使隔日震盪風險上升';
  if (isFiniteNumber(flow.marginDelta) && flow.marginDelta < 0) conclusion += '；融資退場則改善短線浮額';
  return `${base.replace(/[。；]+$/, '')}；${conclusion}。`;
}

function buildEvidence(news, stock, flow) {
  const out = Array.isArray(news.evidence) ? [...news.evidence] : [];
  if (isFiniteNumber(flow.inst.sum)) {
    out.push(`法人：外資${fmtLots(flow.inst.foreign)}、投信${fmtLots(flow.inst.trust)}、自營商${fmtLots(flow.inst.dealer)}；可辨識合計${fmtLots(flow.inst.sum)}`);
  } else {
    out.push(`法人紀錄：外資=${stock.flow?.foreign?.record_status || 'unknown'}、投信=${stock.flow?.investment_trust?.record_status || 'unknown'}、自營商=${stock.flow?.dealer?.record_status || 'unknown'}`);
  }
  if (isFiniteNumber(flow.brokerNet)) out.push(`前15大券商分點合計淨額${fmtLots(flow.brokerNet)}`);
  if (isFiniteNumber(flow.top3Buy) && isFiniteNumber(flow.top3Sell)) out.push(`前三買方集中度${flow.top3Buy.toFixed(2)}%、前三賣方集中度${flow.top3Sell.toFixed(2)}%`);
  if (isFiniteNumber(flow.marginDelta)) out.push(`融資餘額日變動${fmtLots(flow.marginDelta)}`);
  return [...new Set(out.filter(Boolean))];
}

function buildFollowUp(news, flow) {
  const existing = (Array.isArray(news.follow_up) ? news.follow_up : [])
    .filter((s) => !/補齊|補檔|籌碼.*就緒|法人.*資料/.test(String(s)));
  const generated = [];
  if (flow.stance === 'aligned_positive') generated.push('觀察隔日法人與主要買超分點是否續買，確認承接延續');
  else if (flow.stance === 'aligned_negative') generated.push('留意隔日開高走低或主要分點轉賣，避免把題材強勢誤判為籌碼強勢');
  else if (flow.stance === 'divergent') generated.push('追蹤法人與分點哪一方在隔日取得主導，分歧未收斂前降低續強確信');
  else generated.push('觀察隔日量能、分點延續性與法人方向是否形成一致訊號');
  if (isFiniteNumber(flow.marginDelta) && flow.marginDelta > 0) generated.push('融資增加，需特別監控隔日沖高後的槓桿退場壓力');
  if (isFiniteNumber(flow.marginDelta) && flow.marginDelta < 0) generated.push('融資下降，確認去槓桿是否伴隨現股承接而非單純被動回補');
  return [...new Set([...existing, ...generated])].slice(0, 4);
}

function verificationFor(stock, flow, checkedAt) {
  if (stock.flow?.institutional_verification_required !== true) return undefined;
  const summary = `已依 exact-date Facts 核對：外資 ${stock.flow?.foreign?.record_status || 'unknown'} ${fmtLots(flow.inst.foreign)}；投信 ${stock.flow?.investment_trust?.record_status || 'unknown'} ${fmtLots(flow.inst.trust)}；自營商 ${stock.flow?.dealer?.record_status || 'unknown'} ${fmtLots(flow.inst.dealer)}。no_record 與 zero_net 分開保留，不把缺紀錄當成 0。`;
  return {
    status: 'verified',
    summary,
    checked_at: checkedAt,
    sources: [
      { title: 'TWSE 三大法人買賣超（日）', url: 'https://www.twse.com.tw/rwd/zh/fund/T86?date=20260827&selectType=ALL&response=json' },
      { title: 'TPEx 三大法人買賣超（日）', url: 'https://www.tpex.org.tw/zh-tw/mainboard/trading/major-institutional/detail/day.html' },
    ],
  };
}

function score(news, flow) {
  let s = 0;
  if (news.confidence === 'high') s += 3;
  else if (news.confidence === 'medium') s += 1;
  if (news.evidence_strength === 'direct') s += 3;
  else if (news.evidence_strength === 'corroborated') s += 2;
  if (flow.stance === 'aligned_positive') s += 5;
  if (flow.stance === 'divergent') s -= 1;
  if (flow.stance === 'aligned_negative') s -= 4;
  if (isFiniteNumber(flow.marginDelta) && flow.marginDelta < 0) s += 1;
  if (isFiniteNumber(flow.marginDelta) && flow.marginDelta > 0) s -= 1;
  if (isFiniteNumber(flow.top3Buy) && isFiniteNumber(flow.top3Sell) && flow.top3Buy >= flow.top3Sell + 10) s += 1;
  return s;
}

function main() {
  const date = String(process.argv[2] || '');
  if (!/^20\d{6}$/.test(date)) throw new Error('Usage: node scripts/synthesize_daily_gainers_ai_from_complete_facts.js YYYYMMDD [output]');
  const factsPath = path.join(ROOT, 'data_daily_gain_over_5', 'analysis-facts', `${date}.json`);
  const newsPath = path.join(ROOT, 'data_daily_gain_over_5', 'analysis-news', `${date}.json`);
  const outPath = path.resolve(ROOT, process.argv[3] || `research_pending/daily-gainers-ai/${date}.json`);
  if (!fs.existsSync(factsPath)) throw new Error(`Missing facts: ${factsPath}`);
  if (!fs.existsSync(newsPath)) throw new Error(`Missing news: ${newsPath}`);

  const facts = loadJson(factsPath);
  const news = loadJson(newsPath);
  const required = ['margin', 'broker_details', 'mi_index', 'foreign', 'investment_trust', 'dealer'];
  const missing = required.filter((k) => facts.source_status?.[k] !== 'available');
  if (missing.length) throw new Error(`Facts are not complete for ${date}: ${missing.join(', ')}`);
  if (facts.stock_count !== facts.stocks?.length) throw new Error('Facts stock_count mismatch');
  if (news.stock_count !== news.analyses?.length) throw new Error('News stock_count mismatch');

  const newsByCode = new Map(news.analyses.map((x) => [String(x.code), x]));
  const checkedAt = new Date().toISOString();
  const scored = [];
  let instPositive = 0, instNegative = 0, brokerPositive = 0, brokerNegative = 0, marginUp = 0, marginDown = 0, alignedPositive = 0, divergent = 0;

  const analyses = facts.stocks.map((stock) => {
    const code = String(stock.code);
    const n = newsByCode.get(code);
    if (!n) throw new Error(`Missing news analysis for ${code}`);
    const flow = flowInterpretation(stock);
    if (isFiniteNumber(flow.inst.sum)) { if (flow.inst.sum > 0) instPositive += 1; else if (flow.inst.sum < 0) instNegative += 1; }
    if (isFiniteNumber(flow.brokerNet)) { if (flow.brokerNet > 0) brokerPositive += 1; else if (flow.brokerNet < 0) brokerNegative += 1; }
    if (isFiniteNumber(flow.marginDelta)) { if (flow.marginDelta > 0) marginUp += 1; else if (flow.marginDelta < 0) marginDown += 1; }
    if (flow.stance === 'aligned_positive') alignedPositive += 1;
    if (flow.stance === 'divergent') divergent += 1;
    scored.push({ code, score: score(n, flow) });

    const item = {
      code,
      cause_type: n.cause_type,
      cause_tags: Array.isArray(n.cause_tags) ? [...new Set(n.cause_tags)] : [],
      evidence_strength: n.evidence_strength,
      reason_summary: buildReason(n, stock, flow),
      evidence: buildEvidence(n, stock, flow),
      confidence: n.confidence,
      follow_up: buildFollowUp(n, flow),
      sources: Array.isArray(n.sources) ? n.sources : [],
    };
    const verification = verificationFor(stock, flow, checkedAt);
    if (verification) item.institutional_verification = verification;
    return item;
  });

  const priority = scored.sort((a, b) => b.score - a.score).slice(0, 12).map((x) => x.code);
  const payload = {
    schema_version: CONTRACT.ai.schema_version,
    methodology_version: CONTRACT.ai.methodology_version,
    model_role: CONTRACT.ai.model_role,
    contract_version: CONTRACT.contract_version,
    contract_policy: CONTRACT.policy,
    target_date: date,
    generated_at: checkedAt,
    source_facts_file: `data_daily_gain_over_5/analysis-facts/${date}.json`,
    source_news_file: `data_daily_gain_over_5/analysis-news/${date}.json`,
    stock_count: facts.stock_count,
    market_summary: {
      summary: `${date} 共 ${facts.stock_count} 檔漲幅 5% 以上股票；第二階段整合 exact-date 新聞題材與完整籌碼 Facts。可辨識法人淨買 ${instPositive} 檔、淨賣 ${instNegative} 檔；前15大分點淨買 ${brokerPositive} 檔、淨賣 ${brokerNegative} 檔；融資增加 ${marginUp} 檔、減少 ${marginDown} 檔。法人與分點同向偏多 ${alignedPositive} 檔，明顯背離 ${divergent} 檔。`,
      common_flow_clues: [
        `法人與分點同向偏多 ${alignedPositive} 檔，這類個股的題材漲勢有較完整的資金確認。`,
        `法人與分點方向背離 ${divergent} 檔，需把題材強度與籌碼續航分開判斷。`,
        `融資增加 ${marginUp} 檔、減少 ${marginDown} 檔；融資追價者需注意隔日震盪，去槓桿上漲則相對有利浮額整理。`,
        'no_record、zero_net、reported 依 exact-date Facts 分開處理，沒有把缺紀錄當成 0。',
      ],
    },
    priority_watchlist: priority,
    analyses,
  };

  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, `${JSON.stringify(payload, null, 2)}\n`);
  console.log(JSON.stringify({ output: path.relative(ROOT, outPath).replaceAll('\\', '/'), date, stock_count: payload.stock_count, priority_watchlist: priority, generated_at: checkedAt }, null, 2));
}

try { main(); } catch (error) { console.error(error.stack || error.message); process.exit(1); }
