#!/usr/bin/env node
'use strict';
// Read-only validation: news sources must survive Agent -> spoken stock chapters.
// The deterministic official market opening is intentionally out of scope.
const fs=require('node:fs');
function verify(script,news,ai){
 if(!script||!news||!ai||script.target_date!==news.target_date||script.target_date!==ai.target_date)throw Error('news/script/analysis date mismatch');
 if(script.editorial_quality?.version!=='news-to-narration-v1')throw Error('Agent news narration contract absent');
 const chapters=script.scenes.filter(s=>s.scene_type==='stock_list');
 const codes=chapters.flatMap(s=>s.stock_codes.map(String));
 if(codes.length!==new Set(codes).size||codes.length!==news.stock_count||codes.length!==ai.stock_count)throw Error('stock coverage mismatch');
 const all=new Map(news.analyses.map(x=>[String(x.code),x]));
 const aiByCode=new Map(ai.analyses.map(x=>[String(x.code),x]));
 const report=[];
 for(const chapter of chapters){
  const text=chapter.narration;
  if(!text||text.length<75)throw Error('stock chapter too short');
  if(/缺少直接催化證據。|投信若無個股紀錄，不能當成買賣超零張；分點樣本也不等於全市場買賣超。/.test(text))throw Error('repetitive stock boilerplate');
  const attrs=chapter.news_attributions||[];
  for(const entry of attrs){
   if(!chapter.stock_codes.map(String).includes(String(entry.code)))throw Error('news attribution outside scene: '+entry.code);
   const row=all.get(String(entry.code));if(!row)throw Error('missing official researched stock news: '+entry.code);
   if(!row.sources?.some(s=>s.url===entry.url&&s.published_at===entry.published_at))throw Error('news source/time not grounded: '+entry.code);
   if(!entry.source||!entry.spoken_anchor||!text.includes(entry.source)||!text.includes(entry.spoken_anchor))throw Error('news source or key event not spoken: '+entry.code);
   if(Date.parse(entry.published_at)>Date.parse(script.target_date.slice(0,4)+'-'+script.target_date.slice(4,6)+'-'+script.target_date.slice(6,8)+'T13:30:00+08:00')&&
      !/收盤後|晚於當日收盤|已經過了收盤/.test(text))throw Error('after-close news must not imply intraday catalyst: '+entry.code);
   report.push({code:String(entry.code),source:entry.source,published_at:entry.published_at,url:entry.url});
  }
 }
 for(const code of codes){
  const row=all.get(code),analysis=aiByCode.get(code);
  if(!row||!analysis)throw Error('missing news/AI stock: '+code);
  if(row.sources?.length && !report.some(x=>x.code===code))throw Error('researched source omitted from spoken narration: '+code);
  if(analysis.evidence_strength==='none'&&row.sources?.length===0){
   const chapter=chapters.find(s=>s.stock_codes.map(String).includes(code));
   if(!chapter?.narration)throw Error('unverified stock omitted: '+code);
  }
 }
 if(report.length===0)throw Error('no source-to-voice proof');
 return {target_date:script.target_date,status:'PASS',covered_stock_count:codes.length,attributed_stock_count:new Set(report.map(x=>x.code)).size,attributions:report};
}
if(require.main===module){
 const date=process.argv[2];if(!/^20\d{6}$/.test(date||''))throw Error('expected YYYYMMDD');
 const load=p=>JSON.parse(fs.readFileSync(p,'utf8'));
 console.log(JSON.stringify(verify(load('video_scripts/daily-gainers/'+date+'.json'),load('data_daily_gain_over_5/analysis-news/'+date+'.json'),load('data_daily_gain_over_5/analysis-ai/'+date+'.json')),null,2));
}
module.exports={verify};
