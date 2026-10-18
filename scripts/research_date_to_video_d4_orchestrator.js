'use strict';
// D4 research-only orchestrator: one explicit date, deterministic evidence and review-ready artifacts.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {plan}=require('./research_date_to_video_v1');
const {join}=require('./research_date_to_video_d4_evidence_join');
const {inventory}=require('./research_date_to_video_d4_claim_inventory');
const {review}=require('./research_date_to_video_d4_review_gate');
const {inspect:inspectBfi82u}=require('./research_date_to_video_bfi82u_v1');
const {parse:parseBreadth}=require('./parse_twse_official_stock_aggregate');
const hash=x=>crypto.createHash('sha256').update(x).digest('hex');
function run(root,date,out){
 const status=plan(root,date),result={contract:'DATE_TO_VIDEO_V1_D4_ORCHESTRATOR',target_date:date,research_only:true,publication_authorized:false,render_authorized:false,ready_to_render:false,stages:status.stages,blockers:[...status.blockers],artifacts:[]};
 const write=(name,obj)=>{const body=JSON.stringify(obj,null,2)+'\n';fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,name),body);result.artifacts.push({name,sha256:hash(body)});};
 const marketOnlyMissing=status.blockers.length===1&&status.blockers[0]==='MISSING:market-opening';
 if(status.stages[0].status==='WAITING_SOURCE'&&!marketOnlyMissing){write('status.json',result);return result}
 const load=(part)=>JSON.parse(fs.readFileSync(path.join(root,'data_daily_gain_over_5',part,date+'.json'),'utf8'));
 const inputs={list:load(''),facts:load('analysis-facts/'),news:load('analysis-news/'),ai:load('analysis-ai/')};
 const cutoff=date.slice(0,4)+'-'+date.slice(4,6)+'-'+date.slice(6)+'T23:59:59+08:00';
 try{
  const joined=join({date,cutoff,...inputs}),claims=inventory(joined,inputs);
  result.stages[0].status=marketOnlyMissing?'PARTIAL_EVIDENCE_JOINED_MARKET_SOURCE_MISSING':'EVIDENCE_JOINED_NOT_CERTIFIED';
  const institutional=inspectBfi82u(root,date);
  const breadthPath=path.join(root,'data_twse_mi_index',date+'_twse_mi_index.json');
  let breadth={target_date:date,status:'WAITING_SOURCE',missing:['DATED_MI_INDEX_STOCK_AGGREGATE'],publication_authorized:false};
  if(fs.existsSync(breadthPath)){
   try{const bytes=fs.readFileSync(breadthPath);breadth={...parseBreadth(JSON.parse(bytes),date),status:'OFFICIAL_STOCK_COLUMN_VERIFIED_IDENTITY_UNCERTIFIED',source_sha256:hash(bytes)};}
   catch(e){breadth={target_date:date,status:'REJECTED',reason:e.message,publication_authorized:false};}
  }
  let marketMaster={target_date:date,status:'WAITING_SOURCE',publication_authorized:false,editorial_complete:false};
  if(!marketOnlyMissing&&institutional.status==='VERIFIED'&&breadth.status==='OFFICIAL_STOCK_COLUMN_VERIFIED_IDENTITY_UNCERTIFIED'){
   try{
    const base=load('market-opening/');
    if(base.target_date!==date||base.market!=='TWSE'||base.status!=='partial')throw Error('INVALID_DATED_MARKET_BASE');
    for(const name of ['foreign','investment_trust','dealers'])for(const key of ['buy_twd','sell_twd','net_twd'])if(base.institutional?.[name]?.[key]!==institutional.institutional[name][key])throw Error('MARKET_BASE_INSTITUTIONAL_MISMATCH_'+name+'_'+key);
    const trading=base.market_trading;if(!Number.isSafeInteger(trading?.turnover_twd)||trading.turnover_twd<=0)throw Error('INVALID_DATED_TURNOVER');
    marketMaster={target_date:date,status:'RESEARCH_MARKET_MASTER_SOURCE_CROSSCHECKED_EDITORIAL_PENDING',market:'TWSE',taiex:base.taiex,market_trading:trading,breadth, institutional:institutional.institutional,source_evidence:{market_base_sha256:hash(fs.readFileSync(path.join(root,'data_daily_gain_over_5/market-opening',date+'.json'))),mi_index_sha256:breadth.source_sha256,bfi82u_sha256:institutional.raw_sha256},ordinary_share_identity_certified:false,editorial_complete:false,publication_authorized:false};
   }catch(e){marketMaster={target_date:date,status:'REJECTED',reason:e.message,editorial_complete:false,publication_authorized:false};}
  }
  result.stages[1].status=marketMaster.status==='RESEARCH_MARKET_MASTER_SOURCE_CROSSCHECKED_EDITORIAL_PENDING'?'RESEARCH_MARKET_MASTER_SOURCE_CROSSCHECKED_EDITORIAL_PENDING':institutional.status==='VERIFIED'&&breadth.status==='OFFICIAL_STOCK_COLUMN_VERIFIED_IDENTITY_UNCERTIFIED'?'MARKET_SOURCE_EVIDENCE_PRESENT_MASTER_UNCERTIFIED':'WAITING_FINAL_MARKET_MASTER';
  result.stages[2].status='REVIEW_REQUIRED';
  result.blockers=[...(marketOnlyMissing?['MISSING:market-opening']:[]),...(institutional.status==='VERIFIED'?[]:['FINAL_DATED_BFI82U_THREE_GROUPS_PENDING']),...(breadth.status==='OFFICIAL_STOCK_COLUMN_VERIFIED_IDENTITY_UNCERTIFIED'?[]:['DATED_MI_INDEX_STOCK_AGGREGATE_PENDING']),'FINAL_MARKET_MASTER_NOT_CERTIFIED','CLAIM_REVIEW_REQUIRED'];
  const emptyReview={target_date:date,inventory_sha256:hash(JSON.stringify(claims)),decisions:[]};
  const gate=review(claims,emptyReview);
  write('market-master.json',marketMaster);
  write('evidence-join.json',joined);write('claims.json',claims);write('institutional-evidence.json',institutional);write('breadth-evidence.json',breadth);write('editorial-review.json',gate);
 }catch(e){
  result.stages[0].status='WAITING_SOURCE';result.blockers.push('D4_JOIN_REJECTED:'+e.message);
 }
 write('status.json',result);return result;
}
if(require.main===module){
 const [date,root='.',out]=process.argv.slice(2);
 if(!date||!out){console.error('Usage: node scripts/research_date_to_video_d4_orchestrator.js YYYYMMDD repo-root output-dir');process.exit(2)}
 try{const r=run(root,date,out);console.log('DATE_TO_VIDEO_D4_STATUS '+r.target_date+' '+r.stages[0].status+' '+r.artifacts.map(x=>x.name).join(','));if(r.stages[0].status==='WAITING_SOURCE'||r.stages[0].status==='PARTIAL_EVIDENCE_JOINED_MARKET_SOURCE_MISSING')process.exitCode=3}catch(e){console.error(e.message);process.exitCode=2}
}
module.exports={run};
