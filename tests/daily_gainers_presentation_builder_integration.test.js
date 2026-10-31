'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {spawnSync}=require('node:child_process');
const builder=path.resolve(__dirname,'../scripts/build_daily_gainers_video_package.js');
const DATE='20261008';
function fixture(mutator) {
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'mvp10-presentation-contract-'));
  for(const d of ['data_daily_gain_over_5/analysis-ai','data_daily_gain_over_5/market-summary','video_scripts/daily-gainers'])fs.mkdirSync(path.join(root,d),{recursive:true});
  const raw={target_date:DATE,stock_count:1,stocks:[{code:'2330'}]};
  const ai={target_date:DATE,stock_count:1};
  const summary={target_date:DATE,status:'final',coverage:{overall:'complete'},headline:'市場整理',market_summary:'市場資訊'};
  const script={target_date:DATE,stock_count:1,privacy_status:'private',scenes:[
    {title:'第一場景',subtitle:'上市普通股',narration:'今天行情請留意數據。',bullets:['最新收盤資料'],footer:'TAIWANSTOCK｜每日5%強勢股研究'},
    {title:'第二場景',subtitle:'籌碼分析',narration:'接著觀察法人動向。',bullets:['成交量'],footer:'TAIWANSTOCK｜每日5%強勢股研究'}
  ]};
  if(mutator)mutator({raw,ai,summary,script});
  const write=(p,obj)=>fs.writeFileSync(path.join(root,p),JSON.stringify(obj));
  write('data_daily_gain_over_5/'+DATE+'.json',raw);
  write('data_daily_gain_over_5/analysis-ai/'+DATE+'.json',ai);
  write('data_daily_gain_over_5/market-summary/'+DATE+'.json',summary);
  write('video_scripts/daily-gainers/'+DATE+'.json',script);
  return root;
}
function build(root){return spawnSync(process.execPath,[builder,DATE],{cwd:root,encoding:'utf8'});}
test('real package builder produces exact V4 and version-tagged plan with no CC',()=>{
  const root=fixture();
  try{
    const result=build(root);
    assert.equal(result.status,0,result.stderr);
    const dir=path.join(root,'output/daily-gainers-video',DATE);
    const plan=JSON.parse(fs.readFileSync(path.join(dir,'plan.json'),'utf8'));
    assert.equal(plan.presentation_contract.version,'TAIWAN-STOCK-MVP10-V4-20261031');
    assert.equal(plan.presentation_contract.obsolete_cc_prompt_allowed,false);
    assert.ok(plan.scenes[0].narration.startsWith('大家好，歡迎來到 TAIWAN STOCK！追蹤資金，解讀行情。錢在哪，我們就在哪！那麼我們開始囉。'));
    for(const name of fs.readdirSync(path.join(dir,'slides')))assert.ok(!fs.readFileSync(path.join(dir,'slides',name),'utf8').includes('歡迎打開 CC'));
  }finally{fs.rmSync(root,{recursive:true,force:true});}
});
for(const [name,edit] of [
  ['obsolete CC footer in first scene',({script})=>script.scenes[0].footer='歡迎打開 CC 中文字幕觀賞'],
  ['obsolete CC in subsequent scene',({script})=>script.scenes[1].narration='請開啟 CC 字幕'],
  ['obsolete CC in slide bullet',({script})=>script.scenes[1].bullets=['打開字幕觀賞']],
  ['obsolete CC in title',({script})=>script.scenes[0].title='歡迎打開 CC 中文字幕觀賞'],
]){
  test('fail closed before writing plan: '+name,()=>{
    const root=fixture(edit);
    try{
      const result=build(root);
      assert.notEqual(result.status,0);
      assert.match(result.stderr,/Obsolete CC prompt/);
      assert.equal(fs.existsSync(path.join(root,'output/daily-gainers-video',DATE,'plan.json')),false);
    }finally{fs.rmSync(root,{recursive:true,force:true});}
  });
}
