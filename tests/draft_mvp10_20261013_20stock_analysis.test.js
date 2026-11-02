'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {draft}=require('../scripts/draft_mvp10_20261013_20stock_analysis');
test('no staged source must fail closed',()=>{
 assert.throws(()=>draft('/nonexistent/mvp10-candidate'));
});
test('premature final stage and mixed code order must be rejected',()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'mvp10-analysis-draft-'));
 try{
  const data=path.join(root,'data_daily_gain_over_5');
  fs.mkdirSync(path.join(data,'analysis-facts'),{recursive:true});
  const write=(p,v)=>fs.writeFileSync(path.join(root,p),JSON.stringify(v));
  const row={code:'6834',name:'天二科技',previous_close:100,close:110,change_pct:10,volume:100};
  write('data_daily_gain_over_5/20261013.json',{target_date:'20261013',stock_count:20,stocks:[row]});
  write('data_daily_gain_over_5/analysis-facts/20261013.json',{target_date:'20261013',stock_count:20,stocks:[{code:'6834',name:'天二科技',price:{close:110,change_pct:10,volume:100},flow:{}}]});
  write('research-mvp10-20261013-staging.json',{provisional_stock_count:20,analysis_final_rebuilt:true,
   render_authorized:false,source_date_classification_certified:false});
  assert.throws(()=>draft(root),/INVALID_PROVISIONAL_20_STOCK_SOURCE/);
  write('research-mvp10-20261013-staging.json',{provisional_stock_count:20,analysis_final_rebuilt:false,
   render_authorized:false,source_date_classification_certified:false});
  assert.throws(()=>draft(root),/INVALID_PROVISIONAL_20_STOCK_SOURCE/);
 }finally{fs.rmSync(root,{recursive:true,force:true});}
});
