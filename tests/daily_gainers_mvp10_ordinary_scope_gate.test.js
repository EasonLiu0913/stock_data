'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {assertNoDepositaryReceipts}=require('../scripts/daily_gainers_mvp10_ordinary_scope_gate');
test('actual 20261008 DR does not pass ordinary TWSE candidate gate',()=>{
 const raw={stocks:[{code:'9103',name:'美德醫療-DR'},{code:'2330',name:'台積電'}]};
 const script={scenes:[{stock_codes:['9103','2330']}]};
 assert.throws(()=>assertNoDepositaryReceipts(raw,script),/9103 美德醫療-DR.*referenced_scene_numbers=1/);
});
test('cannot silently suppress DR even if script omits it',()=>{
 assert.throws(()=>assertNoDepositaryReceipts({stocks:[{code:'9103',name:'美德醫療-DR'}]},{scenes:[]}),/regenerate date-aligned/);
});
test('do not guess -KY or -創 as DR; leave remaining classification to evidence',()=>{
 assert.deepEqual(assertNoDepositaryReceipts({stocks:[{code:'6672',name:'騰輝電子-KY'},{code:'6645',name:'金萬林-創'}]},{}),{checked:2,excluded_depositary_receipts:0});
});
test('reject absent actual stock universe',()=>assert.throws(()=>assertNoDepositaryReceipts({},{scenes:[]}),/Missing source/));
