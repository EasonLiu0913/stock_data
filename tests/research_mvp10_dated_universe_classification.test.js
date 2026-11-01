'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {classify,inspect,readCsv}=require('../scripts/research_mvp10_dated_universe_classification');
test('real frozen 20261008 categorization is explicitly research-only',()=>{
  const report=inspect(process.cwd(),'20261008');
  assert.equal(report.target_date,'20261008');
  assert.equal(report.stock_count,35);
  assert.deepEqual(report.category_counts,{Stock:32,InnovationBoard:2,TDR:1,ETF:0,UNRESOLVED:0});
  assert.deepEqual(report.excluded_known_noncommon,['9103']);
  assert.deepEqual(report.rows.filter(r=>r.category==='InnovationBoard').map(r=>r.code).sort(),['6645','7740']);
  assert.equal(report.source_snapshot_effective_on_target_date_verified,false);
  assert.equal(report.classification_certified,false);
  assert.equal(report.render_authorized,false);
  assert.equal(report.issues.length,0);
});
test('overlapping or missing classification is blocked',()=>{
  const raw={target_date:'20261008',stock_count:1,stocks:[{code:'2330',name:'台積電',change_pct:7}]};
  const maps={Stock:new Map([['2330','台積電']]),InnovationBoard:new Map([['2330','台積電']]),TDR:new Map(),ETF:new Map()};
  assert.equal(classify({raw,categoryMaps:maps}).decision,'BLOCKED_CONFLICT');
  maps.InnovationBoard.clear();maps.Stock.clear();
  assert.equal(classify({raw,categoryMaps:maps}).decision,'BLOCKED_CONFLICT');
});
test('mismatched name is a conflict, not silent exclusion',()=>{
  const raw={target_date:'20261008',stock_count:1,stocks:[{code:'2330',name:'別家公司'}]};
  const maps={Stock:new Map([['2330','台積電']]),InnovationBoard:new Map(),TDR:new Map(),ETF:new Map()};
  assert.match(JSON.stringify(classify({raw,categoryMaps:maps}).issues),/CATEGORY_NAME_CONFLICT/);
});
test('missing date, count, duplicates and malformed category input reject',()=>{
  assert.throws(()=>classify({raw:{target_date:'20261008',stock_count:9,stocks:[]},categoryMaps:{}}),/INVALID_DATED_SOURCE/);
  assert.throws(()=>classify({raw:{target_date:'20261008',stock_count:2,stocks:[{code:'2330'},{code:'2330'}]},categoryMaps:{}}),/DUPLICATE/);
  assert.throws(()=>readCsv(Buffer.from('wrong\n2330,台積電,半導體'),'Stock'),/CSV_HEADER/);
});
