'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {audit}=require('../scripts/audit_mvp10_20261013_script_invalidation');
function f(){
 const script={target_date:'20261013',stock_count:25,scenes:Array.from({length:7},(_,i)=>({
   title:i===0?'今天有25檔強勢股':'個股分析',subtitle:'',
   narration:i===1?'二十五檔強勢股，但是六百二十五張':'外資仍需查核',
   stock_codes:i===3?['9103']:[],bullets:[],footer:''
 }))};
 return {script,raw:{target_date:'20261013',stock_count:25},
   stage:{provisional_stock_count:20,analysis_final_rebuilt:false,render_authorized:false,
     publication_authorized:false,excluded_original_codes:['1312A','6645','6924','7730','9103']}};
}
test('stale 25 count detected, 625 lots not mistaken for 25 stocks',()=>{
 const x=f(),r=audit(x.script,x.raw,x.stage);
 assert.deepEqual(r.stale_stock_count_scenes,[1,2]);
 assert.ok(r.scenes.every(s=>s.original_tts_reusable===false&&s.original_render_reusable===false));
 assert.deepEqual(r.scenes[3].excluded_scene_codes,['9103']);
 assert.equal(r.render_authorized,false);
});
test('invalid date, excluded security scope or false final permission reject',()=>{
 const x=f();x.script.target_date='20261012';
 assert.throws(()=>audit(x.script,x.raw,x.stage),/IDENTITY_DRIFT/);
 const y=f();y.stage.excluded_original_codes.pop();
 assert.throws(()=>audit(y.script,y.raw,y.stage),/EXCLUSION_SCOPE_MISMATCH/);
 const z=f();z.stage.render_authorized=true;
 assert.throws(()=>audit(z.script,z.raw,z.stage),/UNVERIFIED_STAGING_MANIFEST/);
});
