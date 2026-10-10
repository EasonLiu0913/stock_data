'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {build}=require('../scripts/build_daily_gainers_m3_regime_assertions');
const {compile,verify}=require('../scripts/build_daily_gainers_m3_bound_claims');
test('bind real claims',()=>{const l=build(),c=compile(l);assert.equal(verify(l,c).checked,5);assert.equal(c[0].publication_authorized,false);});
test('changed text and sources rejected',()=>{const l=build(),c=compile(l);c[1].text='invented';assert.throws(()=>verify(l,c),/MISMATCH/);});
test('wrong source units rejected',()=>{const l=build();l.evidence.find(x=>x.id==='sector').unit='shares';assert.throws(()=>compile(l),/WRONG_UNIT/);});
