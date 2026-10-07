#!/usr/bin/env node
'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {createClient}=require('@libsql/client');
const ROOT=path.resolve(__dirname,'..');
const DIR=path.join(ROOT,'data_twse_institutional_investors');
const DATES=['20260904','20260907','20260908','20260909','20260910','20260911','20260914','20260915','20260916','20260917','20260918','20260921','20260922','20260923','20260924','20260929','20260930','20261001','20261002','20261005'];
const EXPECTED_ROWS=21475;
const TABLE='turso_shadow_twse_institutional_v1';
const SOURCE_TABLE='turso_shadow_twse_institutional_sources_v1';
const MAP={
 foreign_buy:/^外陸資買進股數/,
 foreign_sell:/^外陸資賣出股數/,
 foreign_net:/^外陸資買賣超股數/,
 foreign_dealer_net:/^外資自營商買賣超股數/,
 trust_buy:/^投信買進股數/,
 trust_sell:/^投信賣出股數/,
 trust_net:/^投信買賣超股數/,
 dealer_net:/^自營商買賣超股數$/,
 total_net:/^三大法人買賣超股數$/
};
const KEYS=Object.keys(MAP), COLS=['trade_date','stock_id',...KEYS];
const fail=m=>{throw Error(m)}, verify=(x,m)=>{if(!x)fail(m)};
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const num=v=>{if(v==null||String(v).trim()===''||String(v).trim()==='--')return null;const s=String(v).trim().replace(/,/g,'');verify(/^[+-]?\d+$/.test(s)&&Number.isSafeInteger(Number(s)),'bad numeric '+JSON.stringify(v));return Number(s)};
const rowHash=rows=>{const h=crypto.createHash('sha256');for(const r of rows)h.update(COLS.map(k=>r[k]===null?'NULL':String(r[k])).join('|')+'\n');return h.digest('hex')};
const db=createClient({url:process.env.TURSO_DATABASE_URL,authToken:process.env.TURSO_AUTH_TOKEN});

function load(){
 const out=[]; let total=0;
 for(const date of DATES){
  const file=path.join(DIR,date+'_twse_institutional_investors.json');
  const raw=fs.readFileSync(file); const p=JSON.parse(raw);
  verify(p.date===date&&Array.isArray(p.fields)&&Array.isArray(p.data),'bad source '+date);
  const idHits=p.fields.map((f,i)=>/證券代號|股票代號|證券代碼/.test(String(f))?i:-1).filter(i=>i>=0);
  verify(idHits.length===1,'id field mismatch '+date);
  const ix={};
  for(const [k,re] of Object.entries(MAP)){
   const hits=p.fields.map((f,i)=>re.test(String(f).trim())?i:-1).filter(i=>i>=0);
   verify(hits.length===1,'field mismatch '+k+' '+date); ix[k]=hits[0];
  }
  const seen=new Set(), rows=[];
  for(const a of p.data){
   const id=String(a[idHits[0]]??'').trim();
   if(!/^[1-9]\d{3}$/.test(id))continue;
   verify(!seen.has(id),'duplicate '+id+' '+date); seen.add(id);
   const r={trade_date:date,stock_id:id}; for(const k of KEYS)r[k]=num(a[ix[k]]); rows.push(r);
  }
  rows.sort((a,b)=>a.stock_id.localeCompare(b.stock_id)); total+=rows.length;
  out.push({date,rows,source_sha256:sha(raw),row_hash:rowHash(rows),source_bytes:raw.length});
 }
 verify(total===EXPECTED_ROWS,'row count changed '+total);
 return out;
}
async function scalar(sql,args=[]){const r=await db.execute({sql,args});return Number(Object.values(r.rows[0]||{n:0})[0])}
async function setup(){
 await db.execute('CREATE TABLE IF NOT EXISTS '+TABLE+' (trade_date TEXT NOT NULL,stock_id TEXT NOT NULL,foreign_buy INTEGER,foreign_sell INTEGER,foreign_net INTEGER,foreign_dealer_net INTEGER,trust_buy INTEGER,trust_sell INTEGER,trust_net INTEGER,dealer_net INTEGER,total_net INTEGER,PRIMARY KEY(trade_date,stock_id))');
 await db.execute('CREATE INDEX IF NOT EXISTS '+TABLE+'_stock_date ON '+TABLE+'(stock_id,trade_date)');
 await db.execute('CREATE TABLE IF NOT EXISTS '+SOURCE_TABLE+' (trade_date TEXT PRIMARY KEY,source_sha256 TEXT NOT NULL,row_hash TEXT NOT NULL,source_bytes INTEGER NOT NULL,eligible_rows INTEGER NOT NULL)');
}
async function writePass(source,label){
 const stmt='INSERT INTO '+TABLE+'('+COLS.join(',')+') VALUES('+COLS.map(()=>'?').join(',')+') ON CONFLICT(trade_date,stock_id) DO UPDATE SET '+KEYS.map(k=>k+'=excluded.'+k).join(',');
 for(const item of source){
  for(let i=0;i<item.rows.length;i+=100) await db.batch(item.rows.slice(i,i+100).map(r=>({sql:stmt,args:COLS.map(k=>r[k])})),'write');
  await db.execute({sql:'INSERT INTO '+SOURCE_TABLE+'(trade_date,source_sha256,row_hash,source_bytes,eligible_rows) VALUES(?,?,?,?,?) ON CONFLICT(trade_date) DO UPDATE SET source_sha256=excluded.source_sha256,row_hash=excluded.row_hash,source_bytes=excluded.source_bytes,eligible_rows=excluded.eligible_rows',args:[item.date,item.source_sha256,item.row_hash,item.source_bytes,item.rows.length]});
 }
 const count=await scalar('SELECT COUNT(*) FROM '+TABLE+' WHERE trade_date>=? AND trade_date<=?',[DATES[0],DATES.at(-1)]);
 verify(count===EXPECTED_ROWS,label+' count '+count);
}
async function verifyParity(source,label){
 let rows=0,negative=0,nulls=0; const hashes={};
 for(const item of source){
  const r=await db.execute({sql:'SELECT '+COLS.join(',')+' FROM '+TABLE+' WHERE trade_date=? ORDER BY stock_id',args:[item.date]});
  verify(r.rows.length===item.rows.length,label+' day count '+item.date);
  const actual=r.rows.map(x=>Object.fromEntries(COLS.map(k=>[k,(k==='trade_date'||k==='stock_id')?String(x[k]):(x[k]==null?null:Number(x[k]))])));
  for(let i=0;i<actual.length;i++)for(const k of COLS){verify(actual[i][k]===item.rows[i][k],label+' mismatch '+item.date+' '+i+' '+k);if(typeof actual[i][k]==='number'&&actual[i][k]<0)negative++;if(actual[i][k]===null)nulls++;}
  hashes[item.date]=rowHash(actual); verify(hashes[item.date]===item.row_hash,label+' hash '+item.date); rows+=actual.length;
 }
 return {rows,negative_values:negative,null_values:nulls,per_date_hashes:hashes};
}
async function main(){
 verify(process.env.TURSO_DATABASE_URL&&process.env.TURSO_AUTH_TOKEN,'missing Turso secrets');
 const source=load(); await setup();
 await writePass(source,'PASS1'); const p1=await verifyParity(source,'PASS1');
 const count1=await scalar('SELECT COUNT(*) FROM '+TABLE);
 await writePass(source,'PASS2_REPLAY'); const p2=await verifyParity(source,'PASS2_REPLAY');
 const count2=await scalar('SELECT COUNT(*) FROM '+TABLE);
 verify(count1===count2&&count2===EXPECTED_ROWS,'replay row count drift');
 verify(JSON.stringify(p1.per_date_hashes)===JSON.stringify(p2.per_date_hashes),'replay hash drift');
 const meta=await db.execute('SELECT trade_date,source_sha256,row_hash,eligible_rows FROM '+SOURCE_TABLE+' ORDER BY trade_date');
 verify(meta.rows.length===20,'metadata date count');
 const report={schema:'turso_phase10_shadow_write_v1',table:TABLE,source_table:SOURCE_TABLE,frozen_dates:DATES,rows:EXPECTED_ROWS,source_identity:source.map(x=>({date:x.date,source_sha256:x.source_sha256,row_hash:x.row_hash,eligible_rows:x.rows.length})),pass1:p1,pass2_replay:p2,idempotent_counts:{before_replay:count1,after_replay:count2},canonical_source_of_truth:true,independent_twse_refetch:false,production_mutation:false};
 fs.writeFileSync('/tmp/turso-phase10-shadow-write.json',JSON.stringify(report,null,2));
 console.log('[TURSO-PHASE10] SHADOW_WRITE_PASS '+JSON.stringify({dates:20,rows:EXPECTED_ROWS,table:TABLE,replay:[count1,count2]}));
}
main().catch(e=>{console.error('[TURSO-PHASE10] SHADOW_WRITE_FAILED '+e.stack);process.exitCode=1}).finally(()=>db.close());
