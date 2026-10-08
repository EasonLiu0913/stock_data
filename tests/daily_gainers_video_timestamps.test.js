#!/usr/bin/env node
const assert = require('node:assert/strict');
const { buildStockIndex } = require('../scripts/add_daily_gainers_video_timestamps');
const raw = [{code:'9103',name:'南染'},{code:'6672',name:'騰輝電子-KY'}];
const scenes = [
  {title:'開場',stock_codes:[]},
  {title:'防疫概念',stock_codes:['9103']},
  {title:'高階材料',stock_codes:['6672']},
  {title:'結語',stock_codes:[]},
];
assert.deepEqual(buildStockIndex(scenes,[10,20,30,5],raw),['南染(9103) 0:10','騰輝電子-KY(6672) 0:30']);
assert.deepEqual(buildStockIndex([{title:'台塑（1301）'}],[10],[]),['台塑(1301) 0:00']);
assert.throws(()=>buildStockIndex([{title:'未知',stock_codes:['9999']}],[10],raw),/Unknown stock code/);
console.log('Daily 5% YouTube stock timestamp regression PASS');
