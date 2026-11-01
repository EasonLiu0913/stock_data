'use strict';
// Research-only original-source check for multiple dated securities; no changes to any production inputs.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const DATE='20261008';
function read(root,p){const bytes=fs.readFileSync(path.join(root,p));if(!bytes.length)throw Error('EMPTY_SOURCE:'+p);return {sha256:crypto.createHash('sha256').update(bytes).digest('hex'),data:bytes,path:p}}
function jread(root,p){const x=read(root,p);return {...x,record:JSON.parse(x.data)}}
const str=x=>String(x??'').replace(/<[^>]+>/g,'').trim();
const num=x=>x==null||str(x)===''?null:Number(str(x).replaceAll(',',''));
function same(a,b,name){if(!Number.isFinite(a)||!Number.isFinite(b)||a!==b)throw Error('SOURCE_CLAIM_MISMATCH:'+name+':'+a+':'+b)}
function rowsByCode(table,codeIndex,code){return (table.data||[]).filter(row=>Array.isArray(row)&&str(row[codeIndex])===code)}
function csv(line){const arr=[];let t='',q=false;for(let i=0;i<line.length;i++){const c=line[i];if(c==='"'){if(q&&line[i+1]==='"'){t+='"';i++}else q=!q}else if(c===','&&!q){arr.push(t);t=''}else t+=c}arr.push(t);return arr}
function verify(root,code='9919'){
 const sources={};const load=(p)=>{const x=jread(root,p);sources[p]=x.sha256;return x.record};
 const raw=load('data_daily_gain_over_5/'+DATE+'.json'),facts=load('data_daily_gain_over_5/analysis-facts/'+DATE+'.json'),published=load('data_daily_gain_over_5/analysis/'+DATE+'.json');
 if([raw,facts,published].some(x=>x.target_date!==DATE))throw Error('DATE_MISMATCH');
 const r=raw.stocks.find(x=>x.code===code),f=facts.stocks.find(x=>x.code===code),a=published.analyses.find(x=>x.code===code);
 if(!r||!f||!a||!r.name||f.name!==r.name||a.name!==r.name)throw Error('STOCK_IDENTITY_NOT_FOUND');
 same(Number(r.close),Number(f.price.close),'FUBON_FACT_CLOSE');
 same(Number(r.change_pct),Number(f.price.change_pct),'FUBON_FACT_GAIN');
 const mi=load('data_twse_mi_index/'+DATE+'_twse_mi_index.json');
 if(mi.date!==DATE||mi.stat!=='OK')throw Error('MI_DATE_OR_STATUS');
 const table=(mi.tables||[]).find(t=>['證券代號','收盤價','漲跌價差'].every(k=>t.fields?.includes(k)));
 if(!table)throw Error('MI_STOCK_TABLE_NOT_FOUND');
 const rr=rowsByCode(table,table.fields.indexOf('證券代號'),code);
 if(rr.length!==1)throw Error('MI_DUPLICATE_OR_MISSING_STOCK');
 const close=num(rr[0][table.fields.indexOf('收盤價')]),delta=num(rr[0][table.fields.indexOf('漲跌價差')]);
 same(close,Number(r.close),'OFFICIAL_CLOSE');
 if(delta==null||Math.abs(close-Number(r.previous_close)-delta)>0.02)throw Error('OFFICIAL_CHANGE_MISMATCH');
 const institutional={};
 for(const [actor,dir,suf,codeFallback,netFallback] of [
  ['foreign','data_twse_foreign_investors','twse_foreign_investors',1,11],
  ['investment_trust','data_twse_investment_trust','twse_investment_trust',1,5],
  ['dealer','data_twse_dealers','twse_dealers',0,10]]){
  const z=load(dir+'/'+DATE+'_'+suf+'.json');
  if(z.stat!=='OK'||z.date!==DATE||!Array.isArray(z.data))throw Error('INSTITUTIONAL_DATE:'+actor);
  const fields=(z.fields||[]).map(str);
  const c=fields.findIndex(k=>['證券代號','股票代號','證券代碼'].includes(k));
  const n=fields.findIndex(k=>['買賣超股數','買賣超股數(不含外資自營商)','外陸資買賣超股數','投信買賣超股數','自營商買賣超股數'].includes(k));
  const hits=rowsByCode(z,c>=0?c:codeFallback,code);
  if(hits.length>1)throw Error('INSTITUTIONAL_DUPLICATE:'+actor);
  const net=hits.length?num(hits[0][n>=0?n:netFallback]):null;
  const old=f.flow?.[actor];
  if(net===null){if(old?.net_shares!==null||old?.record_status!=='no_record')throw Error('MISSING_INSTITUTIONAL_IMPUTED_ZERO:'+actor)}
  else{same(net,old.net_shares,'INSTITUTIONAL_'+actor);same(Math.round(net/1000),old.net_lots,'LOTS_'+actor)}
  institutional[actor]={net_shares:net,records:hits.length};
 }
 const margin=read(root,'data_twse_margin_balance/'+DATE+'_twse_margin_balance.csv');
 sources[margin.path]=margin.sha256;
 const lines=margin.data.toString('utf8').replace(/^\uFEFF/,'').trim().split(/\r?\n/),header=csv(lines.shift());
 const hits=lines.map(csv).filter(row=>str(row[0])===code);
 if(hits.length>1)throw Error('MARGIN_DUPLICATE');
 let marginResult;
 if(hits.length===0){
  const m=f.flow?.margin;
  if(!m||[m.margin_prev,m.margin_now,m.margin_delta,m.short_prev,m.short_now,m.short_delta].some(x=>x!==null))
   throw Error('MISSING_MARGIN_ROW_WAS_IMPUTED_OR_UNCHECKED:'+code);
  marginResult={previous:null,current:null,delta:null,record_status:'no_record'};
 }else{
  const prev=num(hits[0][header.indexOf('融資前日餘額')]),curr=num(hits[0][header.indexOf('融資今日餘額')]);
  same(prev,f.flow.margin.margin_prev,'MARGIN_PREV');
  same(curr,f.flow.margin.margin_now,'MARGIN_CURRENT');
  same(curr-prev,f.flow.margin.margin_delta,'MARGIN_DELTA');
  marginResult={previous:prev,current:curr,delta:curr-prev,record_status:'reported'};
 }
 return {target_date:DATE,code:code,claim_type:'SAME_DAY_NUMERIC_SOURCE_CROSSCHECK',
  official_close:close,official_change:delta,raw_gain_pct:r.change_pct,
  institutional,margin:marginResult,source_sha256:sources,
  date_effective_ordinary_identity_verified:false,external_news_catalyst_verified:false,
  independent_publication_scope_verified:false,render_authorized:false,publication_authorized:false,
  decision:'NUMERIC_SOURCE_CROSSCHECK_ONLY'};
}
if(require.main===module){try{console.log(JSON.stringify(verify(process.argv[2]||process.cwd(),process.argv[3]||'9919'),null,2))}
catch(e){console.error(e.stack||e.message);process.exitCode=1}}
module.exports={verify};
