'use strict';
// MVP10-A only. Render verified-on-dated-source research candidate numbers, never fabricate market-wide figures.
const xml=s=>String(s).replace(/[<>&"']/g,c=>({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;','\'':'&apos;'}[c]));
const fmt=v=>v===null||v===undefined||!Number.isFinite(Number(v))?'未取得':Number(v).toLocaleString('en-US',{maximumFractionDigits:2});
const signed=v=>v===null||v===undefined||!Number.isFinite(Number(v))?'未取得':(Number(v)>0?'+':'')+fmt(v);
const pct=v=>v===null||v===undefined?'未取得':Number(v).toFixed(2)+'%';
const t=(x,y,value,size=24,color='#e2e8f0',weight=400,anchor='start')=>
  '<text x="'+x+'" y="'+y+'" text-anchor="'+anchor+'" font-family="Noto Sans CJK TC,Noto Sans TC,sans-serif" font-size="'+size+'" font-weight="'+weight+'" fill="'+color+'">'+xml(value)+'</text>';
function card(x,label,value,detail){
 return '<rect x="'+x+'" y="190" width="320" height="140" rx="17" fill="#162b44" stroke="#315577" stroke-width="2"/>'+
  t(x+20,226,label,22,'#accfe8',600)+
  t(x+20,281,value,44,'#f8fafc',700)+t(x+20,312,detail,17,'#bfdbfe');
}
function oneRow(s,i){
 const y=428+i*37;
 const ratio=s.technical?.volume_ratio_vs_previous;
 const fields=[
  String(s.code)+' '+String(s.name),pct(s.change_pct),
  signed(s.flow?.foreign?.net_lots),signed(s.flow?.investment_trust?.net_lots),
  signed(s.flow?.margin?.margin_delta),signed(s.flow?.broker?.totals?.net),
  ratio===null||ratio===undefined?'未取得':fmt(ratio)+'×'
 ];
 const xs=[90,370,525,712,894,1096,1284];
 return '<rect x="76" y="'+(y-26)+'" width="1393" height="35" rx="5" fill="'+(i%2===0?'#142a41':'#102136')+'"/>'+
   fields.map((v,j)=>t(xs[j],y,v,j===0?21:20,j===1?'#fda4af':j===2?'#7dd3fc':'#e2e8f0',j===0?600:500)).join('');
}
function renderDashboard(scene,i,n,analyses){
 if(!Array.isArray(analyses)||!analyses.length)throw Error('RESEARCH_DASHBOARD_REQUIRES_DATED_ANALYSIS');
 const index=new Map(analyses.map(v=>[String(v.code),v]));
 const picks=scene.stock_codes.map(x=>index.get(String(x)));
 if(picks.some(x=>!x))throw Error('DASHBOARD_STOCK_NOT_IN_RESEARCH_SOURCE');
 const bands=[analyses.filter(x=>Number(x.change_pct)>=9.5).length,
  analyses.filter(x=>Number(x.change_pct)>=7&&Number(x.change_pct)<9.5).length,
  analyses.filter(x=>Number(x.change_pct)>=5&&Number(x.change_pct)<7).length];
 let cards;
 if(i===0){
  cards=[['候選數量',String(analyses.length)+' 檔','並非全市場上漲家數'],
   ['漲幅 ≥9.5%',String(bands[0])+' 檔','研究候選'],
   ['漲幅 7–9.5%',String(bands[1])+' 檔','研究候選'],
   ['漲幅 5–7%',String(bands[2])+' 檔','研究候選']];
 }else if(picks.length===1){
  const a=picks[0];cards=[
   [String(a.code)+' '+String(a.name),pct(a.change_pct),'當日價格漲幅'],
   ['外資買賣超',signed(a.flow?.foreign?.net_lots)+' 張','已保存來源統計'],
   ['融資增減',signed(a.flow?.margin?.margin_delta)+' 張','槓桿餘額變化'],
   ['相對前日量比',fmt(a.technical?.volume_ratio_vs_previous)+'×','量能延續未保證']
  ];
 }else if(picks.length){
  cards=picks.slice(0,4).map(a=>[String(a.code)+' '+String(a.name),pct(a.change_pct),
   '外資 '+signed(a.flow?.foreign?.net_lots)+' 張']);
  while(cards.length<4)cards.push(['來源待確認','—','不推定不存在的數字']);
 }else{
  cards=[['強勢候選',String(analyses.length)+' 檔','僅為研究清單'],
   ['外資方向','逐檔核對','不能等同券商分點'],
   ['融資風險','逐檔核對','留意短線槓桿'],
   ['成交量比','逐檔核對','不保證隔日延續']];
 }
 const stockRows=(picks.length?picks:analyses.slice(0,7)).slice(0,7);
 const headers=['股票／代號','漲幅','外資 張','投信 張','融資 張','分點 張','量比'];
 const xs=[90,370,525,712,894,1096,1284];
 const title=[...String(scene.title)].slice(0,25).join('');
 const tab= '<rect x="76" y="359" width="1393" height="322" rx="12" fill="#0c1b2d" stroke="#315577"/>'+
   '<rect x="76" y="359" width="1393" height="42" rx="9" fill="#1d3b59"/>'+
   headers.map((label,j)=>t(xs[j],389,label,20,'#bfdbfe',650)).join('')+
   stockRows.map((v,j)=>oneRow(v,j)).join('');
 const watermark='<rect x="1100" y="24" width="792" height="69" rx="12" fill="#4a2110" stroke="#fbbf24" stroke-width="2"/>'+
  t(1120,69,'研究粗剪｜股別與編輯未驗收｜禁止發布',27,'#fef3c7',700);
 return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1920 1080" width="1920" height="1080">'+
  '<rect width="1920" height="1080" fill="#071322"/>'+
  '<rect width="1920" height="13" fill="#38bdf8"/>'+
  t(82,122,title,48,'#f8fafc',700)+
  t(84,160,'2026/10/13｜數據 Dashboard｜'+scene.subtitle,23,'#93c5fd')+
  cards.map((v,j)=>card(76+j*347,v[0],v[1],v[2])).join('')+
  tab+
  '<rect x="0" y="704" width="1920" height="107" fill="#07101e" fill-opacity="0.97"/>'+
  '<rect x="0" y="929" width="1920" height="151" fill="#0f172a"/>'+
  watermark+
  t(45,1031,'TAIWAN STOCK｜20 檔研究候選｜非全市場統計',23,'#94a3b8')+
  t(1785,1032,(i+1)+' / '+n,24,'#f8fafc')+
  '</svg>';
}
module.exports={renderDashboard,fmt,signed,pct};
