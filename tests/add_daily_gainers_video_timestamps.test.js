'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const {timestamp,buildStockIndex,appendStockIndex} = require('../scripts/add_daily_gainers_video_timestamps');

test('timestamps follow actual narrated audio durations and scene padding',()=>{
  const scenes=[{title:'開場'},{title:'華新科（2492）'},{title:'台塑（1301）'},{title:'風險'}];
  const items=buildStockIndex(scenes,[60.85,52.85,39.85,28]);
  assert.deepEqual(items,['華新科(2492) 1:01','台塑(1301) 1:54']);
});
test('format hours, ignore non-stock sections, and reject missing audio',()=>{
  assert.equal(timestamp(3662.9),'1:01:02');
  assert.deepEqual(buildStockIndex([{title:'法人與風險'}],[5]),[]);
  assert.throws(()=>buildStockIndex([{title:'華新科（2492）'}],[0]),/Invalid duration/);
});
test('preserve description and prevent duplicate stock index on retry',()=>{
  const lines=['華新科(2492) 1:01','台塑(1301) 1:54'];
  const once=appendStockIndex('股市研究內容\n不構成投資建議。',lines);
  assert.equal(appendStockIndex(once,lines),once);
  assert.match(once,/不構成投資建議/);
  assert.match(once,/華新科\(2492\) 1:01/);
});
