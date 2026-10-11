'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {make}=require('../scripts/build_daily_gainers_20261008_private_editorial_review');
test('real dated archive yields seven private review scenes without publication',()=>{
 const p=make();assert.equal(p.scenes.length,7);assert.equal(p.archive_publication_scope_certified,false);assert.equal(p.publication_authorized,false);assert.equal(p.tts_authorized,false);assert.equal(p.video_authorized,false);assert.match(p.scenes[3].speech,/上漲家數四百二十五家，下跌則有五百四十家/);assert.match(p.scenes[3].speech,/四百九十二點九三點/);assert.doesNotMatch(p.scenes[4].speech,/不是普通股/);assert.match(p.scenes[5].speech,/淨額相當於當天整體市場成交金額約百分之九點九一/);assert.match(p.scenes[6].speech,/接下來觀察/);assert.ok(p.scenes.every(s=>s.speech===s.caption&&s.speech===s.display));
});
