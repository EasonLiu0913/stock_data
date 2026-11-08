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
if(plan.target_date!==date||facts.target_date!==date||!Number.isInteger(facts.stock_count)||facts.stock_count<1)throw Error('Date/facts mismatch');
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
function getOfficialBreadth(m){
 const breadth=m.market_opening_breadth;
 if(!breadth||breadth.scope!=='TWSE_MI_INDEX_OFFICIAL_STOCK_COLUMN'||breadth.source_date!==date)
  throw Error('Missing same-date TWSE MI_INDEX official stock-column breadth');
 return breadth;
}
function marketOpeningSlide(scene){
 const m=JSON.parse(fs.readFileSync(path.join(root,'data_daily_gain_over_5/market-opening-video',date+'.json'),'utf8'));
 if(m.target_date!==date||m.status!=='verified_official_market_aggregate')throw Error('Missing verified official market opening');
 const breadth=getOfficialBreadth(m);
 const billion=n=>(Math.abs(n)/1e8).toFixed(2);
 const flow=n=>(n<0?'賣超':n>0?'買超':'持平')+(n===0?'':billion(n)+' 億元');
 const movement=m.index.change_points<0?'下跌':m.index.change_points>0?'上漲':'持平';
 const marketTone=(breadth.advancers>breadth.decliners && m.index.change_points<0 && m.institutional.total_net_twd<0)
  ?'個股漲多於跌，但指數與法人偏弱，資金分歧'
  :(breadth.advancers>breadth.decliners && m.index.change_points>=0 && m.institutional.total_net_twd>=0)
  ?'漲多於跌、指數與法人同向，盤勢偏強'
  :(breadth.advancers<breadth.decliners && m.index.change_points<0)
  ?'跌多於漲且指數回落，盤勢偏弱':'漲跌與資金方向不一致，盤勢分歧';
 const fixedFields=['加權指數','全市場成交金額','上漲／下跌','平盤／漲停','外資／投信／自營商','三大法人合計','市場強弱摘要'];
 const rows=[
  [fixedFields[0],m.index.close.toLocaleString('en-US')+' 點',movement+' '+Math.abs(m.index.change_points).toFixed(2)+' 點／'+Math.abs(m.index.change_pct).toFixed(2)+'%'],
  [fixedFields[1],billion(m.trading.turnover_twd)+' 億元','前 5 個交易日均值之 '+(m.trading.turnover_ratio_ma5*100).toFixed(1)+'%'],
  [fixedFields[2],breadth.advancers+' 家／'+breadth.decliners+' 家','TWSE MI_INDEX 股票欄'],
  [fixedFields[3],breadth.unchanged+' 家／'+breadth.limit_up+' 家','TWSE MI_INDEX'],
  [fixedFields[4],'外資：'+flow(m.institutional.foreign_net_twd),'投信：'+flow(m.institutional.investment_trust_net_twd),'自營商：'+flow(m.institutional.dealers_net_twd)],
  [fixedFields[5],flow(m.institutional.total_net_twd),'三大法人合計買賣超／新臺幣'],
  [fixedFields[6],marketTone,'依上市漲跌家數、指數與法人資金方向綜合判讀']
 ];
 for(const [i,r] of rows.entries())if(r.some(v=>!v||String(v).includes('NaN')||String(v).includes('undefined')))throw Error('Missing fixed opening dashboard field '+fixedFields[i]);
 const rowSvg=rows.map((r,i)=>{
  const y=265+i*75,small=i===6;
  const font=small?23:29;
  const panel='<rect x="116" y="'+(y-38)+'" width="1318" height="69" rx="12" fill="'+(i%2?'#172b43':'#13243b')+'" stroke="#334155"/>'+
   '<rect x="118" y="'+(y-36)+'" width="7" height="65" rx="3" fill="#38bdf8"/>'+
   '<text x="150" y="'+(y+2)+'" font-size="25" font-family="Noto Sans CJK TC,sans-serif" fill="#cbd5e1">'+esc(r[0])+'</text>';
  // Three equal-weight primary values; no institution is relegated to the secondary caption.
  if(i===4){
   const x=[520,818,1116],entries=r.slice(1);
   if(entries.length!==3)throw Error('Market institutions must include foreign, investment trust, dealers');
   return panel+entries.map((value,j)=>
    '<text x="'+x[j]+'" y="'+(y+3)+'" font-size="23" font-weight="700" font-family="Noto Sans CJK TC,sans-serif" fill="#f8fafc">'+esc(value)+'</text>'
   ).join('');
  }
  return panel+
   '<text x="520" y="'+(y-5)+'" font-size="'+font+'" font-weight="700" font-family="Noto Sans CJK TC,sans-serif" fill="#f8fafc">'+esc(r[1])+'</text>'+
   '<text x="520" y="'+(y+21)+'" font-size="17" font-family="Noto Sans CJK TC,sans-serif" fill="#94a3b8">'+esc(r[2])+'</text>';
 }).join('');
 const dateLabel=date.slice(0,4)+'/'+date.slice(4,6)+'/'+date.slice(6,8);
 return '<svg xmlns="http://www.w3.org/2000/svg" width="1920" height="1080" viewBox="0 0 1920 1080">'+
 '<rect width="1920" height="1080" fill="#07111f"/><rect width="1920" height="14" fill="#38bdf8"/>'+
 '<text x="115" y="91" fill="#e2e8f0" font-family="Noto Sans CJK TC,sans-serif" font-size="27">TAIWAN STOCK｜'+esc(dateLabel)+'｜上市盤勢</text>'+
 '<text x="115" y="156" fill="#fff" font-family="Noto Sans CJK TC,sans-serif" font-size="52" font-weight="bold">今日市場概況</text>'+
 '<text x="115" y="204" fill="#9ddbf8" font-family="Noto Sans CJK TC,sans-serif" font-size="26">追蹤資金，解讀行情｜TWSE 官方資料</text>'+
 rowSvg+'<text x="117" y="800" font-size="18" fill="#94a3b8" font-family="Noto Sans CJK TC,sans-serif">來源：TWSE MI_INDEX／FMTQIK／BFI82U；漲跌家數與全市場成交口徑分開。</text></svg>';
}

function closingSummarySlide(scene){
 const bullets=scene.bullets;
 if(!Array.isArray(bullets)||bullets.length<3||bullets.length>5)throw Error('Closing summary requires 3-5 observations');
 if((scene.stock_codes||[]).length)throw Error('Closing summary cannot contain stock rows');
 const m=JSON.parse(fs.readFileSync(path.join(root,'data_daily_gain_over_5/market-opening-video',date+'.json'),'utf8'));
 if(m.target_date!==date||m.status!=='verified_official_market_aggregate')throw Error('Closing market data incomplete');
 const breadth=getOfficialBreadth(m);
 const marketDirection=m.index.change_points<0?'下跌':(m.index.change_points>0?'上漲':'持平');
 const flows=m.institutional.total_net_twd<0?'賣超':(m.institutional.total_net_twd>0?'買超':'持平');
 const cardsContent=[
   '加權指數'+marketDirection+Math.abs(m.index.change_points).toFixed(2)+'點；上漲'+breadth.advancers+'家／下跌'+breadth.decliners+'家',
   '三大法人合計'+flows+(Math.abs(m.institutional.total_net_twd)/1e8).toFixed(2)+'億元；資金方向分歧',
   '觀察後續成交量、法人連續性與強勢股能否站穩均線',
   '低量股留意滑價，放量股留意短線震盪與融資風險'
 ];
 const labels=['市場結論','資金流向','下一交易日觀察','風險提醒'];
 const cards=cardsContent.map((value,i)=>{
   const y=286+i*101;
   return '<rect x="116" y="'+(y-44)+'" width="1318" height="85" rx="14" fill="'+(i%2?'#172b43':'#13243b')+'" stroke="#334155"/>'+
   '<rect x="119" y="'+(y-42)+'" width="7" height="81" rx="3" fill="#38bdf8"/>'+
   '<text x="153" y="'+(y+5)+'" font-size="25" font-family="Noto Sans CJK TC,sans-serif" fill="#7dd3fc">'+esc(labels[i])+'</text>'+
   '<text x="435" y="'+(y+5)+'" font-size="27" font-family="Noto Sans CJK TC,sans-serif" fill="#f8fafc">'+esc(short(value,46))+'</text>';
 }).join('');
 return '<svg xmlns="http://www.w3.org/2000/svg" width="1920" height="1080" viewBox="0 0 1920 1080">'+
 '<rect width="1920" height="1080" fill="#07111f"/><rect width="1920" height="14" fill="#38bdf8"/>'+
 '<text x="115" y="94" fill="#e2e8f0" font-family="Noto Sans CJK TC,sans-serif" font-size="27">TAIWAN STOCK｜'+esc(date.slice(0,4)+'/'+date.slice(4,6)+'/'+date.slice(6,8))+'｜收盤觀察</text>'+
 '<text x="115" y="161" fill="#fff" font-family="Noto Sans CJK TC,sans-serif" font-size="54" font-weight="bold">'+esc(short(scene.title,26))+'</text>'+
 '<text x="115" y="210" fill="#9ddbf8" font-family="Noto Sans CJK TC,sans-serif" font-size="27">'+esc(short(scene.subtitle,50))+'</text>'+
 cards+'</svg>';
}

function slide(scene,si){
 const codes=(scene.stock_codes||[]).map(String);
 if(scene.scene_type!=='stock_list'||!codes.length)throw Error('Stock list scene requires explicit nonempty codes');
 const selected=codes.map(c=>{const s=all.get(c);if(!s)throw Error('Unknown stock '+c);return s});
 if(selected.length>3)throw Error('At most 3 stocks per list scene; respect progress and subtitle safe areas');
 const headers=[{x:148,t:'標的／代號'},{x:518,t:'漲幅'},{x:706,t:'外資(張)'},{x:895,t:'投信(張)'},{x:1057,t:'融資(張)'},{x:1230,t:'分點買／賣'}];
 const subtitle=short(scene.subtitle||'',65);
 return `<svg xmlns="http://www.w3.org/2000/svg" width="1920" height="1080" viewBox="0 0 1920 1080">
 <rect width="1920" height="1080" fill="#07111f"/>
 <rect width="1920" height="14" fill="#38bdf8"/>
 <text x="115" y="94" fill="#e2e8f0" font-family="Noto Sans CJK TC,sans-serif" font-size="27" letter-spacing="3">TAIWAN STOCK｜${date.slice(0,4)}/${date.slice(4,6)}/${date.slice(6,8)}｜5% 強勢標的</text>
 <text x="115" y="161" fill="#ffffff" font-family="Noto Sans CJK TC,sans-serif" font-size="54" font-weight="bold">${esc(short(scene.title,26))}</text>
 <text x="115" y="210" fill="#9ddbf8" font-family="Noto Sans CJK TC,sans-serif" font-size="27">${esc(subtitle)}</text>
 <rect x="116" y="226" width="1320" height="45" rx="12" fill="#0e2035"/>
 ${headers.map(h=>`<text x="${h.x}" y="257" font-size="22" fill="#cbd5e1" font-family="Noto Sans CJK TC,sans-serif">${esc(h.t)}</text>`).join('')}
 ${selected.map(row).join('')}

 
 </svg>`;
}
for(const [i,scene] of plan.scenes.entries()){
 const file=path.join(out,'slides',String(scene.id).padStart(2,'0')+'.svg');
 if(!['market_opening','stock_list','summary','closing_summary'].includes(scene.scene_type))throw Error('Invalid or missing scene type: '+scene.id);
 if(scene.scene_type==='market_opening' && i!==0)throw Error('Market opening must be first');
 if(['summary','closing_summary'].includes(scene.scene_type) && i!==plan.scenes.length-1)throw Error('Closing summary must be last');
 const visual=scene.scene_type==='market_opening'?marketOpeningSlide(scene):(['summary','closing_summary'].includes(scene.scene_type)?closingSummarySlide(scene):slide(scene,i));
 fs.writeFileSync(file,visual);
}
// Fail before TTS/render if the list header intersects any data card or the timeline.
const rowTop=340-35,headerBottom=226+45,lastRowBottom=340+2*124+76;
if(rowTop<=headerBottom+16||lastRowBottom>=815)throw Error('Dashboard content intersects header or progress timeline');
const manifest={target_date:date,opening_dashboard_fields:['加權指數','全市場成交金額','上漲／下跌','平盤／漲停','外資／投信／自營商','三大法人合計','市場強弱摘要'],dashboard:'owner-approved-multi-stock-list-only',scene_count:plan.scenes.length,stock_codes:[...new Set(plan.scenes.flatMap(x=>x.stock_codes||[]).map(String))],opening_scene_count:plan.scenes.filter(x=>x.scene_type==='market_opening').length,source_facts:'data_daily_gain_over_5/analysis-facts/'+date+'.json'};
fs.writeFileSync(path.join(out,'list-dashboard-manifest.json'),JSON.stringify(manifest,null,2)+'\n');
if(manifest.opening_scene_count!==1||plan.scenes[0].scene_type!=='market_opening')throw Error('Missing first market opening scene');
if(plan.scenes.filter(s=>['summary','closing_summary'].includes(s.scene_type)).length!==1||!['summary','closing_summary'].includes(plan.scenes.at(-1).scene_type))throw Error('Missing last closing summary');
if(manifest.stock_codes.length!==facts.stock_count)throw Error('List dashboard missing stock coverage: '+manifest.stock_codes.length);
console.log(JSON.stringify(manifest));
