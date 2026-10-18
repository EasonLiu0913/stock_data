'use strict';
// D4 research-only orchestrator: one explicit date, deterministic evidence and review-ready artifacts.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {plan}=require('./research_date_to_video_v1');
const {join}=require('./research_date_to_video_d4_evidence_join');
const {inventory}=require('./research_date_to_video_d4_claim_inventory');
const {review}=require('./research_date_to_video_d4_review_gate');
const hash=x=>crypto.createHash('sha256').update(x).digest('hex');
function run(root,date,out){
 const status=plan(root,date),result={contract:'DATE_TO_VIDEO_V1_D4_ORCHESTRATOR',target_date:date,research_only:true,publication_authorized:false,render_authorized:false,ready_to_render:false,stages:status.stages,blockers:[...status.blockers],artifacts:[]};
 const write=(name,obj)=>{const body=JSON.stringify(obj,null,2)+'\n';fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,name),body);result.artifacts.push({name,sha256:hash(body)});};
 if(status.stages[0].status==='WAITING_SOURCE'){write('status.json',result);return result}
 const load=(part)=>JSON.parse(fs.readFileSync(path.join(root,'data_daily_gain_over_5',part,date+'.json'),'utf8'));
 const inputs={list:load(''),facts:load('analysis-facts/'),news:load('analysis-news/'),ai:load('analysis-ai/')};
 const cutoff=date.slice(0,4)+'-'+date.slice(4,6)+'-'+date.slice(6)+'T23:59:59+08:00';
 try{
  const joined=join({date,cutoff,...inputs}),claims=inventory(joined,inputs);
  result.stages[0].status='EVIDENCE_JOINED_NOT_CERTIFIED';
  result.stages[1].status='WAITING_FINAL_MARKET_MASTER';
  result.stages[2].status='REVIEW_REQUIRED';
  result.blockers=['FINAL_MARKET_MASTER_NOT_CERTIFIED','CLAIM_REVIEW_REQUIRED'];
  const emptyReview={target_date:date,inventory_sha256:hash(JSON.stringify(claims)),decisions:[]};
  const gate=review(claims,emptyReview);
  write('evidence-join.json',joined);write('claims.json',claims);write('editorial-review.json',gate);
 }catch(e){
  result.stages[0].status='WAITING_SOURCE';result.blockers.push('D4_JOIN_REJECTED:'+e.message);
 }
 write('status.json',result);return result;
}
if(require.main===module){
 const [date,root='.',out]=process.argv.slice(2);
 if(!date||!out){console.error('Usage: node scripts/research_date_to_video_d4_orchestrator.js YYYYMMDD repo-root output-dir');process.exit(2)}
 try{const r=run(root,date,out);console.log('DATE_TO_VIDEO_D4_STATUS '+r.target_date+' '+r.stages[0].status+' '+r.artifacts.map(x=>x.name).join(','));if(r.stages[0].status==='WAITING_SOURCE')process.exitCode=3}catch(e){console.error(e.message);process.exitCode=2}
}
module.exports={run};
