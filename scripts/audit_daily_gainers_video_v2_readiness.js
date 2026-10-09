#!/usr/bin/env node
'use strict';
const fs=require('node:fs');
const path=require('node:path');
const num='零一二三四五六七八九十百千萬億兆兩';
const codeToSpoken=code=>[...String(code)].map(d=>'零一二三四五六七八九'[Number(d)]).join('');
function audit(raw,script) {
 if(raw.target_date!==script.target_date)throw new Error('Date mismatch');
 const names=new Map((raw.stocks||[]).map(x=>[String(x.code),String(x.name)]));
 const errors=[],warnings=[];
 const used=new Set();
 for(let i=0;i<script.scenes.length;i++){
   const scene=script.scenes[i],number=i+1;
   for(const code of scene.stock_codes||[]){
     const key=String(code);used.add(key);
     if(!names.has(key))errors.push({scene:number,code:key,reason:'code absent from date stock universe'});
     else {
       const name=names.get(key);
       const spoken=codeToSpoken(key);
       if(scene.narration.includes('代號'+spoken) || scene.narration.includes('代號'+key))
         warnings.push({scene:number,code:key,name,reason:'code-only speech; replace with verified name'});
       if(scene.title.includes('南染') && key==='9103')
         errors.push({scene:number,code:key,name,reason:'legacy headline 南染 inconsistent with verified 9103 identity'});
     }
   }
   const matches=scene.narration.match(new RegExp('['+num+']{2,}(?:點['+num+']+)?','g'))||[];
   if(matches.length) warnings.push({scene:number,reason:'requires tokenized numbers and dates',examples:[...new Set(matches)].slice(0,15),occurrences:matches.length});
   if(/\d/.test(scene.narration))warnings.push({scene:number,reason:'Arabic digits in freeform narration require typed token inspection'});
 }
 return {date:raw.target_date,scene_count:script.scenes.length,referenced_stock_count:used.size,errors,warnings,
   status:errors.length?'BLOCKED':warnings.length?'REVIEW_REQUIRED':'READY'};
}
if(require.main===module){
 const date=process.argv[2];
 if(!/^20\d{6}$/.test(date||''))throw Error('Usage: node scripts/audit_daily_gainers_video_v2_readiness.js YYYYMMDD');
 const root=process.cwd();
 const raw=JSON.parse(fs.readFileSync(path.join(root,'data_daily_gain_over_5',date+'.json')));
 const script=JSON.parse(fs.readFileSync(path.join(root,'video_scripts/daily-gainers',date+'.json')));
 const result=audit(raw,script);
 console.log(JSON.stringify(result,null,2));
 // This audit must never silently promote a legacy script.
 if(result.status!=='READY')process.exitCode=1;
}
module.exports={audit};
