'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {wrap,clock,build}=require('../scripts/research_date_to_video_dated_media_bridge_v1');
test('dated media bridge caption formatting preserves characters and 30-char limit',()=>{
 assert.equal(wrap('今天上漲，明天觀察。'),'今天上漲，明天觀察。');
 assert.equal(wrap('甲'.repeat(31)),'甲'.repeat(30)+'\n甲');
 assert.equal(wrap('甲'.repeat(30)+'，乙'),'甲'.repeat(30)+'\n，乙');
 assert.throws(()=>wrap('甲\n乙'),/INVALID_CAPTION/);
 assert.equal(clock(3661.234),'01:01:01,234');
});
test('dated media bridge rejects missing inventory, proof, and audio without granting authority',()=>{
 const result=build(null,null,null,'/nonexistent');
 assert.equal(result.status,'REJECTED');
 assert.equal(result.render_authorized,false);
 assert.equal(result.publication_authorized,false);
 assert.ok(result.issues.length>0);
});
