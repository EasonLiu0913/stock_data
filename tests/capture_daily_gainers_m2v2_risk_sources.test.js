'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {capture}=require('../scripts/capture_daily_gainers_m2v2_risk_sources');
function response(value,status=200){
 const bytes=Buffer.from(JSON.stringify(value));
 return {ok:status===200,status,headers:{get:()=> 'application/json'},arrayBuffer:async()=>bytes};
}
test('recognizes authentic date-scoped halt empty-state without certifying clearance',async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'m2-risk-'));
 try{
  const fn=async url=>url.includes('TWTAWU')?response({stat:'很抱歉，沒有符合條件的資料!',title:'暫停交易證券 查詢範圍：全部上市證券 期間：115/10/08 到 115/10/08'}):response({stat:'OK',data:[],fields:[]});
  const v=await capture(fn,dir);
  const halt=v.results.find(x=>x.source==='TWSE_TEMPORARY_HALT');
  assert.equal(halt.official_no_match_schema_recognized,true);
  assert.equal(halt.negative_clearance_certified,false);
  assert.equal(halt.date_scoped_complete,false);
  assert.deepEqual(v.verified_clearance_codes,[]);
  assert.equal(v.publication_authorized,false);
  assert.equal(v.results.find(x=>x.source==='TWSE_DISPOSITION').request_url.includes('startDate=20260901'),true);
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
test('rejects misleading empty-state for a different date',async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'m2-risk-'));
 try{
  const fn=async url=>url.includes('TWTAWU')?response({stat:'很抱歉，沒有符合條件的資料!',title:'暫停交易證券 查詢範圍：全部上市證券 期間：115/10/07 到 115/10/07'}):response({stat:'OK',data:[],fields:[]});
  const v=await capture(fn,dir);const halt=v.results.find(x=>x.source==='TWSE_TEMPORARY_HALT');
  assert.equal(halt.official_no_match_schema_recognized,false);
  assert.equal(halt.error,'UNVERIFIED_RESPONSE_SCHEMA_OR_HTTP_STATUS');
  assert.equal(halt.negative_clearance_certified,false);
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
