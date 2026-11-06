#!/usr/bin/env node
'use strict';
const fs=require('fs'),crypto=require('crypto'),path=require('path');
const root=path.resolve(__dirname,'..');
const date=process.argv[2];
if(!/^20\d{6}$/.test(date||'')) throw Error('Usage: node scripts/verify_daily_gainers_official_numeric.js YYYYMMDD');
const read=(p)=>fs.readFileSync(path.join(root,p));
const json=(p)=>JSON.parse(read(p).toString('utf8'));
const sha=(p)=>crypto.createHash('sha256').update(read(p)).digest('hex');
const num=(v)=>v==null||v===''?null:Number(String(v).replace(/,/g,'').trim());
const errors=[],checks=[],files={};
const assert=(ok,code,field,detail)=>{checks.push({code,field,status:ok?'PASS':'FAIL',detail:ok?undefined:detail});if(!ok)errors.push(code+':'+field+':'+detail)};
const factsPath='data_daily_gain_over_5/analysis-facts/'+date+'.json',listPath='data_daily_gain_over_5/'+date+'.json';
const facts=json(factsPath),list=json(listPath);
assert(facts.target_date===date,'*','facts_date','date mismatch');
assert(list.target_date===date,'*','list_date','date mismatch');
assert(facts.stock_count===facts.stocks.length&&facts.stocks.length===list.stocks.length,'*','coverage','count mismatch');
const byCode=new Map(list.stocks.map(s=>[String(s.code),s]));
const sourcePaths={facts:factsPath,list:listPath,...facts.source_files};
for(const [key,p] of Object.entries(sourcePaths)){try{files[key]={path:p,sha256:sha(p)};}catch(e){errors.push('missing source '+key+': '+p)}}
const src={},sourceColumnMapping={};
for(const k of ['foreign','investment_trust','dealer']){
 try{
  const data=json(facts.source_files[k]);
  assert(data.date===date,'*',k+'_date','wrong source date');
  assert(data.stat==='OK','*',k+'_status','official stat not OK');
  assert(Array.isArray(data.data)&&Array.isArray(data.fields),'*',k+'_schema','missing rows or fields');
  const fields=data.fields.map(v=>String(v).replace(/\s/g,''));
  const codeIndex=fields.findIndex(x=>x==='證券代號'||x==='股票代號');
  if(codeIndex<0)throw Error('missing stock code field');
  // The T86 dealer total is NOT its last net-buy/sell column: that can be
  // the hedging-only subtotal. Resolve the named total or both components.
  const named=(name)=>fields.indexOf(name);
  let netForRow;
  if(k==='dealer'){
   const total=named('自營商買賣超股數');
   const own=named('自營商買賣超股數(自行買賣)');
   const hedge=named('自營商買賣超股數(避險)');
   if(total>=0){sourceColumnMapping[k]={mode:'named_total',fields:[fields[total]]};netForRow=row=>num(row[total]);}
   else if(own>=0&&hedge>=0){sourceColumnMapping[k]={mode:'component_sum',fields:[fields[own],fields[hedge]]};netForRow=row=>{
    const a=num(row[own]),b=num(row[hedge]);
    return a==null||b==null?null:a+b;
   };}
   else throw Error('dealer total or both dealer components unavailable: '+fields.filter(x=>x.includes('買賣超股數')).join('|'));
  }else{
   const indices=fields.flatMap((x,i)=>x.includes('買賣超股數')?[i]:[]);
   if(indices.length!==1)throw Error(k+' ambiguous net-buy/sell columns: '+indices.map(i=>fields[i]).join('|'));
   sourceColumnMapping[k]={mode:'unique_net_column',fields:[fields[indices[0]]]};
   netForRow=row=>num(row[indices[0]]);
  }
  src[k]=new Map(data.data.filter(Array.isArray).map(row=>[String(row[codeIndex]||'').trim(),netForRow(row)]));
 }catch(e){errors.push(k+' invalid: '+e.message);src[k]=null}
}
function parseCsv(line){const a=[];let v='',q=false;for(let i=0;i<line.length;i++){const c=line[i];if(c==='"'){if(q&&line[i+1]==='"'){v+='"';i++}else q=!q}else if(c===','&&!q){a.push(v);v=''}else v+=c}a.push(v);return a}
let margins=null;
try{const rows=read(facts.source_files.margin).toString('utf8').trim().split(/\r?\n/).map(parseCsv),head=rows.shift();margins=new Map(rows.map(r=>[String(r[head.indexOf('股票代號')]||'').trim(),Object.fromEntries(head.map((k,i)=>[k,r[i]]))]));}catch(e){errors.push('margin invalid: '+e.message)}
for(const s of facts.stocks){
 const code=String(s.code),raw=byCode.get(code);
 assert(!!raw,code,'stock_identity','not in daily list');if(!raw)continue;
 for(const f of ['previous_close','open','high','low','close','volume','change_pct'])assert(num(s.price[f])===num(raw[f]),code,'price.'+f,'Facts differs from daily list');
 for(const [key,actor] of [['foreign','foreign'],['investment_trust','investment_trust'],['dealer','dealer']]){
  const row=src[key],value=row?.get(code),item=s.flow[actor];
  if(!row){assert(false,code,actor,'source not readable');continue}
  const status=!row.has(code)?'no_record':value===0?'zero_net':'reported';
  assert(item.record_status===status,code,actor+'.record_status','Facts status differs from official rows');
  assert(item.net_shares===(row.has(code)?value:null),code,actor+'.net_shares','Facts shares differ from official rows');
  assert(item.net_lots===(value==null?null:Math.round(value/1000)),code,actor+'.net_lots','Facts lots differ from shares');
 }
 const m=margins?.get(code),f=s.flow.margin;
 if(!m){assert(false,code,'margin','official margin row unavailable');continue}
 for(const [field,col] of [['margin_prev','融資前日餘額'],['margin_now','融資今日餘額'],['short_prev','融券前日餘額'],['short_now','融券今日餘額']])assert(f[field]===num(m[col]),code,'margin.'+field,'Facts differs from official margin');
 assert(f.margin_delta===num(m['融資今日餘額'])-num(m['融資前日餘額']),code,'margin.margin_delta','delta mismatch');
 assert(f.short_delta===num(m['融券今日餘額'])-num(m['融券前日餘額']),code,'margin.short_delta','delta mismatch');
}
const report={schema_version:'official-numeric-receipt-v1',target_date:date,status:errors.length?'FAIL':'PASS',checked_at:new Date().toISOString(),workflow:{run_id:process.env.GITHUB_RUN_ID||null,run_attempt:process.env.GITHUB_RUN_ATTEMPT||null,job:process.env.GITHUB_JOB||null,sha:process.env.GITHUB_SHA||null,url:process.env.GITHUB_RUN_ID?'https://github.com/'+process.env.GITHUB_REPOSITORY+'/actions/runs/'+process.env.GITHUB_RUN_ID:null},source_sha256:files,source_column_mapping:sourceColumnMapping,stock_count:facts.stocks.length,check_count:checks.length,failed_count:errors.length,checks,errors};
const out='data_daily_gain_over_5/verification/official-numeric/'+date+'.json';
fs.mkdirSync(path.dirname(path.join(root,out)),{recursive:true});fs.writeFileSync(path.join(root,out),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({out,status:report.status,checks:checks.length,errors:errors.slice(0,20)},null,2));
if(errors.length)process.exitCode=1;
