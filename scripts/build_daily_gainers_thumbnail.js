#!/usr/bin/env node
'use strict';
// Deterministic thumbnail rendering matching the approved creative direction.
// No external generative-image service is assumed in CI.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const {spawnSync} = require('node:child_process');

const PROMPT = `Create a premium 16:9 Taiwanese-stock-market YouTube thumbnail: bold, clickable yet credible financial editorial art. Dark electric-blue and crimson trading-screen background, bright red up-arrow, tasteful neon candlestick charts and Taipei 101 silhouette. Strong hierarchy and legible Traditional Chinese typography: TAIWANSTOCK upper left; {MM/DD} date large; 台股 5%強勢股 headline huge gold/red-white high-contrast lettering; {stock_count}檔盤點 prominent secondary headline; footer 主線題材・法人籌碼・風險重點. Right side features the SAME recurring male VTuber host, dark blazer, white shirt, energetic expression. No fictional performance percentages, no invented stocks or financial facts. Accurate Traditional Chinese. 16:9, 1280×720, uncluttered at mobile sizes.`;

function xml(s) {return String(s).replace(/[<>&"']/g,c=>({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;',"'":'&apos;'}[c]));}
function footerLabel(keywords) {return keywords.map(xml).join('　 •　 ');}
function run(cmd,args){const r=spawnSync(cmd,args,{encoding:'utf8'});if(r.status!==0) throw Error(cmd+' failed: '+r.stderr);}
function label(date,count){if(!/^20\d{6}$/.test(date))throw Error('Invalid date');if(!Number.isInteger(count)||count<0||count>9999)throw Error('Invalid stock count');return {date:date.slice(4,6)+'/'+date.slice(6,8),count:String(count)};}
function svgArtwork(date,count,options={}){
  const x=label(date,count);
  const regime=options.regime||'up';
  const palettes={up:{accent:'#D91F32',arrow:'#ED3149',word:'上漲'},down:{accent:'#0CA74D',arrow:'#19C96A',word:'下跌'},flat:{accent:'#447DA8',arrow:'#6CA2C3',word:'平盤'}};
  if(!palettes[regime])throw Error('Unknown index direction');
  const c=palettes[regime];
  const candles = Array.from({length:37},(_,i)=>{
    const cx=32+i*35, up=i%5!==0, high=380+(i*41%140)-i*5, low=high+95+(i*17%44);
    const y=high+16, h=Math.max(15,(low-high)*0.55);
    return '<line x1="'+cx+'" x2="'+cx+'" y1="'+high+'" y2="'+low+'" stroke="'+(up?'#18dcb8':'#fa4767')+'" stroke-width="3" opacity=".7"/><rect x="'+(cx-9)+'" y="'+y+'" width="18" height="'+h+'" rx="2" fill="'+(up?'#18dcb8':'#fa4767')+'" opacity=".75"/>';
  }).join('');
  let artwork=`<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="720" viewBox="0 0 1280 720">
  <defs>
    <linearGradient id="bg" x2="1" y2="1"><stop stop-color="#031b3e"/><stop offset=".58" stop-color="#080d28"/><stop offset="1" stop-color="#451022"/></linearGradient>
    <linearGradient id="gold" x2="0" y2="1"><stop stop-color="#fff2a0"/><stop offset=".54" stop-color="#ffc82f"/><stop offset="1" stop-color="#ea830a"/></linearGradient>
    <linearGradient id="red" x2="0" y2="1"><stop stop-color="#ff8582"/><stop offset=".5" stop-color="#f22132"/><stop offset="1" stop-color="#b11220"/></linearGradient>
    <filter id="shadow"><feGaussianBlur in="SourceAlpha" stdDeviation="5"/><feOffset dx="6" dy="7"/><feComponentTransfer><feFuncA type="linear" slope=".8"/></feComponentTransfer><feMerge><feMergeNode/><feMergeNode in="SourceGraphic"/></feMerge></filter>
  </defs>
  <rect width="1280" height="720" fill="url(#bg)"/>
  <g opacity=".22">${candles}</g>
  <g fill="#06b6d4" opacity=".18"><rect x="36" y="190" width="50" height="340"/><rect x="92" y="130" width="55" height="400"/><rect x="154" y="250" width="40" height="280"/><rect x="202" y="170" width="40" height="360"/><path d="M105 132 L122 40 L139 132Z"/></g>
  <path d="M10 564 L180 498 L298 535 L453 330 L588 368 L771 124" fill="none" stroke="#f23449" stroke-width="14" opacity=".76"/>
  <path d="M730 135 L787 80 L784 166Z" fill="#f23449"/>
  <rect x="0" y="0" width="1280" height="72" fill="#04172f" opacity=".85"/>
  <text x="39" y="48" font-family="Noto Sans CJK TC,sans-serif" font-size="35" font-weight="900" fill="#e3f8ff">TAIWAN STOCK</text>
  <path d="M42 91 L520 91 L491 198 L26 198Z" fill="#bc121f"/>
  <text x="66" y="177" font-family="Noto Sans CJK TC,sans-serif" font-size="112" font-weight="900" fill="#fff" filter="url(#shadow)">${xml(x.date)}</text>
  <text x="36" y="315" font-family="Noto Sans CJK TC,sans-serif" font-size="96" font-weight="900" fill="url(#gold)" stroke="#3a1306" stroke-width="7" paint-order="stroke" filter="url(#shadow)">台股</text>
  <text x="40" y="450" font-family="Noto Sans CJK TC,sans-serif" font-size="101" font-weight="900" fill="url(#gold)" stroke="#60170d" stroke-width="8" paint-order="stroke" filter="url(#shadow)">5%強勢股</text>
  <path d="M35 481 L694 480 L657 596 L29 603Z" fill="#ae1722"/>
  <text x="62" y="571" font-family="Noto Sans CJK TC,sans-serif" font-size="73" font-weight="900" fill="#fff" filter="url(#shadow)"><tspan fill="#ffe762">${xml(x.count)}</tspan>檔盤點</text>
  <rect x="18" y="632" width="1244" height="76" rx="8" fill="#04182e" stroke="#16a8df" stroke-width="3" opacity=".96"/>
  <text x="43" y="683" font-family="Noto Sans CJK TC,sans-serif" font-weight="800" font-size="35" fill="#f6faff">主線題材　 •　 法人籌碼　 •　 風險重點</text>
  </svg>`;
  artwork=artwork.replace('fill="#bc121f"','fill="'+c.accent+'"').replace('fill="#ae1722"','fill="'+c.accent+'"').replaceAll('#f23449',c.arrow);
  if(regime==='down'){
    artwork=artwork.replace('M10 564 L180 498 L298 535 L453 330 L588 368 L771 124','M15 215 L164 255 L288 225 L416 350 L570 328 L754 491').replace('M730 135 L787 80 L784 166Z','M700 489 L779 549 L765 461Z');
  }else if(regime==='flat'){
    artwork=artwork.replace('M10 564 L180 498 L298 535 L453 330 L588 368 L771 124','M10 369 L170 340 L302 394 L452 350 L592 387 L762 370').replace('M730 135 L787 80 L784 166Z','M732 335 L800 370 L733 408Z');
  }
  if(options.marketQuestion){
    const badge='<rect x="520" y="104" width="355" height="78" rx="13" fill="#06172c" stroke="'+c.accent+'" stroke-width="3"/>'+
      '<text x="535" y="154" fill="white" font-family="Noto Sans CJK TC,sans-serif" font-size="28" font-weight="900">'+xml(options.marketQuestion)+'</text>';
    artwork=artwork.replace('</svg>',badge+'</svg>');
  }
  // Backward-compatible SVG-only reference rendering for the approved mock preview.
  if(options.marketChangePct===undefined)return artwork;
  const pct=options.marketChangePct;
  const textValue=pct>0?'+'+pct.toFixed(2)+'%':pct.toFixed(2)+'%';
  const badge='<rect x="632" y="215" width="220" height="100" rx="13" fill="#06172c" stroke="'+c.accent+'" stroke-width="4"/>'+
    '<text x="648" y="248" fill="white" font-family="Noto Sans CJK TC,sans-serif" font-size="26" font-weight="900">加權 '+c.word+'</text>'+
    '<text x="648" y="293" fill="'+c.arrow+'" font-family="Noto Sans CJK TC,sans-serif" font-size="42" font-weight="900">'+xml(textValue)+'</text>';
  return artwork.replace('</svg>',badge+'</svg>');
}
function loadVerifiedInputs(root,date,raw){
  const base=path.join(root,'data_daily_gain_over_5');
  function read(rel){const p=path.join(root,rel);if(!fs.existsSync(p))throw Error('THUMBNAIL_INPUTS_BLOCKED missing '+rel);const v=JSON.parse(fs.readFileSync(p,'utf8'));if(v.target_date!==date)throw Error('THUMBNAIL_INPUTS_BLOCKED wrong date in '+rel);return {p,v};}
  const facts=read('data_daily_gain_over_5/analysis-facts/'+date+'.json');
  const news=read('data_daily_gain_over_5/analysis-news/'+date+'.json');
  const summary=read('data_daily_gain_over_5/market-summary/'+date+'.json');
  const opening=read('data_daily_gain_over_5/market-opening-video/'+date+'.json');
  const seo=read('research_pending/daily-gainers-seo/'+date+'.json');
  if(summary.v.status!=='final'||summary.v.coverage?.overall!=='complete')throw Error('THUMBNAIL_INPUTS_BLOCKED market summary is not final/complete');
  if(opening.v.status!=='verified_official_market_aggregate'||opening.v.market!=='TWSE'||opening.v.index?.source_date!==date)throw Error('THUMBNAIL_INPUTS_BLOCKED official market opening is unverified');
  for(const item of [facts,news])if(item.v.stock_count!==raw.stock_count)throw Error('THUMBNAIL_INPUTS_BLOCKED stock count inconsistency');
  const index=opening.v.index, t=seo.v.thumbnail;
  if(!t||t.template_version!=='v1'||!['up','down','flat'].includes(t.market_regime))throw Error('THUMBNAIL_INPUTS_BLOCKED missing verified v1 thumbnail metadata');
  const regime=index.change_points>0?'up':index.change_points<0?'down':'flat';
  if(t.market_regime!==regime||!Number.isFinite(index.change_pct)||Math.abs(t.market_change_pct-index.change_pct)>0.015)throw Error('THUMBNAIL_INPUTS_BLOCKED index direction/value mismatch');
  if(t.stock_count!==raw.stock_count||seo.v.stock_count!==raw.stock_count)throw Error('THUMBNAIL_INPUTS_BLOCKED stock_count mismatch');
  if(typeof t.market_question!=='string'||t.market_question.length<4||t.market_question.length>11||/[<>\r\n]/.test(t.market_question))throw Error('THUMBNAIL_INPUTS_BLOCKED invalid market question');
  if(!Array.isArray(t.bottom_keywords)||t.bottom_keywords.length!==3||t.bottom_keywords.some(x=>typeof x!=='string'||x.length<2||x.length>12))throw Error('THUMBNAIL_INPUTS_BLOCKED invalid footer keywords');
  if(/DEMO|模擬測試|mock/i.test(JSON.stringify(t)))throw Error('THUMBNAIL_INPUTS_BLOCKED mock content forbidden');
  if(seo.v.source_blobs){const expected={raw:'data_daily_gain_over_5/'+date+'.json',facts:'data_daily_gain_over_5/analysis-facts/'+date+'.json',news:'data_daily_gain_over_5/analysis-news/'+date+'.json'};
    for(const [key,rel] of Object.entries(expected)){const hash=spawnSync('git',['hash-object',rel],{encoding:'utf8'});if(hash.status!==0||hash.stdout.trim()!==seo.v.source_blobs[key])throw Error('THUMBNAIL_INPUTS_BLOCKED changed SEO source SHA '+key);}
  }
  return {regime,marketChangePct:index.change_pct,marketQuestion:t.market_question,bottomKeywords:t.bottom_keywords,source_date:date,source_files:[facts.p,news.p,summary.p,opening.p,seo.p]};
}
function main(date){
  const root=process.cwd(), folder=path.join(root,'output','daily-gainers-video',date);
  const raw=JSON.parse(fs.readFileSync(path.join(root,'data_daily_gain_over_5',date+'.json'),'utf8'));
  const stockCount=Number(raw.stock_count);label(date,stockCount);
  if(raw.target_date!==date)throw Error('THUMBNAIL_INPUTS_BLOCKED raw wrong date');
  const verified=loadVerifiedInputs(root,date,raw);
  const sprite=path.join(root,'assets','daily-gainers-vtuber-sprite.webp');
  if(!fs.existsSync(sprite))throw Error('Missing HD VTuber sprite: '+sprite);
  fs.mkdirSync(folder,{recursive:true});
  const art=path.join(folder,'thumbnail-background.svg');
  const base=path.join(folder,'thumbnail-background.png');
  const avatar=path.join(folder,'thumbnail-avatar.png');
  const output=path.join(folder,'thumbnail.jpg');
  let svg=svgArtwork(date,stockCount,verified);
  const footer=footerLabel(verified.bottomKeywords);
  svg=svg.replace('主線題材　 •　 法人籌碼　 •　 風險重點',footer);
  fs.writeFileSync(art,svg);
  fs.writeFileSync(path.join(folder,'thumbnail-prompt.txt'),PROMPT.replace('{MM/DD}',date.slice(4,6)+'/'+date.slice(6,8)).replace('{stock_count}',String(stockCount))+'\n');
  run('rsvg-convert',['-w','1280','-h','720','-o',base,art]);
  // The first quarter is the closed-mouth pose; never upscale this HD source.
  run('ffmpeg',['-y','-loglevel','error','-i',sprite,'-vf','crop=iw/4:ih:0:0,scale=480:-1:flags=lanczos','-frames:v','1',avatar]);
  // Overlay cropped presenter, partly concealed by the bottom label bar.
  const png=path.join(folder,'thumbnail.png');
  const border=verified.regime==='up'?'D91F32':verified.regime==='down'?'0CA74D':'447DA8';
  run('ffmpeg',['-y','-loglevel','error','-i',base,'-i',avatar,'-filter_complex','[0:v][1:v]overlay=805:23:format=auto,drawbox=x=0:y=0:w=iw:h=ih:color=0x'+border+':t=3,format=rgb24','-frames:v','1','-update','1',png]);
  run('ffmpeg',['-y','-loglevel','error','-i',png,'-frames:v','1','-q:v','4','-update','1',output]);
  const size=fs.statSync(output).size;
  if(size<15000||size>2*1024*1024)throw Error('YouTube thumbnail outside safe size limits: '+size);
  const probe=spawnSync('ffprobe',['-v','error','-select_streams','v:0','-show_entries','stream=width,height','-of','csv=p=0',output],{encoding:'utf8'});
  if(probe.status!==0||probe.stdout.trim()!=='1280,720')throw Error('Wrong thumbnail resolution: '+probe.stdout);
  const sha=crypto.createHash('sha256').update(fs.readFileSync(output)).digest('hex');
  const sourceFiles=['data_daily_gain_over_5/'+date+'.json',...verified.source_files.map(f=>path.relative(root,f))];
  const sourceSha256=Object.fromEntries(sourceFiles.map(rel=>[rel,crypto.createHash('sha256').update(fs.readFileSync(path.join(root,rel))).digest('hex')]));
  fs.writeFileSync(path.join(folder,'thumbnail-qa.json'),JSON.stringify({status:'PASS',date,stock_count:stockCount,market_regime:verified.regime,market_change_pct:verified.marketChangePct,template_version:'v1',frame_px:3,jpeg_sha256:sha,source_files:sourceFiles,source_sha256:sourceSha256,mock:false},null,2)+'\n');
  console.log(JSON.stringify({file:output,bytes:size,resolution:'1280x720',stock_count:stockCount,thumbnail_qa:'PASS'}));
}
if(require.main===module)main(process.argv[2]);
module.exports={label,svgArtwork,footerLabel,PROMPT};
