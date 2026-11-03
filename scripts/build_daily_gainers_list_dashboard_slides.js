#!/usr/bin/env node
'use strict';
// Render-only presentation override: one owner-approved multi-stock list
// dashboard for EVERY scene.  Never invokes upload endpoints.
const fs=require('node:fs');
const path=require('node:path');
const date=process.argv[2];
if(!/^20\d{6}$/.test(String(date||'')))throw Error('Expected YYYYMMDD');
const root=process.cwd();
const out=path.join(root,'output/daily-gainers-video',date);
const plan=JSON.parse(fs.readFileSync(path.join(out,'plan.json'),'utf8'));
const facts=JSON.parse(fs.readFileSync(path.join(root,'data_daily_gain_over_5/analysis-facts',date+'.json'),'utf8'));
const all=new Map(facts.stocks.map(s=>[String(s.code),s]));
if(plan.target_date!==date||facts.target_date!==date||facts.stock_count!==29)throw Error('Date/facts mismatch');
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
const short=(s,n=16)=>[...String(s??'')].slice(0,n).join('');
function signed(v){if(v===null||v===undefined)return '無紀錄';let n=Number(v);return Number.isFinite(n)?(n>0?'+':'')+n.toLocaleString('en-US'):'缺資料'}
function label(s){return short(s,18)}
function row(s,i){
 const y=340+i*124,flow=s.flow||{},broker=flow.broker||{};
 const name=short(s.name,9),code=String(s.code),pct=Number(s.price.change_pct).toFixed(2)+'%';
 const buy=broker.top_buy_brokers?.[0]?.broker_name||'無資料', sell=broker.top_sell_brokers?.[0]?.broker_name||'無資料';
 const vals=[
  {x:148,t:name+' '+code,size:29,color:'#f8fafc'},
  {x:518,t:pct,size:30,color:'#fb7185'},
  {x:706,t:signed(flow.foreign?.net_lots),size:27,color:'#e2e8f0'},
  {x:895,t:signed(flow.investment_trust?.net_lots),size:25,color:'#e2e8f0'},
  {x:1057,t:signed(flow.margin?.margin_delta),size:26,color:'#e2e8f0'},
  {x:1230,t:short(buy,8),size:23,color:'#dbeafe'}
 ];
 return `<rect x="117" y="${y-35}" width="1318" height="111" rx="16" fill="${i%2?'#13243b':'#172b43'}" stroke="#334155" stroke-width="1"/>
 <rect x="120" y="${y-33}" width="7" height="107" rx="3" fill="#38bdf8"/>
 ${vals.map(v=>`<text x="${v.x}" y="${y+13}" font-size="${v.size}" font-weight="600" font-family="Noto Sans CJK TC,sans-serif" fill="${v.color}">${esc(v.t)}</text>`).join('')}
 <text x="1230" y="${y+48}" font-size="17" font-family="Noto Sans CJK TC,sans-serif" fill="#94a3b8">賣：${esc(short(sell,8))}</text>`;
}
function marketOpeningSlide(scene){
 const m=JSON.parse(fs.readFileSync(path.join(root,'data_daily_gain_over_5/market-opening-video',date+'.json'),'utf8'));
 if(m.target_date!==date||m.status!=='verified_official_market_aggregate')throw Error('Missing verified official market opening');
 const billion=n=>(Math.abs(n)/1e8).toFixed(2);
 const amount=n=>(n<0?'賣超':'買超')+billion(n)+' 億元';
 const rows=[
  ['上漲／下跌',m.breadth.advancers+' 家／'+m.breadth.decliners+' 家','上市股票欄'],
  ['平盤／漲停',m.breadth.unchanged+' 家／'+m.breadth.limit_up+' 家','TWSE MI_INDEX'],
  ['加權指數',m.index.close.toLocaleString('en-US')+' 點','下跌 '+Math.abs(m.index.change_points).toFixed(2)+' 點／'+Math.abs(m.index.change_pct).toFixed(2)+'%'],
  ['全市場成交金額',billion(m.trading.turnover_twd)+' 億元','相較前 5 個交易日均值 '+(m.trading.turnover_ratio_ma5*100).toFixed(1)+'%'],
  ['三大法人合計',amount(m.institutional.total_net_twd),'外資 '+amount(m.institutional.foreign_net_twd)+'｜投信 '+amount(m.institutional.investment_trust_net_twd)+'｜自營商 '+amount(m.institutional.dealers_net_twd)]
 ];
 const rowSvg=rows.map((r,i)=>{
  const y=295+i*94;
  const font=i===4?28:33;
  return `<rect x="116" y="${y-45}" width="1318" height="82" rx="14" fill="${i%2?'#172b43':'#13243b'}" stroke="#334155"/>
 <rect x="118" y="${y-43}" width="7" height="78" rx="3" fill="#38bdf8"/>
 <text x="152" y="${y+4}" font-size="29" font-family="Noto Sans CJK TC,sans-serif" fill="#cbd5e1">${esc(r[0])}</text>
 <text x="580" y="${y+4}" font-size="${font}" font-weight="700" font-family="Noto Sans CJK TC,sans-serif" fill="#f8fafc">${esc(r[1])}</text>
 <text x="580" y="${y+29}" font-size="17" font-family="Noto Sans CJK TC,sans-serif" fill="#94a3b8">${esc(r[2])}</text>`;
 }).join('');
 return `<svg xmlns="http://www.w3.org/2000/svg" width="1920" height="1080" viewBox="0 0 1920 1080">
 <rect width="1920" height="1080" fill="#07111f"/><rect width="1920" height="14" fill="#38bdf8"/>
 <text x="115" y="91" fill="#e2e8f0" font-family="Noto Sans CJK TC,sans-serif" font-size="27">TAIWAN STOCK｜2026/11/02｜上市盤勢</text>
 <text x="115" y="160" fill="#fff" font-family="Noto Sans CJK TC,sans-serif" font-size="54" font-weight="bold">今日市場概況</text>
 <text x="115" y="210" fill="#9ddbf8" font-family="Noto Sans CJK TC,sans-serif" font-size="27">追蹤資金，解讀行情｜同日 TWSE 官方資料</text>
 ${rowSvg}
 <text x="117" y="781" font-size="21" fill="#94a3b8" font-family="Noto Sans CJK TC,sans-serif">漲跌家數採 TWSE「股票」欄；成交金額與法人採上市整體市場口徑。</text>
 <text x="117" y="975" font-size="23" fill="#94a3b8" font-family="Noto Sans CJK TC,sans-serif">來源：TWSE MI_INDEX／FMTQIK／BFI82U　｜　資料日期 2026/11/02</text>
 </svg>`;
}
function slide(scene,si){
 const codes=(scene.stock_codes||[]).map(String);
 const selected=codes.length?codes.map(c=>{const s=all.get(c);if(!s)throw Error('Unknown stock '+c);return s}):facts.stocks.slice(26,29);
 if(selected.length>3)throw Error('At most 3 stocks per list scene; respect progress and subtitle safe areas');
 const headers=[{x:148,t:'個股／代號'},{x:518,t:'漲幅'},{x:706,t:'外資(張)'},{x:895,t:'投信(張)'},{x:1057,t:'融資(張)'},{x:1230,t:'分點買／賣'}];
 const subtitle=short(scene.subtitle||'',65);
 return `<svg xmlns="http://www.w3.org/2000/svg" width="1920" height="1080" viewBox="0 0 1920 1080">
 <rect width="1920" height="1080" fill="#07111f"/>
 <rect width="1920" height="14" fill="#38bdf8"/>
 <text x="115" y="94" fill="#e2e8f0" font-family="Noto Sans CJK TC,sans-serif" font-size="27" letter-spacing="3">TAIWAN STOCK｜2026/11/02｜上市 5% 強勢股</text>
 <text x="115" y="161" fill="#ffffff" font-family="Noto Sans CJK TC,sans-serif" font-size="54" font-weight="bold">${esc(short(scene.title,26))}</text>
 <text x="115" y="210" fill="#9ddbf8" font-family="Noto Sans CJK TC,sans-serif" font-size="27">${esc(subtitle)}</text>
 <rect x="116" y="226" width="1320" height="45" rx="12" fill="#0e2035"/>
 ${headers.map(h=>`<text x="${h.x}" y="257" font-size="22" fill="#cbd5e1" font-family="Noto Sans CJK TC,sans-serif">${esc(h.t)}</text>`).join('')}
 ${selected.map(row).join('')}
 <text x="118" y="778" font-size="22" fill="#94a3b8" font-family="Noto Sans CJK TC,sans-serif">投信「無紀錄」不等於 0；分點為樣本，非全市場淨額。</text>
 <text x="118" y="977" font-size="25" fill="#94a3b8" font-family="Noto Sans CJK TC,sans-serif">資料：TWSE／當日 Facts v3　｜　${esc(short(scene.footer||'',70))}</text>
 </svg>`;
}
for(const [i,scene] of plan.scenes.entries()){
 const file=path.join(out,'slides',String(scene.id).padStart(2,'0')+'.svg');
 fs.writeFileSync(file,scene.scene_type==='market_opening'?marketOpeningSlide(scene):slide(scene,i));
}
// Fail before TTS/render if the list header intersects any data card or the timeline.
const rowTop=340-35,headerBottom=226+45,lastRowBottom=340+2*124+76;
if(rowTop<=headerBottom+16||lastRowBottom>=815)throw Error('Dashboard content intersects header or progress timeline');
const manifest={target_date:date,dashboard:'owner-approved-multi-stock-list-only',scene_count:plan.scenes.length,stock_codes:[...new Set(plan.scenes.flatMap(x=>x.stock_codes||[]).map(String))],opening_scene_count:plan.scenes.filter(x=>x.scene_type==='market_opening').length,source_facts:'data_daily_gain_over_5/analysis-facts/'+date+'.json'};
fs.writeFileSync(path.join(out,'list-dashboard-manifest.json'),JSON.stringify(manifest,null,2)+'\n');
if(manifest.opening_scene_count!==1||plan.scenes[0].scene_type!=='market_opening')throw Error('Missing first market opening scene');
if(manifest.stock_codes.length!==29)throw Error('List dashboard missing stock coverage: '+manifest.stock_codes.length);
console.log(JSON.stringify(manifest));
