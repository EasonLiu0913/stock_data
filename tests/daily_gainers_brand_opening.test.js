'use strict';
const assert = require('node:assert/strict');
const test = require('node:test');
const {OPENING_TEXT,OPENING_LINES,addOpening,assertOpening} = require('../scripts/daily_gainers_brand_opening');
test('brand opening is immutable and has three exact lines',()=>{
 assert.deepEqual(OPENING_LINES, [
  '大家好，歡迎來到 TAIWAN STOCK！',
  '追蹤資金，解讀行情。',
  '錢在哪，我們就在哪！'
 ]);
 assert.equal(OPENING_TEXT, OPENING_LINES.join(''));
});
test('inserts exactly once and keeps whole original script',()=>{
 const source='今天大盤上漲，市場熱度增加。';
 const once=addOpening(source);
 assertOpening(once);
 assert.equal(once,OPENING_TEXT+'\n'+source);
 assert.equal(addOpening(once),once);
});
test('rejects conflicting AI-rewritten greetings',()=>{
 assert.throws(()=>addOpening('大家好，歡迎收看股市研究。'),/conflicts/);
 assert.throws(()=>addOpening('錢在哪，就衝在哪！'),/conflicts/);
});
test('rejects missing or incorrect opening',()=>{
 assert.throws(()=>assertOpening('今天股市'),/exact immutable/);
});
