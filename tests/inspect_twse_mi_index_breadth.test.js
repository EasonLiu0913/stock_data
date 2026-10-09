'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {inspect}=require('../scripts/inspect_twse_mi_index_breadth');
const data={stat:'OK',date:'20261008',tables:[{title:'每日收盤行情',fields:['證券代號','收盤價','漲跌(+/-)','漲跌價差'],data:[['2330','100','+','1']]}]};
test('compact MI_INDEX profile identifies the stock table without classifying types',()=>{
 const p=inspect(data,'20261008');
 assert.equal(p.stock_candidates[0].rows,1);
 assert.equal(p.table_profiles[0].sample[0].code,'2330');
 assert.match(p.note,/INSPECTION_ONLY/);
});
test('stale trading day is rejected',()=>assert.throws(()=>inspect(data,'20261007'),/INVALID_OR_STALE_MI_INDEX/));
test('missing data tables is rejected',()=>assert.throws(()=>inspect({stat:'OK',date:'20261008'},'20261008'),/INVALID_OR_STALE_MI_INDEX/));
