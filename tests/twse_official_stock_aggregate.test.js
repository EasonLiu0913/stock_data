'use strict';
const assert=require('node:assert/strict');
const {parse}=require('../scripts/parse_twse_official_stock_aggregate');
const base=()=>({date:'20261008',stat:'OK',tables:[{title:'漲跌證券數合計',fields:['類型','整體市場','股票'],data:[['上漲(漲停)','5,285(78)','425(14)'],['下跌(跌停)','9,634(83)','540(2)'],['持平','1,031','109'],['未成交','17,406','3'],['無比價','3,343','5']]}]});
const a=parse(base(),'20261008');
assert.deepEqual([a.advancers,a.limit_up_count,a.decliners,a.limit_down_count,a.unchanged,a.no_trade_count,a.no_comparison_count,a.eligible_count],[425,14,540,2,109,3,5,1082]);
assert.equal(a.scope,'TWSE_OFFICIAL_STOCK_COLUMN');assert.equal(a.legal_identity_master_certified,false);assert.equal(a.publication_authorized,false);
assert.throws(()=>parse(base(),'20261009'),/INVALID_OR_STALE/);
for(const mutate of [
 p=>p.tables[0].fields[2]='整體市場',
 p=>p.tables[0].data[0][2]='425',
 p=>p.tables[0].data[0][2]='425(426)',
 p=>p.tables[0].data[4][2]='--',
 p=>p.tables[0].data.push(['持平','0','0']),
 p=>p.tables.push(p.tables[0]),
 p=>p.stat='ERROR'
]){const p=base();mutate(p);assert.throws(()=>parse(p,'20261008'));}
console.log('PASS official dated stock aggregate, limits, five buckets and negative fixtures; identity remains uncertified');

// Run the independently authored AI-script contract fixtures in this existing CI-listed test entry point.
require('./ai_script_research_v3.test.js');

require('./ai_editor_input_v3.test.js');
