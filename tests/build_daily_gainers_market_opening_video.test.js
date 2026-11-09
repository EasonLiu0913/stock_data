'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {buildOpening}=require('../scripts/build_daily_gainers_market_opening_video');
const {normalizeBfi82u}=require('../scripts/capture_twse_bfi82u');
const date='20261104';
const bytes=path=>fs.readFileSync(path);
function inputs(){
 const miBytes=bytes(`data_twse_mi_index/${date}_twse_mi_index.json`);
 const chartBytes=bytes('data_twse_market_chart/market_chart.json');
 const bfiBytes=bytes(`data_twse_bfi82u/${date}_twse_bfi82u.json`);
 return {date,miBytes,chartBytes,bfiBytes,miIndex:JSON.parse(miBytes),marketChart:JSON.parse(chartBytes),bfi82u:JSON.parse(bfiBytes),receipt:JSON.parse(bytes(`data_daily_gain_over_5/verification/official-numeric/${date}.json`))};
}
test('builds schema-v3 opening from dated TWSE evidence and includes no-comparison in MI_INDEX denominator',()=>{
 const result=buildOpening(inputs());
 assert.equal(result.schema_version,3);
 assert.equal(result.market_opening_breadth.scope,'TWSE_MI_INDEX_OFFICIAL_STOCK_COLUMN');
 assert.deepEqual([result.market_opening_breadth.advancers,result.market_opening_breadth.decliners,result.market_opening_breadth.unchanged,result.market_opening_breadth.no_trade,result.market_opening_breadth.no_comparison,result.market_opening_breadth.eligible_count],[438,544,99,0,7,1088]);
 assert.equal(result.institutional.total_net_twd,-160160345734);
 assert.equal(result.institutional.dealers_net_twd,-37518970501);
 assert.deepEqual(result.source_manifest.map(x=>x.source_name),['TWSE MI_INDEX','TWSE FMTQIK / MI_5MINS_HIST','TWSE BFI82U']);
});
test('rejects MI_INDEX source changes after its official numeric receipt',()=>{
 const value=inputs(); value.miBytes=Buffer.from(value.miBytes.toString().replace('42,948.91','42,949.00')); value.miIndex=JSON.parse(value.miBytes);
 assert.throws(()=>buildOpening(value),/OFFICIAL_NUMERIC_RECEIPT_MISMATCH/);
});
test('rejects BFI82U file byte tampering',()=>{
 const value=inputs(); value.bfi82u.dealers.sell_twd+=2;
 assert.throws(()=>buildOpening(value),/INSTITUTIONAL_NET_MISMATCH/);
});
test('normalizes official BFI82U rows and excludes the foreign-dealer row from the total',()=>{
 const rows=[
  ['自營商(自行買賣)','14,941,922,398','15,695,195,478','-753,273,080'],
  ['自營商(避險)','63,395,872,517','100,161,569,938','-36,765,697,421'],
  ['投信','37,010,569,606','9,752,110,763','27,258,458,843'],
  ['外資及陸資(不含外資自營商)','455,072,375,440','604,972,209,516','-149,899,834,076'],
  ['外資自營商','0','0','0'],
  ['合計','570,420,739,961','730,581,085,695','-160,160,345,734']
 ];
 const normalized=normalizeBfi82u({date,tables:[{fields:['單位名稱','買進金額','賣出金額','買賣差額'],data:rows}]},date,'official-source-fixture','https://www.twse.com.tw/rwd/zh/fund/BFI82U?dayDate=20261104&response=json&type=day');
 assert.equal(normalized.dealers.net_twd,-37518970501);
 assert.equal(normalized.total.net_twd,-160160345734);
 assert.throws(()=>normalizeBfi82u({date:'20261103',tables:[]},date,'bad','https://www.twse.com.tw/'),/BFI82U_DATE_MISMATCH/);
});
test('normalizes the archived official BFI82U top-level fields/data response',()=>{
 const raw=fs.readFileSync('data_research/twse-market-opening/primary-archive/20261008/20261008-bfi82u.json','utf8');
 const payload=JSON.parse(raw);
 const normalized=normalizeBfi82u(payload,payload.date,raw,'https://www.twse.com.tw/rwd/zh/fund/BFI82U?dayDate=20261008&response=json&type=day');
 assert.equal(normalized.foreign.net_twd,-75852293490);
 assert.equal(normalized.investment_trust.net_twd,3008930013);
 assert.equal(normalized.dealers.net_twd,-18731261604);
 assert.equal(normalized.total.net_twd,-91574625081);
});
test('reports safe response-shape diagnostics without logging source rows when the summary table is absent',()=>{
 const error=()=>normalizeBfi82u({date,stat:'OK',fields:['unexpected'],data:[['DO_NOT_LOG','123456789']]},date,'bad','https://www.twse.com.tw/');
 assert.throws(error,e=>{
  assert.match(e.message,/BFI82U_SUMMARY_TABLE_MISSING:/);
  assert.match(e.message,/"fields":\["unexpected"\]/);
  assert.match(e.message,/"status":"OK"/);
  assert.doesNotMatch(e.message,/123456789|DO_NOT_LOG/);
  return true;
 });
});
