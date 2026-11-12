'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {spawnSync}=require('node:child_process');

const date='20261104';
const builder=path.resolve(__dirname,'../scripts/build_daily_gainers_list_dashboard_slides.js');
function fixture(scope='TWSE_MI_INDEX_OFFICIAL_STOCK_COLUMN',flow={foreign:{net_lots:12},investment_trust:{net_lots:-3},margin:{margin_delta:7},dealer:{net_lots:42},broker:{top_buy_brokers:[{broker_name:'元大證券'}],top_sell_brokers:[{broker_name:'富邦證券'}]}}){
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'daily-gainers-dashboard-'));
 const out=path.join(root,'output/daily-gainers-video',date);
 fs.mkdirSync(path.join(out,'slides'),{recursive:true});
 fs.mkdirSync(path.join(root,'data_daily_gain_over_5/analysis-facts'),{recursive:true});
 fs.mkdirSync(path.join(root,'data_daily_gain_over_5/market-opening-video'),{recursive:true});
 const scenes=[
  {id:1,scene_type:'market_opening',stock_codes:[],title:'開盤',subtitle:'市場概況'},
  {id:2,scene_type:'stock_list',stock_codes:['1234'],title:'個股',subtitle:'一檔標的'},
  {id:3,scene_type:'closing_summary',stock_codes:[],title:'收盤觀察',subtitle:'後續觀察',bullets:['市場方向','資金方向','風險觀察']}
 ];
 fs.writeFileSync(path.join(out,'plan.json'),JSON.stringify({target_date:date,scenes}));
 fs.writeFileSync(path.join(root,'data_daily_gain_over_5/analysis-facts',date+'.json'),JSON.stringify({target_date:date,stock_count:1,stocks:[{code:'1234',name:'測試公司',price:{change_pct:5.25},flow}]}));
 const opening={target_date:date,status:'verified_official_market_aggregate',index:{source_date:date,close:100,change_points:-1,change_pct:-1},trading:{turnover_twd:1000000000000,turnover_ratio_ma5:1},market_opening_breadth:{scope,source_date:date,advancers:438,decliners:544,unchanged:99,limit_up:20},institutional:{foreign_net_twd:-100,investment_trust_net_twd:50,dealers_net_twd:-25,total_net_twd:-75}};
 fs.writeFileSync(path.join(root,'data_daily_gain_over_5/market-opening-video',date+'.json'),JSON.stringify(opening));
 return {root,out};
}

test('Dashboard builder consumes the registered same-date MI_INDEX breadth field',()=>{
 const {root,out}=fixture();
 try{
  const result=spawnSync(process.execPath,[builder,date],{cwd:root,encoding:'utf8'});
  assert.equal(result.status,0,result.stderr);
  const opening=fs.readFileSync(path.join(out,'slides','01.svg'),'utf8');
  const closing=fs.readFileSync(path.join(out,'slides','03.svg'),'utf8');
  assert.match(opening,/438 家／544 家/);
  assert.match(opening,/TWSE MI_INDEX 股票欄/);
  assert.match(closing,/上漲438家／下跌544家/);
 }finally{fs.rmSync(root,{recursive:true,force:true});}
});

test('Dashboard builder rejects a wrong breadth scope',()=>{
 const {root}=fixture('TWSE_COMMON_STOCK');
 try{
  const result=spawnSync(process.execPath,[builder,date],{cwd:root,encoding:'utf8'});
  assert.notEqual(result.status,0);
  assert.match(result.stderr,/same-date TWSE MI_INDEX official stock-column breadth/);
 }finally{fs.rmSync(root,{recursive:true,force:true});}
});

test('Stock dashboard adds dealer lots and keeps branch buy/sell as a separate field',()=>{
 const {root,out}=fixture();
 try{
  const result=spawnSync(process.execPath,[builder,date],{cwd:root,encoding:'utf8'});
  assert.equal(result.status,0,result.stderr);
  const list=fs.readFileSync(path.join(out,'slides','02.svg'),'utf8');
  const manifest=JSON.parse(fs.readFileSync(path.join(out,'list-dashboard-manifest.json'),'utf8'));
  for(const label of ['標的／代號','漲幅','外資(張)','投信(張)','融資(張)','自營商(張)','分點買／賣'])assert.ok(list.includes(label),label);
  assert.match(list,/>\+42</);
  assert.match(list,/買：元大證券/);
  assert.match(list,/賣：富邦證券/);
  assert.deepEqual(manifest.stock_dashboard_columns,['標的／代號','漲幅','外資(張)','投信(張)','融資(張)','自營商(張)','分點買／賣']);
  const positions=[148,400,560,700,840,980,1160];
  assert.deepEqual([...positions].sort((a,b)=>a-b),positions);
 }finally{fs.rmSync(root,{recursive:true,force:true});}
});

test('Missing dealer lots render a neutral unavailable marker, never zero',()=>{
 const {root,out}=fixture('TWSE_MI_INDEX_OFFICIAL_STOCK_COLUMN',{});
 try{
  const result=spawnSync(process.execPath,[builder,date],{cwd:root,encoding:'utf8'});
  assert.equal(result.status,0,result.stderr);
  const list=fs.readFileSync(path.join(out,'slides','02.svg'),'utf8');
  assert.match(list,/自營商\(張\)/);
  assert.match(list,/>—</);
  assert.doesNotMatch(list,/自營商[^<]*0/);
  assert.match(list,/買：無資料/);
  assert.match(list,/賣：無資料/);
 }finally{fs.rmSync(root,{recursive:true,force:true});}
});