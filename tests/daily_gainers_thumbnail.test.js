'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {label,svgArtwork,PROMPT}=require('../scripts/build_daily_gainers_thumbnail');

test('thumbnail uses real date and stock count',()=>{
 assert.deepEqual(label('20261007',36),{date:'10/07',count:'36'});
 const svg=svgArtwork('20261007',36);
 assert.match(svg, /width="1280" height="720"/);
 assert.match(svg, /10\/07/);
 assert.match(svg, />36<\/tspan>檔盤點/);
 assert.match(svg, /5%強勢股/);
 assert.match(svg, /TAIWANSTOCK/);
});
test('invalid data rejected instead of inventing claims',()=>{
 assert.throws(()=>label('2026107',36),/Invalid date/);
 assert.throws(()=>label('20261007',NaN),/Invalid stock count/);
});
test('creative prompt is retained for future AI image generator',()=>{
 assert.match(PROMPT,/16:9/);
 assert.match(PROMPT,/same recurring male VTuber/i);
 assert.match(PROMPT,/No fictional performance percentages/);
});
