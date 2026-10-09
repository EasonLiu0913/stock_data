'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {summarize,ENDPOINT,LIMIT}=require('../scripts/research_twse_lt185_bounded_get');
test('source-grounded bounded endpoint',()=>{assert.equal(ENDPOINT,'https://www.twse.com.tw/rwd/zh/announcement/LT185');assert.equal(LIMIT,1048576)});
test('total and pagination not silently certified on one response',()=>{const a=summarize({stat:'OK',total:500,data:[[1],[2]],fields:['日期']});assert.equal(a.total,500);assert.equal(a.rows,2);assert.equal(a.all_pages_reconciled,false);assert.equal(a.effective_date_completeness,false)});
test('empty result is not proof of absence of events',()=>{const a=summarize({stat:'OK',data:[]});assert.equal(a.rows,0);assert.equal(a.raw_result_complete,false);assert.equal(a.effective_date_completeness,false)});
