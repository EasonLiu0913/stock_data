#!/usr/bin/env node
'use strict';
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const assert=require('node:assert/strict');
const {spawnSync}=require('node:child_process');
const root=fs.mkdtempSync(path.join(os.tmpdir(),'video-date-gate-'));
const date='20261008';
const validator=path.resolve(__dirname,'../scripts/validate_daily_gainers_video_script.js');
const put=(name,value)=>{const p=path.join(root,name);fs.mkdirSync(path.dirname(p),{recursive:true});fs.writeFileSync(p,JSON.stringify(value));};
const stocks=[{code:'9103',name:'測試公司甲'},{code:'9104',name:'測試公司乙'},{code:'9105',name:'測試公司丙'}];
const openingValues={index_close:'一百點',index_change_points:'一點',index_change_pct:'百分之一',turnover_twd:'一兆元',advancers:'上漲十家',decliners:'下跌九家',unchanged:'平盤一家',limit_up:'漲停一家',foreign_net_twd:'外資十元',investment_trust_net_twd:'投信二十元',dealers_net_twd:'自營商三十元',total_net_twd:'合計六十元'};
const narration='加權指數一百點，漲跌一點，漲幅百分之一。成交金額一兆元，高於前五個交易日平均。上漲十家，下跌九家。平盤一家，漲停一家。外資十元，投信二十元，自營商三十元。三大法人合計六十元。'+('這是明確標記為合成測試資料的開盤旁白。'.repeat(40))+'市場盤勢震盪，接下來持續觀察。';
const scenes=[
 {scene_type:'market_opening',title:'市場開盤',subtitle:'合成測試資料',bullets:['合成資料'],narration,stock_codes:[],market_opening_claims:{advancers:10,decliners:9,unchanged:1,limit_up:1,index_close:100,index_change_points:1,index_change_pct:1,turnover_twd:1000000000000,foreign_net_twd:10,investment_trust_net_twd:20,dealers_net_twd:30,total_net_twd:60},spoken_values:openingValues},
 {scene_type:'stock_list',title:'個股重點甲',subtitle:'合成測試資料',bullets:['合成資料'],narration:'這是合成測試資料旁白。'.repeat(9),stock_codes:['9103']},
 {scene_type:'stock_list',title:'個股重點乙',subtitle:'合成測試資料',bullets:['合成資料'],narration:'這是合成測試資料旁白。'.repeat(9),stock_codes:['9104']},
 {scene_type:'stock_list',title:'個股重點丙',subtitle:'合成測試資料',bullets:['合成資料'],narration:'這是合成測試資料旁白。'.repeat(9),stock_codes:['9105']},
 {scene_type:'closing_summary',title:'收尾總結',subtitle:'合成測試資料',bullets:['合成測試一','合成測試二','合成測試三'],narration:'這是合成測試資料旁白。'.repeat(9),stock_codes:[]}
];
const script={schema_version:1,methodology_version:'chatgpt-video-script-v1',target_date:date,source_summary_generated_at:'2026-10-08T14:07:26.264Z',stock_count:3,privacy_status:'private',scenes};
const manifest=['TWSE MI_INDEX','TWSE FMTQIK / MI_5MINS_HIST','TWSE BFI82U'].map(source_name=>({source_date:date,source_name,source_path_or_endpoint:'synthetic-test-fixture',verified:true,sha256:'a'.repeat(64)}));
const market={target_date:date,status:'verified_official_market_aggregate',market:'TWSE',market_opening_breadth:{source_date:date,scope:'TWSE_MI_INDEX_OFFICIAL_STOCK_COLUMN',advancers:10,decliners:9,unchanged:1,limit_up:1},index:{source_date:date,close:100,previous_close:99,change_points:1,change_pct:1},trading:{source_date:date,scope:'TWSE_WHOLE_MARKET',turnover_twd:1000000000000,turnover_ma5_twd:500000000000,turnover_ratio_ma5:2},institutional:{source_date:date,scope:'TWSE_BFI82U_TWD',foreign_net_twd:10,investment_trust_net_twd:20,dealers_net_twd:30,total_net_twd:60},source_manifest:manifest};
put('data_daily_gain_over_5/'+date+'.json',{target_date:date,stock_count:3,stocks});
put('data_daily_gain_over_5/analysis-ai/'+date+'.json',{target_date:date,stock_count:3});
put('data_daily_gain_over_5/market-summary/'+date+'.json',{target_date:date,generated_at:'2026-10-09T01:56:25.509Z',status:'final',coverage:{overall:'complete'}});
put('data_daily_gain_over_5/market-opening-video/'+date+'.json',market);
put('video_scripts/daily-gainers/'+date+'.json',script);
put('scripts/build_daily_gainers_list_dashboard_slides.js',"const fixedFields=['加權指數','全市場成交金額','上漲／下跌','平盤／漲停','外資／投信／自營商','三大法人合計','市場強弱摘要'];\nconst manifest={opening_dashboard_fields:fixedFields};\n");
function run(){return spawnSync(process.execPath,[validator,date],{cwd:root,encoding:'utf8'});}
try {
  const ok=run();
  assert.equal(ok.status,0,ok.stderr);
  script.target_date='20261009'; put('video_scripts/daily-gainers/'+date+'.json',script);
  const bad=run(); assert.notEqual(bad.status,0,'wrong-date script must be rejected'); assert.match(bad.stderr,/date mismatch/);
  console.log('PASS: historical timestamp drift accepted with synthetic test-only official-gate fixture; wrong date rejected');
} finally {fs.rmSync(root,{recursive:true,force:true});}
