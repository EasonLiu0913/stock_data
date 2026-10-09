'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {buildBreadth}=require('../scripts/build_twse_common_stock_breadth');
function fixture(){
 const date='20261008';
 return {
  targetDate:date,
  master:{date,market:'TWSE',source:{as_of_date:date,digest_verified:true},securities:[
   {code:'1111',market:'TWSE',security_type:'COMMON_STOCK',classification_verified:true},
   {code:'2222',market:'TWSE',security_type:'COMMON_STOCK',classification_verified:true},
   {code:'3333',market:'TWSE',security_type:'COMMON_STOCK',classification_verified:true},
   {code:'0050',market:'TWSE',security_type:'OTHER',classification_verified:true}]},
  payload:{stat:'OK',date,tables:[{fields:['證券代號','證券名稱','收盤價','漲跌(+/-)','漲跌價差'],data:[
   ['1111','甲','105.00','<p style="color:red">+</p>','5.00'],
   ['2222','乙','98','<p style="color:green">-</p>','2'],
   ['3333','丙','100',' ','0'],
   ['0050','ETF','100','+','10']]}]}
 };
}
test('TWSE common stocks only; ETF excluded and >=5% computed from previous close',()=>{
 const v=buildBreadth(fixture());
 assert.equal(v.eligible_count,3);assert.equal(v.advancers,1);assert.equal(v.decliners,1);
 assert.equal(v.unchanged,1);assert.equal(v.gainers_5pct_count,1);assert.equal(v.excluded_non_common_count,1);
});
test('refuse missing classification (including OTC contamination)',()=>{
 const f=fixture();f.master.securities.pop();
 assert.throws(()=>buildBreadth(f),/UNCLASSIFIED_TWSE_SECURITY/);
});
test('refuse old security master',()=>{
 const f=fixture();f.master.date='20261007';
 assert.throws(()=>buildBreadth(f),/SECURITY_MASTER_DATE_OR_MARKET_MISMATCH/);
});
test('refuse old market date',()=>{
 const f=fixture();f.payload.date='20261007';
 assert.throws(()=>buildBreadth(f),/TWSE_SOURCE_DATE_MISMATCH/);
});
test('refuse price sign mismatch',()=>{
 const f=fixture();f.payload.tables[0].data[0][3]='-';
 assert.throws(()=>buildBreadth(f),/PRICE_SIGN_MISMATCH/);
});
test('refuse duplicate security code',()=>{
 const f=fixture();f.payload.tables[0].data.push(f.payload.tables[0].data[0]);
 assert.throws(()=>buildBreadth(f),/DUPLICATE_TWSE_CODE/);
});

test('TWSE HTML price sign is parsed from its glyph, not CSS color',()=>{
 const f=fixture();
 f.payload.tables[0].data[0][3]='<p style="color:green">+</p>';
 assert.equal(buildBreadth(f).advancers,1);
});
test('rejects unrecognized price sign rather than silently guessing',()=>{
 const f=fixture();f.payload.tables[0].data[0][3]='unknown';
 assert.throws(()=>buildBreadth(f),/UNRECOGNIZED_PRICE_SIGN/);
});
test('exclude untraded ordinary shares from advancers and preserve denominator',()=>{
 const f=fixture();f.payload.tables[0].data[2][2]='--';f.payload.tables[0].data[2][4]='--';
 const result=buildBreadth(f);
 assert.equal(result.no_trade_count,1);assert.equal(result.eligible_count,3);assert.equal(result.unchanged,0);
});

test('rejects unverified historical classification even if each security claims verified',()=>{const f=fixture();f.master.source.digest_verified=false;assert.throws(()=>buildBreadth(f),/UNATTESTED_SECURITY_MASTER/);});
