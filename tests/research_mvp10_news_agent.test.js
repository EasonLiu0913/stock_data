'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {execute,sourceData,exactMatch,parseDate}=require('../scripts/research_mvp10_news_agent');
function fixture(){
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'mvp10-source-'));
 fs.mkdirSync(path.join(root,'data_daily_gain_over_5'),{recursive:true});
 fs.writeFileSync(path.join(root,'data_daily_gain_over_5/20261102.json'),JSON.stringify({target_date:'20261102',threshold_pct:5,stock_count:1,stocks:[{code:'2491',name:'吉祥全',previous_close:40.5,close:44.55,change_pct:10,volume:2966}]}));
 return root;
}
test('real date required',()=>{assert.throws(()=>parseDate('20261131'),/IMPOSSIBLE_DATE/);assert.throws(()=>parseDate('2026108'),/INVALID_DATE/)});
test('raw source arithmetic and date fail closed',()=>{const root=fixture();assert.equal(sourceData(root,'20261102').raw.stock_count,1);assert.throws(()=>sourceData(root,'20261103'),/RAW_MISSING/);fs.rmSync(root,{recursive:true,force:true})});
test('missing news does not pretend that Agent was invoked',async()=>{
 const root=fixture(),out=fs.mkdtempSync(path.join(os.tmpdir(),'mvp10-news-'));
 const result=await execute({root,date:'20261102',outputRoot:out});
 assert.equal(result.status,'MISSING_AGENT_NOT_INVOKED');
 assert.equal(fs.existsSync(path.join(out,'data_daily_gain_over_5/analysis-news/20261102.json')),false);
 assert.equal(result.publication_authorized,false);
 fs.rmSync(root,{recursive:true,force:true});fs.rmSync(out,{recursive:true,force:true});
});
test('execution without provider token must refuse',async()=>{
 const root=fixture(),out=fs.mkdtempSync(path.join(os.tmpdir(),'mvp10-news-'));
 await assert.rejects(execute({root,date:'20261102',outputRoot:out,executeAgent:true,key:''}),/OPENAI_API_KEY_MISSING/);
 fs.rmSync(root,{recursive:true,force:true});fs.rmSync(out,{recursive:true,force:true});
});
test('strong claims require URLs and exact stock identities',()=>{
 const s=[{code:'2491',name:'吉祥全',change_pct:10}];
 const a={code:'2491',name:'吉祥全',change_pct:10,cause_type:'company_event',cause_tags:[],evidence_strength:'direct',reason_summary:'',evidence:[],confidence:'high',follow_up:[],sources:[]};
 assert.throws(()=>exactMatch([a],s),/NEWS_UNSOURCED_STRONG_CLAIM/);
 a.evidence_strength='none';a.cause_type='unknown';a.confidence='low';exactMatch([a],s);
 a.code='4720';assert.throws(()=>exactMatch([a],s),/NEWS_STOCK_MISMATCH/);
});
test('provider request uses web search but never repository write credentials',async()=>{
 const {generateBatch}=require('../scripts/research_mvp10_news_agent');
 const stocks=[{code:'2491',name:'吉祥全',change_pct:10,volume:2966}];
 const analysis={code:'2491',name:'吉祥全',change_pct:10,cause_type:'unknown',cause_tags:['other'],evidence_strength:'none',reason_summary:'尚未找到可驗證的催化',evidence:['當日漲幅10%'],confidence:'low',follow_up:['追蹤公告'],sources:[]};
 const fn=async(url,req)=>{
  assert.equal(url,'https://api.openai.com/v1/responses');
  const body=JSON.parse(req.body);assert.equal(body.tool_choice,'required');
  assert.equal(body.tools[0].type,'web_search');
  return {ok:true,json:async()=>({id:'test-only',output_text:JSON.stringify([analysis])})};
 };
 const r=await generateBatch(stocks,'20261102','test-token','gpt-5.5',fn);
 assert.equal(r.result.length,1);assert.equal(r.response_id,'test-only');
});
