'use strict';
// M7VIS-derived informational slide cards; data-only, no guessed market figures.
const esc = s => String(s ?? '').replace(/[<>&"']/g, c => ({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;',"'":'&apos;'}[c]));
const text = (x,y,s,size=32,color='#f8fafc',weight=500) => `<text x="${x}" y="${y}" font-family="Noto Sans CJK TC,Noto Sans TC,sans-serif" font-size="${size}" font-weight="${weight}" fill="${color}">${esc(s)}</text>`;
const card = (x,y,label,value,color='#f8fafc') => `<rect x="${x}" y="${y}" width="565" height="150" rx="20" fill="#203650"/>${text(x+26,y+48,label,27,'#b9c9da')}${text(x+26,y+111,value,43,color,700)}`;
const safe = (n,label) => { if(!Number.isInteger(n)||n<0) throw Error('M7VIS missing/invalid '+label); return n; };
function visuals(scene,summary,raw) {
  const id=Number(scene.id), breadth=summary.breadth||{},fund=summary.funding_summary||{};
  const four=(items)=>items.map((c,i)=>card(112+(i%2)*590,310+Math.floor(i/2)*174,...c)).join('');
  let body='',kind='editorial';
  if(id===1) {
    kind='market-breadth';
    const total=safe(breadth.stock_count,'breadth.stock_count');
    if(total!==safe(raw.stock_count,'raw.stock_count')) throw Error('M7VIS stock count mismatch');
    const a=safe(breadth.gain_5_to_7_count,'5-7'),b=safe(breadth.gain_7_to_9_5_count,'7-9.5'),c=safe(breadth.gain_9_5_plus_count,'9.5+');
    if(a+b+c!==total) throw Error('M7VIS breadth buckets mismatch');
    body=four([['5%～7% 漲幅',a+' 檔','#f8fafc'],['7%～9.5% 漲幅',b+' 檔','#f8fafc'],['9.5% 以上',c+' 檔','#fbbf66'],['今日強勢股合計',total+' 檔','#fbbf66']]);
  } else if(id===2) {
    kind='theme';
    const ranks=summary.theme_summary?.theme_ranking||[];
    if(ranks.length<3) throw Error('M7VIS requires sourced theme ranking');
    body=four(ranks.slice(0,4).map(t=>[t.label,safe(t.stock_count,'theme count')+' 檔','#f8fafc']));
  } else if(id===6) {
    kind='funding';
    body=four([['法人偏多',safe(fund.institutional_support_count,'institutional_support_count')+' 檔','#fbbf66'],['法人偏空',safe(fund.institutional_opposition_count,'institutional_opposition_count')+' 檔'],['融資增加',safe(fund.margin_increase_count,'margin_increase_count')+' 檔'],['融資減少',safe(fund.margin_decrease_count,'margin_decrease_count')+' 檔']]);
  } else {
    kind=id===9?'conclusion':'stock-research';
    const bullets=scene.bullets||[];
    if(!bullets.length) throw Error('M7VIS missing scene bullets '+id);
    body=bullets.slice(0,3).map((b,i)=>`<rect x="112" y="${310+i*152}" width="1155" height="130" rx="18" fill="#203650"/><rect x="112" y="${310+i*152}" width="8" height="130" rx="4" fill="#fbbf66"/>${text(143,365+i*152,String(i+1).padStart(2,'0'),29,'#fbbf66',700)}${text(210,365+i*152,[...String(b)].slice(0,30).join(''),30)}${[...String(b)].length>30?text(210,411+i*152,[...String(b)].slice(30,60).join(''),28):''}`).join('');
  }
  return {kind,svg:`<rect x="90" y="287" width="1200" height="492" rx="26" fill="#13253a" fill-opacity=".48"/>${body}`};
}
module.exports={visuals};
