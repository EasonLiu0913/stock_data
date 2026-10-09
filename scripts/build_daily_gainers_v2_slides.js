#!/usr/bin/env node
'use strict';
// Presenter-safe slides: each slide is a concise visual summary of verified script facts.
const fs=require('node:fs'),path=require('node:path');
const date=process.argv[2];
if(!/^20\d{6}$/.test(date||''))throw Error('Usage: node scripts/build_daily_gainers_v2_slides.js YYYYMMDD');
const folder=path.join('output/daily-gainers-video',date);
const plan=JSON.parse(fs.readFileSync(path.join(folder,'plan.json')));
if(plan.schema_version!==2 || plan.target_date!==date)throw Error('v2 plan required');
const escape=s=>String(s||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
const slides=path.join(folder,'slides');fs.mkdirSync(slides,{recursive:true});
const manifest=[];
for(const scene of plan.scenes){
  const points=scene.visual_summary_points || scene.bullets || [];
  if(!Array.isArray(points) || points.length<2 || points.length>5)
    throw Error('Scene '+scene.id+': require 2-5 verified visual summary points');
  if(points.some(x=>typeof x!=='string' || !x.trim() || [...x].length>28))
    throw Error('Scene '+scene.id+': summary point must be nonempty and at most 28 characters');
  const pageType=scene.id===1?'overview':scene.id===plan.scenes.length?'checklist':
    scene.stock_codes?.length?'stock':'topic';
  const maxX=1180;
  const cardHeight=points.length>=5?94:points.length===4?112:138;
  const spacing=points.length>=5?12:18;
  const startY=292;
  const rows=points.map((item,i)=>{
    const y=startY+i*(cardHeight+spacing);
    const font=[...item].length>24?31:36;
    const number=pageType==='checklist'?String(i+1).padStart(2,'0'):String(i+1).padStart(2,'0');
    return '<rect x="130" y="'+y+'" width="'+maxX+'" height="'+cardHeight+'" rx="18" fill="#12263d" stroke="#29465e" stroke-width="2"/>'+
      '<rect x="150" y="'+(y+20)+'" width="55" height="'+(cardHeight-40)+'" rx="12" fill="#164e63"/>'+
      '<text x="177" y="'+(y+cardHeight/2+12)+'" font-size="29" text-anchor="middle" fill="#67e8f9" font-family="Noto Sans CJK TC">'+number+'</text>'+
      '<text x="230" y="'+(y+cardHeight/2+12)+'" fill="#e8f3fc" font-size="'+font+'" font-family="Noto Sans CJK TC">'+escape(item)+'</text>';
  }).join('');
  const svg='<svg xmlns="http://www.w3.org/2000/svg" width="1920" height="1080">'+
    '<rect width="1920" height="1080" fill="#07111f"/>'+
    '<text x="130" y="150" fill="#f8fafc" font-size="60" font-family="Noto Sans CJK TC">'+escape(scene.title)+'</text>'+
    '<text x="130" y="232" fill="#b0cde5" font-size="34" font-family="Noto Sans CJK TC">'+escape(scene.subtitle)+'</text>'+
    rows+
    '<text x="130" y="977" fill="#94a3b8" font-size="26" font-family="Noto Sans CJK TC">TAIWANSTOCK ｜ V2 簡報式影片 ｜ '+escape(date)+'</text>'+
    '</svg>';
  const filename=String(scene.id).padStart(2,'0')+'.svg';
  fs.writeFileSync(path.join(slides,filename),svg);
  manifest.push({id:scene.id,type:pageType,points:points.length,filename});
}
fs.writeFileSync(path.join(folder,'slide-manifest.json'),JSON.stringify({date,slides:manifest},null,2)+'\n');
console.log('PRESENTATION_SLIDES_PASS '+manifest.length);
