#!/usr/bin/env node
'use strict';
const fs=require('node:fs'),path=require('node:path');
const ROOT=path.resolve(__dirname,'..'),FUBON=path.join(ROOT,'data_fubon'),OUT=path.join(ROOT,'data_volume_analysis');
const INDEX=path.join(FUBON,'files.json'),INDUSTRY=path.join(ROOT,'data_twse','twse_industry_Stock.json');
const BANDS=[['lt20','< 20 元',0,20,34],['20_50','20–50 元',20,50,34],['50_100','50–100 元',50,100,34],['100_200','100–200 元',100,200,34],['200_500','200–500 元',200,500,34],['gte500','≥ 500 元',500,Infinity,30]];
const RVOL_BUCKETS=[['<0.60',-Infinity,.6],['0.60–0.90',.6,.9],['0.90–1.20',.9,1.2],['1.20–1.50',1.2,1.5],['1.50–2.00',1.5,2],['2.00–3.00',2,3],['≥3.00',3,Infinity]];
const THRESHOLDS=[.7,.8,.9,1,1.2,1.3,1.5,1.8,2,2.5,3],MIN_MOVE=.5;
const read=(f,d=null)=>{try{const t=fs.readFileSync(f,'utf8').trim();return t?JSON.parse(t):d}catch{return d}};
const write=(f,v)=>{fs.mkdirSync(path.dirname(f),{recursive:true});fs.writeFileSync(f,typeof v==='string'?`${v.trim()}\n`:`${JSON.stringify(v,null,2)}\n`)};
const n=v=>{if(v===null||v===undefined||v==='')return null;const x=Number(String(v).replaceAll(',','').trim());return Number.isFinite(x)?x:null};
const r=(v,d=3)=>Number.isFinite(v)?Number(v.toFixed(d)):null;
const pct=(a,b)=>Number.isFinite(a)&&Number.isFinite(b)&&b!==0?(a/b-1)*100:null;
const avg=a=>{a=a.filter(Number.isFinite);return a.length?a.reduce((s,v)=>s+v,0)/a.length:null};
const q=(a,p)=>{a=a.filter(Number.isFinite).sort((x,y)=>x-y);if(!a.length)return null;const z=(a.length-1)*p,l=Math.floor(z),u=Math.ceil(z);return l===u?a[l]:a[l]+(a[u]-a[l])*(z-l)};
const med=a=>q(a,.5),rate=(a,fn)=>a.length?a.filter(fn).length/a.length*100:null,compact=s=>String(s||'').replaceAll('-','').replaceAll('/','');
const args=process.argv.slice(2).reduce((o,x,i,a)=>(x==='--date'&&(o.date=compact(a[i+1])),x==='--sample-size'&&(o.sample=Number(a[i+1])),o),{});
const fileDate=f=>f.match(/fubon_(20\d{6})_sma\.json$/)?.[1],iso=d=>`${d.slice(0,4)}-${d.slice(4,6)}-${d.slice(6,8)}`;
const bandOf=p=>BANDS.find(([, ,lo,hi])=>p>=lo&&p<hi);
function daily(file,date){const data=read(file,{}),out=[];for(const [code,s] of Object.entries(data)){if(!/^\d{4}$/.test(code))continue;const dk=Object.keys(s||{}).find(k=>compact(k)===date);if(!dk)continue;const x=s[dk]||{},close=n(x.Price??x.Close),open=n(x.Open),high=n(x.High),low=n(x.Low),volume=n(x.Volume);if(![close,open,high,low,volume].every(Number.isFinite)||close<=0||volume<=0)continue;out.push({code,name:s.StockName||'',date:iso(date),close,open,high,low,volume,amount:close*volume*1000})}return out}
function history(date){const files=(read(INDEX,[])||[]).filter(f=>/^fubon_20\d{6}_sma\.json$/.test(f)).map(f=>({f,date:fileDate(f)})).filter(x=>x.date&&(!date||x.date<=date)).sort((a,b)=>a.date.localeCompare(b.date)).slice(-100);if(!files.length)throw Error('No SMA files');const end=date||files.at(-1).date,h=new Map;for(const x of files)for(const row of daily(path.join(FUBON,x.f),x.date)){if(!h.has(row.code))h.set(row.code,[]);h.get(row.code).push(row)}for(const a of h.values())a.sort((x,y)=>x.date.localeCompare(y.date));return{files,end,h}}
function spaced(a,k){if(k>=a.length)return[...a];const out=[],used=new Set;for(let i=0;i<k;i++){let z=k===1?Math.floor(a.length/2):Math.round(i*(a.length-1)/(k-1));while(used.has(z)&&z+1<a.length)z++;while(used.has(z)&&z>0)z--;if(!used.has(z)){used.add(z);out.push(a[z])}}return out}
function candidates(H,end,meta){const out=[];for(const [code,rows] of H){const last=rows.at(-1);if(!last||compact(last.date)!==end||rows.length<35)continue;const b=bandOf(last.close),recent=rows.slice(-20);if(!b)continue;out.push({code,name:meta[code]?.Name||last.name,industry:meta[code]?.Industry||'其他',band:b[0],band_label:b[1],latest_price:last.close,latest_volume:last.volume,median_volume_20:med(recent.map(x=>x.volume)),median_turnover_20:med(recent.map(x=>x.amount)),history_count:rows.length})}return out}
function sample(cands,size){const out=[],used=new Set;for(const [key,, , ,target] of BANDS){const a=cands.filter(x=>x.band===key).sort((x,y)=>x.median_turnover_20-y.median_turnover_20||x.code.localeCompare(y.code));for(const x of spaced(a,Math.min(target,a.length,size-out.length))){out.push(x);used.add(x.code)}}if(out.length<size){const a=cands.filter(x=>!used.has(x.code)).sort((x,y)=>x.median_turnover_20-y.median_turnover_20||x.code.localeCompare(y.code));for(const x of spaced(a,Math.min(size-out.length,a.length)))out.push(x)}return out.slice(0,size)}
function prank(v,a){a=a.filter(Number.isFinite);return a.length?(a.filter(x=>x<v).length+.5*a.filter(x=>x===v).length)/a.length*100:null}
function observations(stocks,H){const out=[];for(const s of stocks){const a=H.get(s.code)||[];for(let i=20;i<a.length-1;i++){const c=a[i],p=a[i-1],nx=a[i+1],p5=a.slice(i-5,i),p20=a.slice(i-20,i),p60=a.slice(Math.max(0,i-60),i),av5=avg(p5.map(x=>x.volume)),av20=avg(p20.map(x=>x.volume)),mv20=med(p20.map(x=>x.volume)),aa20=avg(p20.map(x=>x.amount)),ret=pct(c.close,p.close),next=pct(nx.close,c.close),range=c.high-c.low,clv=range>0?(c.close-c.low)/range:.5;if(![av5,av20,mv20,aa20,ret,next].every(Number.isFinite))continue;out.push({code:s.code,name:s.name,industry:s.industry,band:s.band,band_label:s.band_label,date:c.date,price:c.close,volume:c.volume,amount:c.amount,r1:ret,next_return:next,rvol5:c.volume/av5,rvol20:c.volume/av20,median_ratio20:c.volume/mv20,amount_ratio20:c.amount/aa20,volume_percentile60:prank(c.volume,p60.map(x=>x.volume)),clv,direction:ret>=MIN_MOVE?'up':ret<=-MIN_MOVE?'down':'flat'})}}return out.filter(x=>[x.rvol5,x.rvol20,x.median_ratio20,x.amount_ratio20,x.volume_percentile60,x.clv].every(Number.isFinite))}
function stats(rows,dir){const a=rows.filter(x=>x.direction===dir),cont=dir==='up'?x=>x.next_return>0:x=>x.next_return<0,rev=dir==='up'?x=>x.next_return<0:x=>x.next_return>0;return{count:a.length,current_move_average:r(avg(a.map(x=>x.r1))),next_return_average:r(avg(a.map(x=>x.next_return))),next_return_median:r(med(a.map(x=>x.next_return))),continuation_rate:r(rate(a,cont),2),reversal_rate:r(rate(a,rev),2)}}
function buckets(rows,key){return RVOL_BUCKETS.map(([label,lo,hi])=>{const a=rows.filter(x=>x[key]>=lo&&x[key]<hi);return{bucket:label,count:a.length,up:stats(a,'up'),down:stats(a,'down')}})}
function threshold(rows,key,dir,t){const d=rows.filter(x=>x.direction===dir),hi=d.filter(x=>x[key]>=t),lo=d.filter(x=>x[key]<t);if(hi.length<30||lo.length<30)return null;const hs=stats(hi,dir),ls=stats(lo,dir);return{threshold:t,high_count:hi.length,low_count:lo.length,high_continuation_rate:hs.continuation_rate,low_continuation_rate:ls.continuation_rate,continuation_uplift_pp:r(hs.continuation_rate-ls.continuation_rate,2),high_next_return_average:hs.next_return_average,low_next_return_average:ls.next_return_average,average_return_spread_pp:r(hs.next_return_average-ls.next_return_average)}}
function best(rows,key){return Object.fromEntries(['up','down'].map(dir=>[dir,THRESHOLDS.map(t=>threshold(rows,key,dir,t)).filter(Boolean).sort((a,b)=>Math.abs(b.continuation_uplift_pp)-Math.abs(a.continuation_uplift_pp))[0]||null]))}
function liquidity(rows){const m=new Map;for(const x of rows)m.set(x.code,x);const a=[...m.values()],v=a.map(x=>x.volume),amt=a.map(x=>x.amount);return{stock_count:a.length,observation_count:rows.length,price_median:r(med(a.map(x=>x.price)),2),volume_median_lots:r(med(v),0),volume_p85_lots:r(q(v,.85),0),volume_p90_lots:r(q(v,.9),0),turnover_median_ntd:r(med(amt),0),turnover_p85_ntd:r(q(amt,.85),0)}}
const RULES=[
['baseline','所有 |r1|≥0.5%',x=>true],['rvol12','20日均量比≥1.2',x=>x.rvol20>=1.2],['rvol15','20日均量比≥1.5',x=>x.rvol20>=1.5],['rvol20','20日均量比≥2.0',x=>x.rvol20>=2],['p80','60日量能百分位≥80',x=>x.volume_percentile60>=80],['amount15','成交金額20日比≥1.5',x=>x.amount_ratio20>=1.5],['dual','均量比≥1.5且百分位≥80',x=>x.rvol20>=1.5&&x.volume_percentile60>=80],['low','20日均量比≤0.75',x=>x.rvol20<=.75],['up_close_high','上漲＋均量比≥1.5＋收近高',x=>x.direction==='up'&&x.rvol20>=1.5&&x.clv>=.7],['up_close_low','上漲＋均量比≥1.5＋收中低',x=>x.direction==='up'&&x.rvol20>=1.5&&x.clv<=.4],['down_close_low','下跌＋均量比≥1.5＋收近低',x=>x.direction==='down'&&x.rvol20>=1.5&&x.clv<=.3],['down_close_high','下跌＋均量比≥1.5＋收中高',x=>x.direction==='down'&&x.rvol20>=1.5&&x.clv>=.6]
];
function analyze(label,rows){return{label,liquidity:liquidity(rows),rvol20_buckets:buckets(rows,'rvol20'),best_thresholds:{rvol20:best(rows,'rvol20'),amount_ratio20:best(rows,'amount_ratio20')},rules:RULES.map(([key,name,test])=>{const a=rows.filter(test);return{key,label:name,matched:a.length,up:stats(a,'up'),down:stats(a,'down')}})}}
const money=v=>!Number.isFinite(v)?'NA':v>=1e8?`${r(v/1e8,2)} 億元`:v>=1e6?`${r(v/1e6,1)} 百萬元`:`${r(v/1e3,1)} 千元`;
function md(P){
  const L=[
    `# 股票成交量確認分析：${P.date}`,
    '',
    `- 代表股票：${P.sample.stock_count} 檔（只保留四位數股票代號）`,
    `- 日觀察值：${P.observation_count.toLocaleString()} 筆`,
    `- 歷史：${P.history.start_date} ～ ${P.history.end_date}`,
    '',
    '## 抽樣方法',
    '',
    '- 六個股價帶分層，每帶涵蓋低、中、高成交金額。',
    '- 每檔至少35個交易日，方向日定義為 |r1| ≥ 0.5%。',
    '- 成交量用股票自身20日均量與60日百分位標準化；原始張數只描述流動性。',
    '',
    '## 各價格帶流動性',
    '',
    '| 價格帶 | 股票 | 觀察值 | 價格中位 | 量中位 | 量P85 | 量P90 | 金額中位 | 金額P85 |',
    '|---|---:|---:|---:|---:|---:|---:|---:|---:|'
  ];
  for(const [key,label] of BANDS){
    const x=P.scopes[key].liquidity;
    L.push(`| ${label} | ${x.stock_count} | ${x.observation_count} | ${x.price_median} 元 | ${x.volume_median_lots} 張 | ${x.volume_p85_lots} 張 | ${x.volume_p90_lots} 張 | ${money(x.turnover_median_ntd)} | ${money(x.turnover_p85_ntd)} |`);
  }
  L.push(
    '',
    '## 全樣本規則比較',
    '',
    '| 規則 | 上漲樣本 | 隔日續漲 | 隔日平均 | 下跌樣本 | 隔日續跌 | 隔日平均 |',
    '|---|---:|---:|---:|---:|---:|---:|'
  );
  for(const x of P.scopes.all.rules){
    L.push(`| ${x.label} | ${x.up.count} | ${x.up.continuation_rate ?? 'NA'}% | ${x.up.next_return_average ?? 'NA'}% | ${x.down.count} | ${x.down.continuation_rate ?? 'NA'}% | ${x.down.next_return_average ?? 'NA'}% |`);
  }
  L.push(
    '',
    '## 各價位帶的探索門檻',
    '',
    '| 價格帶 | 上漲日量比 | 高量續漲 | 低量續漲 | 差距 | 下跌日量比 | 高量續跌 | 低量續跌 | 差距 |',
    '|---|---:|---:|---:|---:|---:|---:|---:|---:|'
  );
  for(const [key,label] of BANDS){
    const threshold=P.scopes[key].best_thresholds.rvol20;
    const u=threshold.up,d=threshold.down;
    L.push(`| ${label} | ${u?.threshold ?? 'NA'}x | ${u?.high_continuation_rate ?? 'NA'}% | ${u?.low_continuation_rate ?? 'NA'}% | ${u?.continuation_uplift_pp ?? 'NA'}pp | ${d?.threshold ?? 'NA'}x | ${d?.high_continuation_rate ?? 'NA'}% | ${d?.low_continuation_rate ?? 'NA'}% | ${d?.continuation_uplift_pp ?? 'NA'}pp |`);
  }
  L.push(
    '',
    '## 建議討論的定義',
    '',
    '### 1. 相對均量分級',
    '- 量縮：20日均量比 ≤ 0.75。',
    '- 正常量：0.75～1.20。',
    '- 溫和放量：1.20～1.50。',
    '- 明顯放量：1.50～2.00。',
    '- 大量：2.00～3.00。',
    '- 極端量：≥3.00。',
    '',
    '### 2. 60日量能百分位',
    '- ≥70：活躍；≥80：明顯放量；≥90：大量；≥95：極端。',
    '',
    '### 3. 成交金額確認',
    '- 當日成交金額／20日平均成交金額 ≥1.5，並搭配各價格帶P50或P75作流動性底線。',
    '',
    '### 4. 量價＋收盤位置',
    '- 多頭確認：r1≥0.5%、均量比≥1.5、收盤位於當日振幅上方30%（CLV≥0.7）。',
    '- 空頭確認：r1≤-0.5%、均量比≥1.5、收盤位於當日振幅下方30%（CLV≤0.3）。',
    '- 放量上漲卻收中低，較像出貨；放量下跌卻收中高，較像承接或恐慌反轉。',
    '',
    '## 注意',
    '- 放量不等於趨勢必然延續，極端量可能是高潮量。',
    '- 股價帶適合設定成交金額底線，不適合設定固定成交張數訊號。',
    '- 正式入模前應依市場多空階段、產業與市值再做外樣本驗證。',
    '',
    `完整資料：data_volume_analysis/${P.date}/volume-confirmation-analysis.json`
  );
  return L.join('\n');
}
function main(){const meta=read(INDUSTRY,{}),H=history(args.date),size=Number.isFinite(args.sample)&&args.sample>0?Math.floor(args.sample):200,c=candidates(H.h,H.end,meta),S=sample(c,size),O=observations(S,H.h);if(S.length<100||!O.length)throw Error(`Insufficient sample: ${S.length}`);const scopes={all:analyze('全樣本',O)};for(const [key,label] of BANDS)scopes[key]=analyze(label,O.filter(x=>x.band===key));const P={schema_version:'2.0.0',generated_at:new Date().toISOString(),date:H.end,methodology:{sample_size_requested:size,stock_code_filter:'exactly four numeric digits',historical_file_count:H.files.length,minimum_stock_history:35,minimum_directional_move_percent:MIN_MOVE,volume_unit_assumption:'Volume treated as lots; estimated turnover = close × volume × 1,000 TWD',selection:'price-band stratification and evenly spaced sampling by 20-day median turnover'},history:{start_date:H.files[0].date,end_date:H.files.at(-1).date,file_count:H.files.length},price_bands:BANDS.map(([key,label,min,max,target])=>({key,label,min,max:Number.isFinite(max)?max:null,target})),sample:{stock_count:S.length,stocks:S,counts_by_band:Object.fromEntries(BANDS.map(([key])=>[key,S.filter(x=>x.band===key).length]))},observation_count:O.length,scopes};const dir=path.join(OUT,H.end);write(path.join(dir,'volume-confirmation-analysis.json'),P);write(path.join(dir,'volume-confirmation-analysis.md'),md(P));write(path.join(OUT,'manifest.json'),{latest_date:H.end,latest_json:`data_volume_analysis/${H.end}/volume-confirmation-analysis.json`,latest_markdown:`data_volume_analysis/${H.end}/volume-confirmation-analysis.md`,generated_at:P.generated_at,schema_version:P.schema_version});console.log(JSON.stringify({date:H.end,sample:S.length,observations:O.length,counts:P.sample.counts_by_band},null,2))}
try{main()}catch(e){console.error(e.stack||e.message);process.exit(1)}
