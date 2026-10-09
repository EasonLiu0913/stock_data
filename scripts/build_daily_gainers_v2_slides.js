#!/usr/bin/env node
'use strict';
// Independent dry-run SVG rendering; uses verified plan.stock_labels, never legacy code-only bullets.
const fs=require('node:fs'),path=require('node:path');
const date=process.argv[2];
if(!/^20\d{6}$/.test(date||''))throw Error('Usage: node scripts/build_daily_gainers_v2_slides.js YYYYMMDD');
const folder=path.join('output/daily-gainers-video',date);
const plan=JSON.parse(fs.readFileSync(path.join(folder,'plan.json')));
if(plan.schema_version!==2 || plan.target_date!==date)throw Error('v2 plan required');
const escape=s=>String(s||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
const slides=path.join(folder,'slides');fs.mkdirSync(slides,{recursive:true});
for(const scene of plan.scenes){
 const labels=scene.stock_labels||[];
 const renderedLabels=labels.slice(0,8).map((label,index)=>'<text x="160" y="'+(370+index*65)+'" fill="#e2e8f0" font-size="41" font-family="Noto Sans CJK TC">'+escape(label)+'</text>').join('');
 const svg='<svg xmlns="http://www.w3.org/2000/svg" width="1920" height="1080">'+
 '<rect width="1920" height="1080" fill="#07111f"/>'+
 '<text x="130" y="150" fill="#f8fafc" font-size="65" font-family="Noto Sans CJK TC">'+escape(scene.title)+'</text>'+
 '<text x="130" y="238" fill="#b0cde5" font-size="36" font-family="Noto Sans CJK TC">'+escape(scene.subtitle)+'</text>'+
 renderedLabels+
 '<text x="130" y="975" fill="#94a3b8" font-size="26" font-family="Noto Sans CJK TC">TAIWANSTOCK ｜ v2 測試影片 ｜ 未上傳</text>'+
 '</svg>';
 fs.writeFileSync(path.join(slides,String(scene.id).padStart(2,'0')+'.svg'),svg);
}
console.log('PREVIEW_SLIDES_PASS '+plan.scenes.length);
