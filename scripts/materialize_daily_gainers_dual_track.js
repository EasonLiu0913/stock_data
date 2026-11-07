#!/usr/bin/env node
'use strict';
// Offline-only deterministic market opening; Agent owns individual-stock analysis.
const fs=require('node:fs'),path=require('node:path');
const chars='零一二三四五六七八九';
function failUnless(v,m){if(!v)throw Error(m);}
function chineseInt(n){
 failUnless(Number.isSafeInteger(n)&&n>=0,'invalid integer');
 if(!n)return '零';
 function chunk(x){let out='',zero=false;for(const [d,u] of [[Math.floor(x/1000),'千'],[Math.floor(x/100)%10,'百'],[Math.floor(x/10)%10,'十'],[x%10,'']]){if(!d){if(out)zero=true;continue;}if(zero){out+='零';zero=false;}out+=chars[d]+u;}return out.replace(/^一十/,'十');}
 const parts=[];while(n){parts.push(n%10000);n=Math.floor(n/10000);}
 let out='',zero=false;for(let i=parts.length-1;i>=0;i--){const p=parts[i];if(!p){if(out)zero=true;continue;}if(out&&(zero||p<1000))out+='零';out+=chunk(p)+['','萬','億','兆'][i];zero=false;}return out;
}
function number(n,places=2){failUnless(Number.isFinite(n)&&n>=0,'invalid number');let [a,b]=n.toFixed(places).split('.');return chineseInt(+a)+(b&&+b?'點'+b.replace(/0+$/,'').split('').map(x=>chars[+x]).join(''):'');}
function money(n){return number(Math.abs(n)/1e8)+'億元';}
function direction(n){return n>0?'買超':n<0?'賣超':'買賣超持平';}
function opening(date,m,count){
 failUnless(/^20\d{6}$/.test(date)&&m.target_date===date&&m.market==='TWSE'&&m.status==='verified_official_market_aggregate','unverified or stale opening');
 const {market_opening_breadth:b,index:i,trading:t,institutional:f}=m;
 for(const [o,scope] of [[b,'TWSE_MI_INDEX_OFFICIAL_STOCK_COLUMN'],[t,'TWSE_WHOLE_MARKET'],[f,'TWSE_BFI82U_TWD']])failUnless(o?.scope===scope,'scope mismatch');
 for(const o of [b,i,t,f])failUnless(o?.source_date===date,'market date mismatch');
 const c={advancers:b.advancers,decliners:b.decliners,unchanged:b.unchanged,limit_up:b.limit_up,index_close:i.close,index_change_points:i.change_points,index_change_pct:i.change_pct,turnover_twd:t.turnover_twd,foreign_net_twd:f.foreign_net_twd,investment_trust_net_twd:f.investment_trust_net_twd,dealers_net_twd:f.dealers_net_twd,total_net_twd:f.total_net_twd};
 for(const [k,n] of Object.entries(c))failUnless(typeof n==='number'&&Number.isFinite(n),'missing '+k);
 for(const k of ['advancers','decliners','unchanged','limit_up'])failUnless(Number.isSafeInteger(c[k])&&c[k]>=0,'invalid count '+k);
 failUnless(m.source_manifest?.length>=3&&m.source_manifest.every(x=>x.source_date===date&&x.source_name&&x.source_path_or_endpoint&&x.verified===true&&/^[a-f0-9]{64}$/.test(x.sha256||'')),'invalid source provenance');
 failUnless(t.turnover_ma5_twd>0&&Math.abs(t.turnover_twd/t.turnover_ma5_twd-t.turnover_ratio_ma5)<0.0001,'invalid 5-day turnover');
 failUnless(Math.abs(i.close-i.previous_close-i.change_points)<0.02,'index delta mismatch');
 failUnless(Math.abs(f.foreign_net_twd+f.investment_trust_net_twd+f.dealers_net_twd-f.total_net_twd)<1,'institutional total mismatch');
 const s={advancers:chineseInt(b.advancers)+'家',decliners:chineseInt(b.decliners)+'家',unchanged:chineseInt(b.unchanged)+'家',limit_up:chineseInt(b.limit_up)+'家',index_close:number(i.close),index_change_points:number(Math.abs(i.change_points)),index_change_pct:'百分之'+Math.abs(i.change_pct).toFixed(4).replace(/0+$/,'').replace(/\.$/,''),turnover_twd:money(t.turnover_twd),foreign_net_twd:money(f.foreign_net_twd),investment_trust_net_twd:money(f.investment_trust_net_twd),dealers_net_twd:money(f.dealers_net_twd),total_net_twd:money(f.total_net_twd)};
 const d=chineseInt(+date.slice(4,6))+'月'+chineseInt(+date.slice(6,8))+'日';
 const movement=i.change_points>0?'上漲':i.change_points<0?'下跌':'持平';
 const inst=(label,value,key)=>label+(value===0?'買賣超持平':direction(value)+s[key]);
 const breadth=b.advancers>b.decliners?'上漲家數多於下跌':b.advancers<b.decliners?'下跌家數多於上漲':'上漲與下跌家數相同';
 const idx=i.change_points>0?'指數收高':i.change_points<0?'指數收低':'指數持平';
 const flow=f.total_net_twd>0?'法人合計偏買':f.total_net_twd<0?'法人合計偏賣':'法人合計買賣超持平';
 const contrast=(b.advancers-b.decliners)*i.change_points<0;
 const synthesis=breadth+'，'+idx+'、'+flow+'，'+(contrast?'市場呈現資金分歧':'仍需合併觀察市場廣度與資金動向')+'。'+(t.turnover_ratio_ma5<0.95?'成交金額低於近五日均值，':t.turnover_ratio_ma5>1.05?'成交金額高於近五日均值，':'成交金額接近近五日均值，')+'後續觀察成交量與法人買賣方向是否延續。';
 const narration='那麼我們開始囉。'+d+'，來看今天台灣上市市場的整體表現。加權指數收在'+s.index_close+'點，'+movement+s.index_change_points+'點，'+(i.change_pct<0?'跌幅':i.change_pct>0?'漲幅':'變動幅度')+s.index_change_pct+'。全市場成交金額'+s.turnover_twd+'，約為前五個交易日平均成交金額的百分之'+(t.turnover_ratio_ma5*100).toFixed(2).replace(/0+$/,'').replace(/\.$/,'')+'。上漲'+s.advancers+'，下跌'+s.decliners+'。平盤'+s.unchanged+'，漲停'+s.limit_up+'。法人資金方面，'+inst('外資',f.foreign_net_twd,'foreign_net_twd')+'，'+inst('投信',f.investment_trust_net_twd,'investment_trust_net_twd')+'，'+inst('自營商',f.dealers_net_twd,'dealers_net_twd')+'。三大法人合計'+(f.total_net_twd===0?'買賣超持平':direction(f.total_net_twd)+s.total_net_twd)+'。'+synthesis+'接下來，再看'+chineseInt(count)+'檔漲幅達百分之五的強勢標的。';
 failUnless(!/Dashboard|儀表板|第[一二三四五六七]列|依照.{0,10}順序/i.test(narration),'production cue leaked');
 return {scene_type:'market_opening',title:'今日市場概況',subtitle:'上市股票漲跌、加權指數、成交金額與三大法人',stock_codes:[],bullets:['上市股票欄：上漲 '+b.advancers+' 家／下跌 '+b.decliners+' 家／平盤 '+b.unchanged+' 家／漲停 '+b.limit_up+' 家','加權指數 '+i.close.toLocaleString('en-US')+' 點；'+movement+' '+Math.abs(i.change_points).toFixed(2)+' 點','全市場成交金額 '+(t.turnover_twd/1e8).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})+' 億元','外資 '+(f.foreign_net_twd/1e8).toFixed(2)+' 億／投信 '+(f.investment_trust_net_twd/1e8).toFixed(2)+' 億／自營商 '+(f.dealers_net_twd/1e8).toFixed(2)+' 億','三大法人合計 '+direction(f.total_net_twd)+' '+(Math.abs(f.total_net_twd)/1e8).toFixed(2)+' 億元'],narration,footer:'TWSE 官方同日市場資料；不同來源口徑不混用',market_opening_claims:c,spoken_values:s,opening_generation:'deterministic-official-snapshot-v1'};
}
function materialize(date,agent,market){
 failUnless(agent.target_date===date&&agent.privacy_status==='private'&&Number.isSafeInteger(agent.stock_count)&&agent.stock_count>=0,'agent date/privacy/count mismatch');
 failUnless(Array.isArray(agent.scenes),'agent scenes missing');
 const other=agent.scenes.filter(x=>x.scene_type!=='market_opening');
 failUnless(other.length>=2&&other.slice(0,-1).every(x=>x.scene_type==='stock_list')&&['summary','closing_summary'].includes(other.at(-1).scene_type),'invalid Agent stock/closing scenes');
 failUnless(agent.scenes.filter(x=>x.scene_type==='market_opening').length<=1,'duplicate market opening');
 return {...agent,scenes:[opening(date,market,agent.stock_count),...other],dual_track_generation:'github-market-opening-plus-agent-stock-analysis-v1'};
}
if(require.main===module){
 const date=process.argv[2];failUnless(/^20\d{6}$/.test(date||''),'Expected YYYYMMDD');
 const source=path.join('research_pending','daily-gainers-video-scripts',date+'.json'),official=path.join('data_daily_gain_over_5','market-opening-video',date+'.json'),dest=path.join('video_scripts','daily-gainers',date+'.json');
 const result=materialize(date,JSON.parse(fs.readFileSync(source,'utf8')),JSON.parse(fs.readFileSync(official,'utf8')));
 fs.mkdirSync(path.dirname(dest),{recursive:true});fs.writeFileSync(dest,JSON.stringify(result,null,2)+'\n');
 console.log(JSON.stringify({date,status:'PASS',source,official,dest,generated:result.dual_track_generation}));
}
module.exports={chineseInt,number,opening,materialize};
