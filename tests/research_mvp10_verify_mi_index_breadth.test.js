'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {extract}=require('../scripts/research_mvp10_verify_mi_index_breadth');
const root=path.join(__dirname,'..');
const source=JSON.parse(fs.readFileSync(path.join(root,'data_twse_mi_index/20261013_twse_mi_index.json'),'utf8'));
const audit=JSON.parse(fs.readFileSync(path.join(root,'data_research/m5/mvp10-20261013-research/market-opening-source-audit.json'),'utf8'));
const clone=x=>structuredClone(x);
test('real 20261013 MI_INDEX official stock, all-securities and index rows match immutable research audit',()=>{
 const x=extract(source,audit);
 assert.deepEqual(x.stock,{up:269,limit_up:13,down:730,limit_down:5,flat:78,no_trade:2,no_reference:4,total:1083});
 assert.deepEqual(x.whole_securities,{up:3142,limit_up:49,down:13037,limit_down:122,flat:535,no_trade:16810,no_reference:3625,total:37149});
 assert.equal(x.weighted_index.close,48341.31);
 assert.equal(x.turnover_twd,1201861264942);
 assert.equal(x.institutional_BFI82U_amounts_verified,false);
 assert.equal(x.publication_authorized,false);
});
test('reject source-date mismatch, tampered stock breadth, wrong all-securities count and missing counts',()=>{
 let v=clone(source);v.date='20261012';assert.throws(()=>extract(v,audit),/SOURCE_IDENTITY/);
 v=clone(source);v.tables.find(t=>t.title==='漲跌證券數合計').data[0][2]='270(13)';
 assert.throws(()=>extract(v,audit),/AUDIT_RECONCILIATION/);
 v=clone(source);v.tables.find(t=>t.title==='漲跌證券數合計').data[0][1]='3,143(49)';
 assert.throws(()=>extract(v,audit),/BREADTH_TOTAL/);
 v=clone(source);v.tables.find(t=>t.title==='漲跌證券數合計').data[2][2]='未取得';
 assert.throws(()=>extract(v,audit),/INVALID_BREADTH_CELL/);
});
test('reject substituting all-securities count for stock and misleading release or BFI82U approval',()=>{
 const a=clone(audit);a.breadth.stock_column=a.breadth.whole_securities_column;
 assert.throws(()=>extract(source,a),/AUDIT_RECONCILIATION/);
 const b=clone(audit);b.institutions.total_amount_twd=0;
 assert.throws(()=>extract(source,b),/AUDIT_RECONCILIATION/);
 const c=clone(audit);c.publication_authorized=true;
 assert.throws(()=>extract(source,c),/AUDIT_RECONCILIATION/);
});
