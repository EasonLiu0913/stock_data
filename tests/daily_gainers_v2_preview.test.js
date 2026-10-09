'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {preview}=require('../scripts/build_daily_gainers_v2_preview');

const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'gainers-v2-'));
function save(p,value){
 const full=path.join(tmp,p);
 fs.mkdirSync(path.dirname(full),{recursive:true});
 fs.writeFileSync(full,JSON.stringify(value));
}
const date='20261009';
try {
 save('data_daily_gain_over_5/'+date+'.json',{
   target_date:date,stock_count:1,stocks:[{code:'2330',name:'台積電'}]
 });
 save('video_scripts/daily-gainers/'+date+'.json',{
   target_date:date,stock_count:1,scenes:[{
    title:'籌碼焦點',subtitle:'測試',bullets:['觀察外資'],stock_codes:['2330']
   }]
 });
 save('video_scripts/daily-gainers/rules/text-presentation.v1.json',{version:'daily-gainers-text-presentation-v1'});
 save('video_scripts/daily-gainers/v2/'+date+'/master.json',{
   schema_version:2,target_date:date,scenes:[{cues:[
     [{type:'date',value:'2026-10-09'},{type:'text',value:'，'},{type:'stock',code:'2330'},
      {type:'text',value:'上漲'},{type:'percent',value:'3.25'},{type:'text',value:'。'}],
     [{type:'text',value:'外資買超'},{type:'number',value:'12500'},{type:'text',value:'張。'}]
   ]}]
 });
 const result=preview(date,tmp);
 const plan=JSON.parse(fs.readFileSync(path.join(result.output,'plan.json')));
 assert.equal(plan.schema_version,2);
 assert.equal(plan.scenes[0].caption_cues.length,2);
 assert.equal(plan.scenes[0].caption_text,'10/9，台積電上漲3.25%。外資買超12,500張。');
 assert.equal(plan.scenes[0].speech_text,'十月九日，台積電上漲百分之三點二五。外資買超一萬二千五百張。');
 assert.equal(plan.scenes[0].caption_cues.map(c=>c.caption).join(''),plan.scenes[0].caption_text);
 assert.equal(plan.scenes[0].caption_cues.map(c=>c.speech).join(''),plan.scenes[0].speech_text);
 assert.ok(fs.existsSync(path.join(result.output,'display.json')));
 assert.ok(fs.existsSync(path.join(result.output,'manifest.json')));
 console.log('v2 plan integration dry-run PASS (no audio, render or upload)');
} finally {
 fs.rmSync(tmp,{recursive:true,force:true});
}
