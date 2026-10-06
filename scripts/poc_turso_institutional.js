#!/usr/bin/env node
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { createClient } = require('@libsql/client');

const dir = path.resolve('data_twse_institutional_investors');
const maxDays = Math.min(60, Math.max(1, Number(process.env.POC_DAYS || 20)));
const list = fs.readdirSync(dir).filter(n => /^\d{8}_twse_institutional_investors\.json$/.test(n)).sort().slice(-maxDays);
if (!process.env.TURSO_DATABASE_URL || !process.env.TURSO_AUTH_TOKEN) {
  console.error('MISSING_SECRET: Set TURSO_DATABASE_URL and TURSO_AUTH_TOKEN in GitHub Actions secrets.');
  process.exit(1);
}
if (list.length < 2) throw Error('Not enough historical JSON files for POC');

const db = createClient({url: process.env.TURSO_DATABASE_URL, authToken: process.env.TURSO_AUTH_TOKEN});
const out = (s) => console.log('[TURSO-POC] ' + s);
async function scalar(sql,args=[]) {const r=await db.execute({sql,args});return Number(r.rows[0]?.[0] ?? 0);}
async function pages() {
  try { return (await scalar('PRAGMA page_count')) * (await scalar('PRAGMA page_size')); }
  catch(e) {out('Logical SQLite byte size not available: '+e.message);return null;}
}
async function main(){
  const ping=await db.execute('SELECT 1 AS connected');
  if (Number(ping.rows[0].connected)!==1) throw Error('Connectivity check failed');
  out('CONNECT_SUCCESS: SELECT 1');
  await db.execute(`CREATE TABLE IF NOT EXISTS turso_poc_institutional (
    trade_date TEXT NOT NULL,
    stock_id TEXT NOT NULL,
    row_json TEXT NOT NULL,
    PRIMARY KEY (trade_date, stock_id)
  )`);
  await db.execute(`CREATE INDEX IF NOT EXISTS turso_poc_institutional_stock_date
    ON turso_poc_institutional(stock_id, trade_date)`);
  await db.execute(`CREATE TABLE IF NOT EXISTS turso_poc_source (
    trade_date TEXT PRIMARY KEY,
    fields_json TEXT NOT NULL,
    raw_bytes INTEGER NOT NULL,
    stock_count INTEGER NOT NULL
  )`);
  const before=await pages();
  let rawBytes=0, totalRows=0, passed=0; const dates=[];
  for(const filename of list){
    const original=fs.readFileSync(path.join(dir,filename));
    const p=JSON.parse(original.toString('utf8'));
    if(!Array.isArray(p.fields)||!Array.isArray(p.data)||!/^\d{8}$/.test(String(p.date))) throw Error('Invalid payload: '+filename);
    const expected=filename.slice(0,8);
    if(p.date!==expected) throw Error('Date mismatch: '+filename+' payload='+p.date);
    const stockIdx=p.fields.findIndex(f=>/證券代號|股票代號|證券代碼/.test(String(f)));
    if(stockIdx<0) throw Error('Missing stock ID column: '+filename+' fields='+JSON.stringify(p.fields));
    const records = new Map();
    for(const row of p.data){
      if(!Array.isArray(row)||row.length!==p.fields.length) throw Error('Field length mismatch: '+filename);
      const id=String(row[stockIdx]).trim();
      if(!/^\d{4,6}[A-Za-z]?$/.test(id)) continue; // filter non-stock rows (if present)
      if(records.has(id)) throw Error('Duplicate stock ID in '+filename+': '+id);
      records.set(id,JSON.stringify(row));
    }
    if(!records.size) throw Error('No eligible stocks in '+filename);
    const entries=[...records];
    for(let i=0;i<entries.length;i+=100){
      const batch=entries.slice(i,i+100).map(([stock_id,row_json])=>({
        sql:`INSERT INTO turso_poc_institutional(trade_date,stock_id,row_json) VALUES(?,?,?)
          ON CONFLICT(trade_date,stock_id) DO UPDATE SET row_json=excluded.row_json`,
        args:[expected,stock_id,row_json]
      }));
      await db.batch(batch,'write');
    }
    await db.execute({sql:`INSERT INTO turso_poc_source(trade_date,fields_json,raw_bytes,stock_count) VALUES(?,?,?,?)
      ON CONFLICT(trade_date) DO UPDATE SET fields_json=excluded.fields_json,raw_bytes=excluded.raw_bytes,stock_count=excluded.stock_count`,
      args:[expected,JSON.stringify(p.fields),original.length,records.size]});
    const actual=await scalar('SELECT COUNT(*) FROM turso_poc_institutional WHERE trade_date=?',[expected]);
    if(actual!==records.size) throw Error('Row count mismatch '+expected+': '+actual+'/'+records.size);
    const sample=entries[Math.floor(entries.length/2)];
    const read=await db.execute({sql:'SELECT row_json FROM turso_poc_institutional WHERE trade_date=? AND stock_id=?',args:[expected,sample[0]]});
    if(read.rows.length!==1||read.rows[0].row_json!==sample[1]) throw Error('Round-trip mismatch '+expected);
    passed++;rawBytes+=original.length;totalRows+=records.size;dates.push(expected);
    out(expected+': PASS '+actual+' stocks');
  }
  // Idempotency: replay an existing row and confirm no duplicate
  const test=await db.execute({sql:'SELECT stock_id,row_json FROM turso_poc_institutional WHERE trade_date=? LIMIT 1',args:[dates[0]]});
  const e=test.rows[0];
  await db.execute({sql:`INSERT INTO turso_poc_institutional(trade_date,stock_id,row_json) VALUES(?,?,?)
    ON CONFLICT(trade_date,stock_id) DO UPDATE SET row_json=excluded.row_json`,args:[dates[0],e.stock_id,e.row_json]});
  const duplicate=await scalar('SELECT COUNT(*) FROM turso_poc_institutional WHERE trade_date=? AND stock_id=?',[dates[0],e.stock_id]);
  if(duplicate!==1) throw Error('Idempotency test failed');
  const after=await pages();
  out('IDEMPOTENCY_PASS');
  out('POC_SUCCESS '+JSON.stringify({days:passed,rows:totalRows,rawJsonBytes:rawBytes,dbLogicalBytesBefore:before,dbLogicalBytesAfter:after,dbLogicalDeltaBytes:before!==null&&after!==null?after-before:null,firstDate:dates[0],lastDate:dates.at(-1)}));
}
main().catch(e=>{console.error('[TURSO-POC] FAILED: '+e.stack);process.exitCode=1}).finally(()=>db.close());
