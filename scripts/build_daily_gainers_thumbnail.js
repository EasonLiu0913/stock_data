#!/usr/bin/env node
'use strict';
// Deterministic thumbnail rendering matching the approved creative direction.
// No external generative-image service is assumed in CI.
const fs = require('node:fs');
const path = require('node:path');
const {spawnSync} = require('node:child_process');

const PROMPT = `Create a premium 16:9 Taiwanese-stock-market YouTube thumbnail: bold, clickable yet credible financial editorial art. Dark electric-blue and crimson trading-screen background, bright red up-arrow, tasteful neon candlestick charts and Taipei 101 silhouette. Strong hierarchy and legible Traditional Chinese typography: TAIWANSTOCK upper left; {MM/DD} date large; 台股 5%強勢股 headline huge gold/red-white high-contrast lettering; {stock_count}檔盤點 prominent secondary headline; footer 主線題材・法人籌碼・風險重點. Right side features the SAME recurring male VTuber host, dark blazer, white shirt, energetic expression. No fictional performance percentages, no invented stocks or financial facts. Accurate Traditional Chinese. 16:9, 1280×720, uncluttered at mobile sizes.`;

function xml(s) {return String(s).replace(/[<>&"']/g,c=>({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;',"'":'&apos;'}[c]));}
function run(cmd,args){const r=spawnSync(cmd,args,{encoding:'utf8'});if(r.status!==0) throw Error(cmd+' failed: '+r.stderr);}
function label(date,count){if(!/^20\d{6}$/.test(date))throw Error('Invalid date');if(!Number.isInteger(count)||count<0||count>9999)throw Error('Invalid stock count');return {date:date.slice(4,6)+'/'+date.slice(6,8),count:String(count)};}
function svgArtwork(date,count){
  const x=label(date,count);
  const candles = Array.from({length:37},(_,i)=>{
    const cx=32+i*35, up=i%5!==0, high=380+(i*41%140)-i*5, low=high+95+(i*17%44);
    const y=high+16, h=Math.max(15,(low-high)*0.55);
    return '<line x1="'+cx+'" x2="'+cx+'" y1="'+high+'" y2="'+low+'" stroke="'+(up?'#18dcb8':'#fa4767')+'" stroke-width="3" opacity=".7"/><rect x="'+(cx-9)+'" y="'+y+'" width="18" height="'+h+'" rx="2" fill="'+(up?'#18dcb8':'#fa4767')+'" opacity=".75"/>';
  }).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="720" viewBox="0 0 1280 720">
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
  <text x="39" y="48" font-family="Noto Sans CJK TC,sans-serif" font-size="35" font-weight="900" fill="#e3f8ff">▥ TAIWANSTOCK</text>
  <path d="M42 91 L520 91 L491 198 L26 198Z" fill="#bc121f"/>
  <text x="66" y="177" font-family="Noto Sans CJK TC,sans-serif" font-size="112" font-weight="900" fill="#fff" filter="url(#shadow)">${xml(x.date)}</text>
  <text x="36" y="315" font-family="Noto Sans CJK TC,sans-serif" font-size="96" font-weight="900" fill="url(#gold)" stroke="#3a1306" stroke-width="7" paint-order="stroke" filter="url(#shadow)">台股</text>
  <text x="40" y="450" font-family="Noto Sans CJK TC,sans-serif" font-size="101" font-weight="900" fill="url(#gold)" stroke="#60170d" stroke-width="8" paint-order="stroke" filter="url(#shadow)">5%強勢股</text>
  <path d="M35 481 L694 480 L657 596 L29 603Z" fill="#ae1722"/>
  <text x="62" y="571" font-family="Noto Sans CJK TC,sans-serif" font-size="73" font-weight="900" fill="#fff" filter="url(#shadow)"><tspan fill="#ffe762">${xml(x.count)}</tspan>檔盤點</text>
  <rect x="18" y="632" width="1244" height="76" rx="8" fill="#04182e" stroke="#16a8df" stroke-width="3" opacity=".96"/>
  <text x="43" y="683" font-family="Noto Sans CJK TC,sans-serif" font-weight="800" font-size="35" fill="#f6faff">📈 主線題材　 •　 法人籌碼　 •　 風險重點</text>
  </svg>`;
}
function main(date){
  const root=process.cwd(), folder=path.join(root,'output','daily-gainers-video',date);
  const raw=JSON.parse(fs.readFileSync(path.join(root,'data_daily_gain_over_5',date+'.json'),'utf8'));
  const stockCount=Number(raw.stock_count);label(date,stockCount);
  const sprite=path.join(root,'assets','daily-gainers-vtuber-sprite.webp');
  if(!fs.existsSync(sprite))throw Error('Missing HD VTuber sprite: '+sprite);
  fs.mkdirSync(folder,{recursive:true});
  const art=path.join(folder,'thumbnail-background.svg');
  const base=path.join(folder,'thumbnail-background.png');
  const avatar=path.join(folder,'thumbnail-avatar.png');
  const output=path.join(folder,'thumbnail.jpg');
  fs.writeFileSync(art,svgArtwork(date,stockCount));
  fs.writeFileSync(path.join(folder,'thumbnail-prompt.txt'),PROMPT.replace('{MM/DD}',date.slice(4,6)+'/'+date.slice(6,8)).replace('{stock_count}',String(stockCount))+'\n');
  run('rsvg-convert',['-w','1280','-h','720','-o',base,art]);
  // The first quarter is the closed-mouth pose; never upscale this HD source.
  run('ffmpeg',['-y','-loglevel','error','-i',sprite,'-vf','crop=iw/4:ih:0:0,scale=450:-1:flags=lanczos','-frames:v','1',avatar]);
  // Overlay cropped presenter, partly concealed by the bottom label bar.
  run('ffmpeg',['-y','-loglevel','error','-i',base,'-i',avatar,'-filter_complex','[0:v][1:v]overlay=830:30:format=auto,format=yuvj420p','-frames:v','1','-q:v','4',output]);
  const size=fs.statSync(output).size;
  if(size<15000||size>2*1024*1024)throw Error('YouTube thumbnail outside safe size limits: '+size);
  const probe=spawnSync('ffprobe',['-v','error','-select_streams','v:0','-show_entries','stream=width,height','-of','csv=p=0',output],{encoding:'utf8'});
  if(probe.status!==0||probe.stdout.trim()!=='1280,720')throw Error('Wrong thumbnail resolution: '+probe.stdout);
  console.log(JSON.stringify({file:output,bytes:size,resolution:'1280x720',stock_count:stockCount}));
}
if(require.main===module)main(process.argv[2]);
module.exports={label,svgArtwork,PROMPT};
