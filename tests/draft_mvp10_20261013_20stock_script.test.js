'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {draft}=require('../scripts/draft_mvp10_20261013_20stock_script');
test('missing staged research bundle is rejected',()=>assert.throws(()=>draft('/nonexistent/source')));
test('no changed date or false final admitted',()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'mvp10-seven-scenes-'));
 try {
  const data=path.join(root,'data_daily_gain_over_5');
  fs.mkdirSync(path.join(data,'analysis-facts'),{recursive:true});
  fs.writeFileSync(path.join(data,'20261013.json'),JSON.stringify({target_date:'20261013',stock_count:20,stocks:[]}));
  fs.writeFileSync(path.join(data,'analysis-facts/20261013.json'),JSON.stringify({target_date:'20261013',stock_count:20,stocks:[]}));
  fs.writeFileSync(path.join(root,'research-mvp10-20261013-staging.json'),JSON.stringify({
   provisional_stock_count:20,render_authorized:true,analysis_final_rebuilt:false,
   source_date_classification_certified:false
  }));
  assert.throws(()=>draft(root),/STAGE_NOT_APPROVED_FOR_DRAFT|FACTS_AND_RAW_OUT_OF_SYNC/);
 } finally {fs.rmSync(root,{recursive:true,force:true});}
});
