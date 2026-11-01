#!/usr/bin/env node
'use strict';
// RESEARCH ONLY. Scenario drafts preserve frozen 20261008 source files;
// never claim audited eligibility, recomputed AI semantics, or render permission.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const EXTRA=Object.freeze(['6645','7740']);
const TDR='9103';
const NUM='零一二三四五六七八九';
const integer=n=>String(n).split('').map(x=>NUM[Number(x)]).join('');
function inspect(root,date='20261008'){
 if(date!=='20261008')throw Error('DRAFT_DATE_NOT_REGISTERED');
 const read=(p)=>{const b=fs.readFileSync(path.join(root,p));return {data:JSON.parse(b),sha256:sha(b),path:p}};
 const raw=read('data_daily_gain_over_5/'+date+'.json');
 const published=read('data_daily_gain_over_5/analysis/'+date+'.json');
 const script=read('video_scripts/daily-gainers/'+date+'.json');
 const news=read('data_daily_gain_over_5/analysis-news/'+date+'.json');
 for(const [k,obj] of Object.entries({raw,published,script,news})){
  if(obj.data.target_date!==date||obj.data.stock_count!==35)throw Error('LEGACY_INPUT_DATE_OR_COUNT:'+k);
 }
 const name=new Map(raw.data.stocks.map(x=>[String(x.code),x]));
 const evidence=new Map(published.data.analyses.map(x=>[String(x.code),x]));
 const newsBy=new Map(news.data.analyses.map(x=>[String(x.code),x]));
 if(name.size!==35||evidence.size!==35||newsBy.size!==35)throw Error('MISSING_SOURCE_ANALYSIS');
 const expect=[{code:TDR,name:'美德醫療-DR'}, {code:'6645',name:'金萬林-創'}, {code:'7740',name:'熙特爾-創'}];
 for(const z of expect)if(name.get(z.code)?.name!==z.name)throw Error('FROZEN_CODE_NAME_DRIFT:'+z.code);
 if(!script.data.scenes?.[2]?.stock_codes?.includes(TDR))throw Error('EXPECTED_DR_SCENE_MOVED');
 const scenarios=[];
 for(const [scenario,exclusions,scope] of [
  ['STOCK_CATEGORY_ONLY',['9103','6645','7740'],'INNOVATION_BOARD_UNRESOLVED_EXCLUDED_PROVISIONALLY'],
  ['INNOVATION_CONDITIONAL_INCLUDED',['9103'],'INNOVATION_BOARD_ELIGIBILITY_NOT_PROVEN']
 ]){
  const excluded=new Set(exclusions),rows=raw.data.stocks.filter(r=>!excluded.has(String(r.code)));
  const bio=rows.filter(r=>(evidence.get(String(r.code))?.cause_tags||[]).includes('biotech'));
  const publicCount=rows.filter(r=>['direct','corroborated'].includes(evidence.get(String(r.code))?.evidence_strength)).length;
  if(rows.length!==(scenario==='STOCK_CATEGORY_ONLY'?32:34))throw Error('SCENARIO_COUNT_DRIFT');
  if(bio.length!==(scenario==='STOCK_CATEGORY_ONLY'?3:4))throw Error('BIOTECH_COUNT_DRIFT');
  const avg=Math.round(bio.reduce((s,x)=>s+Number(x.change_pct),0)/bio.length*100)/100;
  const coverage=Math.round(publicCount/rows.length*1000)/10;
  const lead=rows.find(x=>String(x.code)==='9919'),leadEvidence=evidence.get('9919'),leadNews=newsBy.get('9919');
  if(!lead||!leadEvidence||!leadNews||lead.name!=='康那香'||leadEvidence.flow?.foreign?.net_lots!==-18||
     leadEvidence.flow?.margin?.margin_delta!==-327)throw Error('LEAD_EVIDENCE_NOT_RECONCILED');
  const statusPrefix='【研究條件草案，未經普通股資格／全部語意驗收】';
  // Conservatively avoid attributing a definitive company cause and avoid legacy 9103/南染 references.
  const drafts={
   '1':`${statusPrefix}十月八日，以${scope==='INNOVATION_BOARD_ELIGIBILITY_NOT_PROVEN'?'暫時納入創新板':'暫時排除創新板'}的研究分類情境來看，有${rows.length}檔漲幅達百分之五以上的候選股票。這不是已完成普通股分類的正式清單，現有分析顯示防疫、石化與個別營收題材交錯發展。公開直接或交叉佐證計有${publicCount}檔，約佔百分之${coverage}。我們仍須核對公司公告、法人資料與個股流動性；其餘資訊必須回到日期一致的來源確認，不應單純以股價上漲反推利多。`,
   '2':`${statusPrefix}防疫相關分類在本情境共有${bio.length}檔，研究資料中的平均漲幅約百分之${avg}。這是從既有逐股漲幅重算的條件數據，不代表所有公司都已獲得實際訂單。康那香、恆大、南六同在題材觀察名單；若創新板資格最終確認，金萬林才可能依相同條件納入。後續仍應核對每一家公司的公告、成交量與法人方向，避免把產業消息視為個股業績證明。`,
   '3':`${statusPrefix}個股案例改為康那香，代號九九一九。十月八日研究原始清單記錄收盤${lead.close}元，漲幅百分之${lead.change_pct}，成交${lead.volume}張。既有法人事實記錄外資賣超十八張，融資減少三百二十七張。防疫需求受到市場討論，但這些資料不能證明公司在當天取得新訂單。外資賣超與股價上漲的差異值得留意，隔日要再核對成交量、公司公告與正式的日期化法人資料，不把未取得的投信逐股資料當成零。`,
   '9':`${statusPrefix}本研究情境的強勢候選共有${rows.length}檔，能在既有資料中找到直接或交叉公開催化佐證的有${publicCount}檔，約占百分之${coverage}。這些是草案分母下的重算值，仍須重新驗證全部逐股新聞、法人與產業分類。隔日應追蹤防疫題材能否延續、法人買賣方向與融資風險，也要注意低成交量股票可能難以按預期價格成交。本段僅供研究，不構成投資建議。`
  };
  const banned=/美德醫療|南染|代號九一零三/;
  for(const [scene,text] of Object.entries(drafts)){
    if(banned.test(text)||text.length<75||text.length>1800)throw Error('UNSAFE_DRAFT_TEXT:'+scene);
  }
  scenarios.push({
    name:scenario,eligibility_status:scope,excluded_codes:exclusions,
    source_stock_count:35,conditional_stock_count:rows.length,
    conditional_biotech_codes:bio.map(x=>String(x.code)),
    conditional_biotech_average_gain_pct:avg,
    conditional_public_catalyst_count:publicCount,
    conditional_catalyst_coverage_pct:coverage,
    proposed_lead_code:'9919',
    affected_scene_drafts:drafts,
    all_scene_facts_reverified:false,full_ai_synthesis_recomputed:false,
    dates_and_security_scope_certified:false,render_authorized:false,publication_authorized:false
  });
 }
 return {
  schema_version:1,target_date:date,source_files:{raw:raw.path,published:published.path,news:news.path,script:script.path},
  source_sha256:{raw:raw.sha256,published:published.sha256,news:news.sha256,script:script.sha256},
  scenarios,decision:'DRAFT_ONLY_CONDITIONAL_NOT_RENDERABLE',
  gaps:['historically verified InnovationBoard common-stock eligibility',
  'fresh date-matched facts/news/AI/published analysis, summary and script',
  'full-scene factual review; V4, TTS, subtitle timing and final MP4 QA'],
  original_source_unchanged:true,render_authorized:false,publication_authorized:false
 };
}
if(require.main===module){
 try{console.log(JSON.stringify(inspect(process.argv[3]||process.cwd(),process.argv[2]||'20261008'),null,2));}
 catch(e){console.error(e.stack||e.message);process.exitCode=1}
}
module.exports={inspect};
