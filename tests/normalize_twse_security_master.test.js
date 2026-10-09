'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {normalizeArchive}=require('../scripts/normalize_twse_security_master');
const sample=()=>({source:{publisher:'TWSE',reference:'https://isin.twse.com.tw/isin/C_public.jsp?strMode=2',snapshot_date:'20261008',archive_sha256:'a'.repeat(64)},
 securities:[{code:'2330',market:'TWSE',security_type:'COMMON_STOCK',listing_date:'19940905'},{code:'0050',market:'TWSE',security_type:'OTHER',listing_date:'20030630'}]});
test('normalize verified-date manifest with explicit security type',()=>{
 const r=normalizeArchive(sample(),'20261008');
 assert.equal(r.securities.length,2);assert.equal(r.securities[0].security_type,'COMMON_STOCK');
});
test('reject source date mismatch',()=>{const x=sample();x.source.snapshot_date='20261009';assert.throws(()=>normalizeArchive(x,'20261008'),/UNPROVEN_DATE_SPECIFIC_TWSE_ARCHIVE/);});
test('reject OTC',()=>{const x=sample();x.securities[0].market='TPEX';assert.throws(()=>normalizeArchive(x,'20261008'),/INVALID_SECURITY_ROW/);});
test('reject missing instrument type',()=>{const x=sample();delete x.securities[0].security_type;assert.throws(()=>normalizeArchive(x,'20261008'),/INVALID_SECURITY_ROW/);});
test('reject duplicate',()=>{const x=sample();x.securities.push(x.securities[0]);assert.throws(()=>normalizeArchive(x,'20261008'),/INVALID_SECURITY_ROW/);});
test('reject future listings',()=>{const x=sample();x.securities[0].listing_date='20261009';assert.throws(()=>normalizeArchive(x,'20261008'),/INVALID_LISTING_WINDOW/);});
