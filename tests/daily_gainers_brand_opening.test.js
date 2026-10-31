'use strict';
const assert = require('node:assert/strict');
const test = require('node:test');
const {OPENING_TEXT,OPENING_LINES,addOpening,assertOpening} = require('../scripts/daily_gainers_brand_opening');

const CURRENT_OPENING = [
  '大家好，歡迎來到 TAIWAN STOCK！',
  '追蹤資金，解讀行情。',
  '錢在哪，我們就在哪！',
  '那麼我們開始囉。'
];

test('frozen V4 opening has four exact lines',()=>{
  assert.deepEqual(OPENING_LINES, CURRENT_OPENING);
  assert.equal(OPENING_TEXT,CURRENT_OPENING.join(''));
});

test('inserts V4 exactly once without rewriting daily commentary',()=>{
  const source='今天大盤上漲，市場熱度增加。';
  const once=addOpening(source);
  assertOpening(once);
  assert.equal(once,OPENING_TEXT+'\n'+source);
  assert.equal(addOpening(once),once);
});

test('upgrades historical V3 three-line beginning to V4 once',()=>{
  const legacy=CURRENT_OPENING.slice(0,3).join('')+'今天分析。';
  const result=addOpening(legacy);
  assert.equal(result,OPENING_TEXT+'今天分析。');
  assert.equal(addOpening(result),result);
});

test('rejects obsolete CC reminder in narration',()=>{
  assert.throws(()=>addOpening('歡迎打開 CC 中文字幕觀賞。'),/Obsolete CC/);
  assert.throws(()=>assertOpening(OPENING_TEXT+'歡迎打開 CC 中文字幕觀賞。'),/Obsolete CC/);
});

test('rejects conflicting AI-rewritten opening',()=>{
  assert.throws(()=>addOpening('大家好，歡迎收看股市研究。'),/conflicts/);
  assert.throws(()=>addOpening('錢在哪，就衝在哪！'),/conflicts/);
  assert.throws(()=>addOpening('那麼我們現在開始囉。'),/conflicts/);
});

test('rejects missing, wrong or legacy-only V4 opening',()=>{
  assert.throws(()=>assertOpening('今天股市'),/exact immutable/);
  assert.throws(()=>assertOpening(CURRENT_OPENING.slice(0,3).join('')+'今天分析。'),/exact immutable/);
});
