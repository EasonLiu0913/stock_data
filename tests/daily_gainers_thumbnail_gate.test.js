'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {spawnSync}=require('node:child_process');
const {svgArtwork,footerLabel}=require('../scripts/build_daily_gainers_thumbnail.js');

test('up/down/flat market direction uses verified visual colors and direction',()=>{
  const checks=[
    {regime:'up',marketChangePct:1.24,color:'#D91F32',arrow:'M10 564 L180 498'},
    {regime:'down',marketChangePct:-2.37,color:'#0CA74D',arrow:'M15 215 L164 255'},
    {regime:'flat',marketChangePct:0,color:'#447DA8',arrow:'M10 369 L170 340'}
  ];
  for(const v of checks){
    const s=svgArtwork('20261105',44,{...v,marketQuestion:'大盤震盪，資金去哪？'});
    assert.ok(s.includes(v.color),'missing intended TWSE-color stripe');
    assert.ok(s.includes(v.arrow),'missing intended arrow direction');
    assert.ok(s.includes('11/05')&&s.includes('44</tspan>檔盤點'));
    assert.ok(s.includes('大盤震盪，資金去哪？'));
  }
});

test('thumbnail brand and dynamic footer avoid unsupported decorative glyphs',()=>{
  const svg=svgArtwork('20261104',44,{regime:'down'});
  assert.match(svg,/TAIWAN STOCK/);
  assert.doesNotMatch(svg,/▥|📈/);
  const footer=footerLabel(['低流動性','法人分歧','催化待證']);
  assert.equal(footer,'低流動性　 •　 法人分歧　 •　 催化待證');
  assert.doesNotMatch(footer,/▥|📈/);
});

test('existing SVG-only mock renderer is backwards compatible',()=>{
  assert.ok(svgArtwork('20261106',28).includes('28</tspan>檔盤點'));
  assert.throws(()=>svgArtwork('20261106',28,{regime:'unknown'}));
});

test('pre-upload verification fails closed without actual image, QA and sources',()=>{
  const r=spawnSync(process.execPath,['scripts/verify_daily_gainers_thumbnail_before_upload.js','20991231'],{encoding:'utf8'});
  assert.notEqual(r.status,0);
  assert.match(r.stderr,/UPLOAD_BLOCKED_NO_THUMBNAIL/);
});

test('production thumbnail checks use real source files and refuse preliminary summaries',()=>{
  const src=fs.readFileSync('scripts/build_daily_gainers_thumbnail.js','utf8');
  assert.match(src,/summary\.v\.status!=='final'/);
  assert.match(src,/THUMBNAIL_INPUTS_BLOCKED/);
  assert.match(src,/verified_official_market_aggregate/);
  assert.match(src,/research_pending\/daily-gainers-seo/);
});

test('3px perimeter verification samples perpendicular to the edge',()=>{
  const src=fs.readFileSync('scripts/verify_daily_gainers_thumbnail_before_upload.js','utf8');
  assert.match(src,/crop=1:4:10:0,format=rgb24/);
  assert.doesNotMatch(src,/crop=4:1:0:0,format=rgb24/);
});
