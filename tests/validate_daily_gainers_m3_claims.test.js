'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {validate}=require('../scripts/validate_daily_gainers_m3_claims');
const {build}=require('../scripts/build_daily_gainers_m3_regime_assertions');
const ok=text=>({text,evidence_ids:['index','breadth'],publication_authorized:false});
test('accept bounded evidence-linked observation',()=>assert.equal(validate(build(),[ok('加權指數收低，官方廣度下跌家數較多')]).checked,1));
test('reject imagined counterparty, industry flows, regime certainty and whole-universe claim',()=>{
 for(const t of ['外資賣給散戶','產業法人買超','全面走空','當日下跌證明趨勢反轉','35檔就是全部普通股'])assert.throws(()=>validate(build(),[ok(t)]));
});
test('reject missing citation, unknown citation and premature publication',()=>{
 assert.throws(()=>validate(build(),[{...ok('收低'),evidence_ids:[]}]));
 assert.throws(()=>validate(build(),[{...ok('收低'),evidence_ids:['unavailable']}]));
 assert.throws(()=>validate(build(),[{...ok('收低'),publication_authorized:true}]));
});
