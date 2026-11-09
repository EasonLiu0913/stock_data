'use strict';
const test=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const path=require('node:path');
const {verifyFiveDayTurnover}=require('../scripts/verify_daily_gainers_m2_five_day_turnover');
const chart=JSON.parse(fs.readFileSync(path.join(__dirname,'../data_twse_market_chart/market_chart.json'),'utf8'));
const cp=JSON.parse(fs.readFileSync(path.join(__dirname,'../data_research/twse-market-opening/20261008-m2-official-institution-industry-source-checkpoint.json'),'utf8'));
const clone=o=>JSON.parse(JSON.stringify(o));
// This archived checkpoint is for 2026-10-08; the shared chart advances over time.
const archivedChart=clone(chart); archivedChart.endDate=cp.date;
test('archived chart exactly matches all five days and average',()=>{const r=verifyFiveDayTurnover(archivedChart,cp);assert.deepEqual(r.dates,['20261001','20261002','20261005','20261006','20261007']);assert.equal(r.mean_turnover_twd,1007158931238.4);assert.equal(r.publication_authorized,false);});
test('reject wrong target date',()=>{const x=clone(archivedChart);x.endDate='20261007';assert.throws(()=>verifyFiveDayTurnover(x,cp),/target date/);});
test('reject shares as money',()=>{const x=clone(archivedChart);x.units.turnover='shares';assert.throws(()=>verifyFiveDayTurnover(x,cp),/unit/);});
test('reject missing historical session',()=>{const x=clone(archivedChart);x.data=x.data.filter(r=>r.date!=='20261006');assert.throws(()=>verifyFiveDayTurnover(x,cp),/sequence/);});
test('reject changed source turnover',()=>{const x=clone(archivedChart);x.data.find(r=>r.date==='20261001').turnover+=1;assert.throws(()=>verifyFiveDayTurnover(x,cp),/average/);});
test('reject duplicated historical row',()=>{const x=clone(archivedChart);x.data.push({...x.data.find(r=>r.date==='20261006')});assert.throws(()=>verifyFiveDayTurnover(x,cp),/duplicate/);});
