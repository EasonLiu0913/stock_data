'use strict';
const assert=require('node:assert/strict');
const {parse}=require('./research_market_opening_mi_index_breadth');
const fixture={date:'20261008',stat:'OK',type:'ALL',tables:[{title:'漲跌證券數合計',fields:['類型','整體市場','股票'],data:[['上漲(漲停)','5,285(78)','425(14)'],['下跌(跌停)','9,634(83)','540(2)'],['持平','1,031','109'],['未成交','17,406','3'],['無比價','3,343','5']]}]};
const clone=()=>JSON.parse(JSON.stringify(fixture));
const got=parse(fixture,'20261008');
assert.deepEqual([got.up,got.limit_up,got.down,got.limit_down,got.flat,got.untraded,got.no_comparison,got.denominator_including_untraded_and_no_comparison],[425,14,540,2,109,3,5,1082]);
assert.equal(got.ordinary_stock_identity_verified,false);
assert.equal(got.editorial_complete,false);
for(const mutation of [
 x=>x.date='20261009',x=>x.stat='ERROR',x=>x.type='STOCK',x=>x.tables=[],
 x=>x.tables.push(x.tables[0]),x=>x.tables[0].fields[2]='整體市場',
 x=>x.tables[0].data[0][2]='425(426)',x=>x.tables[0].data[1][2]='unknown',
 x=>x.tables[0].data[2][0]='其他',x=>x.tables[0].data.pop()
]){const x=clone();mutation(x);assert.throws(()=>parse(x,'20261008'));}
console.log('MI_INDEX_BREADTH_RESEARCH_TEST_PASS; editorial_complete=false');
