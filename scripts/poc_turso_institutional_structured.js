#!/usr/bin/env node
'use strict';
const fs=require('node:fs'),path=require('node:path');
const {createClient}=require('@libsql/client');
const dir='data_twse_institutional_investors';
const names=fs.readdirSync(dir).filter(n=>/^\d{8}_twse_institutional_investors\.json$/.test(n)).sort().slice(-20);
const mappings={
  foreign_buy:/^外陸資買進股數/,
  foreign_sell:/^外陸資賣出股數/,
  foreign_net:/^外陸資買賣超股數/,
  trust_buy:/^投信買進股數/,
  trust_sell:/^投信賣出股數/,
  trust_net:/^投信買賣超股數/,
  dealer_net:/^自營商買賣超股數$/,
  total_net:/^三大法人買賣超股數$/
};
const keys=Object.keys(mappings);
const cols=['trade_date','stock_id',...keys];
const table='turso_poc_equity_structured_v3';
const fail=(msg)=>{throw Error(msg)};
const verify=(x,msg)=>{if(!x)fail(msg)};
const number=(value)=>{
 if(value==null||String(value).trim()===''||String(value).trim()==='--') return null;
 const s=String(value).trim().replace(/,/g,'');
 verify(/^[+-]?\d+$/.test(s) && Number.isSafeInteger(Number(s)),'Bad numeric value '+JSON.stringify(value));
 return Number(s);
};
const db=createClient({url:process.env.TURSO_DATABASE_URL,authToken:process.env.TURSO_AUTH_TOKEN});
const source=names.map(filename=>{
 const raw=fs.readFileSync(path.join(dir,filename));
 const p=JSON.parse(raw.toString('utf8'));
 verify(p.date===filename.slice(0,8)&&Array.isArray(p.fields)&&Array.isArray(p.data),'Malformed source '+filename);
 const ix={};
 for(const [key,re] of Object.entries(mappings)){
   const matched=p.fields.map((f,i)=>re.test(String(f).trim())?i:-1).filter(i=>i>=0);
   verify(matched.length===1,'Ambiguous or missing field '+key+' '+filename+': '+JSON.stringify(p.fields));
   ix[key]=matched[0];
 }
 const ids=p.fields.map((f,i)=>/證券代號|股票代號|證券代碼/.test(String(f))?i:-1).filter(i=>i>=0);
 verify(ids.length===1,'Stock ID field not unique '+filename);
 const found=new Map();
 for(const values of p.data){
  verify(Array.isArray(values)&&values.length===p.fields.length,'Row width mismatch '+filename);
  const id=String(values[ids[0]]).trim();
  if(!/^[1-9]\d{3}$/.test(id))continue;
  verify(!found.has(id),'Duplicate stock '+id+' '+filename);
  const row={trade_date:p.date,stock_id:id};
  for(const k of keys)row[k]=number(values[ix[k]]);
  found.set(id,row);
 }
 verify(found.size>700&&found.size<2000,'Suspicious stock count '+found.size+' '+filename);
 return {date:p.date,rows:[...found.values()],rawBytes:raw.length,ignored:p.data.length-found.size,mapping:Object.fromEntries(Object.entries(ix).map(([k,v])=>[k,p.fields[v]]))};
});
async function main(){
 verify(process.env.TURSO_DATABASE_URL&&process.env.TURSO_AUTH_TOKEN,'Missing secrets');
 const connected=await db.execute('SELECT 1 AS ok');verify(Number(connected.rows[0].ok)===1,'Connectivity failed');
 console.log('[TURSO-V3] CONNECT_SUCCESS');
 await db.execute('CREATE TABLE IF NOT EXISTS '+table+' (trade_date TEXT NOT NULL,stock_id TEXT NOT NULL,foreign_buy INTEGER,foreign_sell INTEGER,foreign_net INTEGER,trust_buy INTEGER,trust_sell INTEGER,trust_net INTEGER,dealer_net INTEGER,total_net INTEGER,PRIMARY KEY(trade_date,stock_id))');
 await db.execute('CREATE INDEX IF NOT EXISTS '+table+'_stock_date ON '+table+'(stock_id,trade_date)');
 await db.execute('CREATE TABLE IF NOT EXISTS turso_poc_equity_structured_sources_v3 (trade_date TEXT PRIMARY KEY,columns_mapping TEXT NOT NULL,source_bytes INTEGER NOT NULL,eligible_rows INTEGER NOT NULL)');
 const stmt='INSERT INTO '+table+'('+cols.join(',')+') VALUES('+cols.map(()=>'?').join(',')+') ON CONFLICT(trade_date,stock_id) DO UPDATE SET '+keys.map(k=>k+'=excluded.'+k).join(',');
 let total=0,rawBytes=0,selectedJsonBytes=0;
 const exported=fs.createWriteStream('/tmp/turso-v3.ndjson');
 for(const item of source){
  for(let i=0;i<item.rows.length;i+=100){
   await db.batch(item.rows.slice(i,i+100).map(row=>({sql:stmt,args:cols.map(k=>row[k])})),'write');
  }
  await db.execute({sql:'INSERT INTO turso_poc_equity_structured_sources_v3(trade_date,columns_mapping,source_bytes,eligible_rows) VALUES(?,?,?,?) ON CONFLICT(trade_date) DO UPDATE SET columns_mapping=excluded.columns_mapping,source_bytes=excluded.source_bytes,eligible_rows=excluded.eligible_rows',args:[item.date,JSON.stringify(item.mapping),item.rawBytes,item.rows.length]});
  const count=await db.execute({sql:'SELECT COUNT(*) AS n FROM '+table+' WHERE trade_date=?',args:[item.date]});
  verify(Number(count.rows[0].n)===item.rows.length,'Day count mismatch '+item.date);
  const sample=item.rows[Math.floor(item.rows.length/2)];
  const check=await db.execute({sql:'SELECT '+keys.join(',')+' FROM '+table+' WHERE trade_date=? AND stock_id=?',args:[item.date,sample.stock_id]});
  verify(check.rows.length===1,'Sample missing '+item.date);
  for(const k of keys)verify(check.rows[0][k]===sample[k],'Roundtrip mismatch '+k+' '+item.date);
  for(const row of item.rows){const line=JSON.stringify(row)+'\n';exported.write(line);selectedJsonBytes+=Buffer.byteLength(line);}
  total+=item.rows.length;rawBytes+=item.rawBytes;
  console.log('[TURSO-V3] '+item.date+': PASS '+item.rows.length+' four-digit securities; excluded '+item.ignored+' other instruments');
 }
 await new Promise(resolve=>exported.end(resolve));
 const first=source[0].rows[0];
 await db.execute({sql:stmt,args:cols.map(k=>first[k])});
 const count=await db.execute({sql:'SELECT COUNT(*) AS n FROM '+table+' WHERE trade_date=? AND stock_id=?',args:[first.trade_date,first.stock_id]});
 verify(Number(count.rows[0].n)===1,'Idempotency failed');
 const recent=await db.execute({sql:'SELECT trade_date,foreign_net,trust_net,dealer_net FROM '+table+' WHERE stock_id=? ORDER BY trade_date DESC LIMIT 30',args:['2330']});
 verify(recent.rows.length>=1,'2330 history absent');
 const top=await db.execute({sql:'SELECT stock_id,foreign_net FROM '+table+' WHERE trade_date=? AND foreign_net IS NOT NULL ORDER BY foreign_net DESC LIMIT 5',args:[source.at(-1).date]});
 verify(top.rows.length===5,'Top five query failed');
 console.log('[TURSO-V3] QUERY_PASS 2330_days='+recent.rows.length+' top_foreign='+top.rows.length);
 console.log('[TURSO-V3] IDEMPOTENCY_PASS');
 console.log('[TURSO-V3] V3_SUCCESS '+JSON.stringify({days:source.length,rows:total,rawSourceBytes:rawBytes,selectedJsonBytes,firstDate:source[0].date,lastDate:source.at(-1).date,scope:'four-digit instruments only; not a formal common-share security master',columns:keys}));
}
main().catch(e=>{console.error('[TURSO-V3] FAILED '+e.stack);process.exitCode=1}).finally(()=>db.close());
