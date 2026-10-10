'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {verifyMedia}=require('../scripts/inspect_daily_gainers_m5_private_media');
test('M5 absent media fails closed',()=>{
 assert.throws(()=>verifyMedia('/tmp/no-m5-private-proof'),/M5_MISSING_MEDIA/);
});
