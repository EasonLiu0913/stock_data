#!/usr/bin/env node
'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {createClient}=require('@libsql/client');
const {getTradingDayStatus}=require('./lib/twse_trading_day');

const ROOT=path.resolve(__dirname,'..');
const CANONICAL_ROOT=path.resolve(process.env.CANONICAL_ROOT||ROOT);
const AUTH_DATE='20261006';
const DATA_TABLE='turso_live_shadow_twse_institutional_v1';
const LEDGER_TABLE='turso_live_shadow_evidence_v1';
const EVENT_TABLE='turso_live_shadow_events_v1';
const TARGET=String(process.env.PHASE11_TARGET_DATE||'').trim();
const MATCH={
 foreign_buy:/^外陸資買進股數/,foreign_sell:/^外陸資賣出股數/,foreign_net:/^外陸資買賣超股數/,
 foreign_dealer_net:/^外資自營商買賣超股數/,trust_buy:/^投信買進股數/,trust_sell:/^投信賣出股數/,
 trust_net:/^投信買賣超股數/,dealer_net:/^自營商買賣超股數$/,total_net:/^三大法人買賣超股數$/
};
const KEYS=Object.keys(MATCH),COLS=['trade_date','stock_id',...KEYS];
const fail=m=>{throw Error(m)},verify=(x,m)=>{if(!x)fail(m)};
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const num=v=>{if(v==null||String(v).trim()===''||String(v).trim()==='--')return null;const s=String(v).trim().replace(/,/g,'');verify(/^[+-]?\d+$/.test(s)&&Number.isSafeInteger(Number(s)),'bad numeric '+JSON.stringify(v));return Number(s)};
const rowHash=rows=>{const h=crypto.createHash('sha256');for(const r of rows)h.update(COLS.map(k=>r[k]===null?'NULL':String(r[k])).join('|')+'\n');return h.digest('hex')};
const db=createClient({url:process.env.TURSO_DATABASE_URL,authToken:process.env.TURSO_AUTH_TOKEN});

function listCanonicalDates(){
 const dir=path.join(CANONICAL_ROOT,'data_twse_institutional_investors');
 return fs.readdirSync(dir).map(n=>n.match(/^(20\d{6})_twse_institutional_investors\.json$/)?.[1]).filter(Boolean).sort();
}
function resolveTarget(){
 if(TARGET){verify(/^20\d{6}$/.test(TARGET),'bad PHASE11_TARGET_DATE');return TARGET;}
 const eligible=listCanonicalDates().filter(d=>d>=AUTH_DATE);
 verify(eligible.length>0,'WAITING_NO_POST_AUTH_CANONICAL_DATE');
 return eligible.at(-1);
}
function loadSource(date){
 verify(date>=AUTH_DATE,'PRE_AUTHORIZATION_DATE');
 const calendarPath=path.join(CANONICAL_ROOT,'config','twse_non_trading_days.json');
 const td=getTradingDayStatus(date,{calendarPath});
 verify(td.calendarCovered,'TRADING_CALENDAR_UNCOVERED '+date);
 verify(td.isTradingDay,'NOT_ELIGIBLE_TRADING_DAY '+td.reason);
 const file=path.join(CANONICAL_ROOT,'data_twse_institutional_investors',date+'_twse_institutional_investors.json');
 verify(fs.existsSync(file),'MISSING_CANONICAL_FILE '+date);
 const raw=fs.readFileSync(file),p=JSON.parse(raw);
 verify(p.date===date&&Array.isArray(p.fields)&&Array.isArray(p.data),'MALFORMED_CANONICAL '+date);
 const idHits=p.fields.map((f,i)=>/證券代號|股票代號|證券代碼/.test(String(f))?i:-1).filter(i=>i>=0);verify(idHits.length===1,'ID_FIELD_MISMATCH');
 const ix={};for(const [k,re] of Object.entries(MATCH)){const hits=p.fields.map((f,i)=>re.test(String(f).trim())?i:-1).filter(i=>i>=0);verify(hits.length===1,'FIELD_MISMATCH '+k);ix[k]=hits[0]}
 const seen=new Set(),rows=[];
 for(const a of p.data){const id=String(a[idHits[0]]??'').trim();if(!/^[1-9]\d{3}$/.test(id))continue;verify(!seen.has(id),'DUPLICATE_SECURITY '+id);seen.add(id);const r={trade_date:date,stock_id:id};for(const k of KEYS)r[k]=num(a[ix[k]]);rows.push(r)}
 rows.sort((a,b)=>a.stock_id.localeCompare(b.stock_id));
 verify(rows.length>700&&rows.length<2000,'SUSPICIOUS_ROW_COUNT '+rows.length);
 return {date,rows,source_sha256:sha(raw),contract_hash:rowHash(rows),trading_day:td};
}
function csvCodes(rel){const lines=fs.readFileSync(path.join(CANONICAL_ROOT,rel),'utf8').trim().split(/\r?\n/).filter(Boolean);verify(lines[0]==='Code,Name,Industry','CATEGORY_HEADER '+rel);return new Set(lines.slice(1).map(x=>x.slice(0,x.indexOf(',')).trim()).filter(Boolean))}
function classify(rows){
 const cats={stock:'data_twse/twse_industry_Stock.csv',tdr:'data_twse/twse_industry_TDR.csv',innovation_board:'data_twse/twse_industry_InnovationBoard.csv',etf:'data_twse/twse_industry_ETF.csv',etn:'data_twse/twse_industry_ETN.csv',preferred_stock:'data_twse/twse_industry_PreferredStock.csv',reit:'data_twse/twse_industry_REITs.csv',warrant:'data_twse/twse_industry_Warrants.csv'};
 const sets=Object.fromEntries(Object.entries(cats).map(([k,v])=>[k,csvCodes(v)])),counts={},unmatched=[],ambiguous=[];
 for(const id of new Set(rows.map(r=>r.stock_id))){const hits=Object.entries(sets).filter(([,s])=>s.has(id)).map(([k])=>k);if(!hits.length)unmatched.push(id);else if(hits.length!==1)ambiguous.push({id,hits});else counts[hits[0]]=(counts[hits[0]]||0)+1}
 verify(!unmatched.length,'UNMATCHED_INSTRUMENT '+unmatched.join(','));verify(!ambiguous.length,'AMBIGUOUS_INSTRUMENT '+JSON.stringify(ambiguous));
 return {unique_counts:counts,unmatched,ambiguous};
}
async function setup(){
 await db.execute('CREATE TABLE IF NOT EXISTS '+DATA_TABLE+' (trade_date TEXT NOT NULL,stock_id TEXT NOT NULL,foreign_buy INTEGER,foreign_sell INTEGER,foreign_net INTEGER,foreign_dealer_net INTEGER,trust_buy INTEGER,trust_sell INTEGER,trust_net INTEGER,dealer_net INTEGER,total_net INTEGER,PRIMARY KEY(trade_date,stock_id))');
 await db.execute('CREATE TABLE IF NOT EXISTS '+LEDGER_TABLE+' (trade_date TEXT PRIMARY KEY,source_sha256 TEXT NOT NULL,row_count INTEGER NOT NULL,contract_hash TEXT NOT NULL,instrument_summary_json TEXT NOT NULL,accepted_at TEXT NOT NULL)');
 await db.execute('CREATE TABLE IF NOT EXISTS '+EVENT_TABLE+' (event_key TEXT PRIMARY KEY,trade_date TEXT NOT NULL,classification TEXT NOT NULL,detail TEXT NOT NULL,recorded_at TEXT NOT NULL)');
}
async function writeAndVerify(src){
 const stmt='INSERT INTO '+DATA_TABLE+'('+COLS.join(',')+') VALUES('+COLS.map(()=>'?').join(',')+') ON CONFLICT(trade_date,stock_id) DO UPDATE SET '+KEYS.map(k=>k+'=excluded.'+k).join(',');
 for(let i=0;i<src.rows.length;i+=100)await db.batch(src.rows.slice(i,i+100).map(r=>({sql:stmt,args:COLS.map(k=>r[k])})),'write');
 const r=await db.execute({sql:'SELECT '+COLS.join(',')+' FROM '+DATA_TABLE+' WHERE trade_date=? ORDER BY stock_id',args:[src.date]});
 verify(r.rows.length===src.rows.length,'PARITY_ROW_COUNT');
 const actual=r.rows.map(x=>Object.fromEntries(COLS.map(k=>[k,(k==='trade_date'||k==='stock_id')?String(x[k]):(x[k]==null?null:Number(x[k]))])));
 for(let i=0;i<actual.length;i++)for(const k of COLS)verify(actual[i][k]===src.rows[i][k],'PARITY_MISMATCH '+i+' '+k);
 const h=rowHash(actual);verify(h===src.contract_hash,'PARITY_HASH_MISMATCH');
 return {rows:actual.length,hash:h};
}
async function acceptedCount(){const r=await db.execute('SELECT COUNT(*) AS n FROM '+LEDGER_TABLE);return Number(r.rows[0].n)}
async function main(){
 verify(process.env.TURSO_DATABASE_URL&&process.env.TURSO_AUTH_TOKEN,'MISSING_TURSO_SECRETS');
 const date=resolveTarget();const src=loadSource(date);const types=classify(src.rows);await setup();
 const before=await acceptedCount();const parity=await writeAndVerify(src);
 const acceptedAt=new Date().toISOString();
 await db.execute({sql:'INSERT INTO '+LEDGER_TABLE+'(trade_date,source_sha256,row_count,contract_hash,instrument_summary_json,accepted_at) VALUES(?,?,?,?,?,?) ON CONFLICT(trade_date) DO NOTHING',args:[date,src.source_sha256,src.rows.length,src.contract_hash,JSON.stringify(types),acceptedAt]});
 const after=await acceptedCount();
 verify(after===before||after===before+1,'LEDGER_COUNT_INVALID');
 const duplicate=after===before;
 const eventKey=sha(Buffer.from([date,'accepted',src.source_sha256,src.contract_hash].join('|')));
 await db.execute({sql:'INSERT INTO '+EVENT_TABLE+'(event_key,trade_date,classification,detail,recorded_at) VALUES(?,?,?,?,?) ON CONFLICT(event_key) DO NOTHING',args:[eventKey,date,duplicate?'duplicate_accepted_date':'accepted',JSON.stringify({source_sha256:src.source_sha256,row_count:src.rows.length,contract_hash:src.contract_hash}),acceptedAt]});
 const report={schema:'turso_phase11_live_shadow_collect_v1',authorization_date:AUTH_DATE,target_date:date,canonical_root:path.relative(ROOT,CANONICAL_ROOT)||'.',canonical_source_of_truth:true,independent_twse_refetch:false,trading_day:src.trading_day,source_sha256:src.source_sha256,row_count:src.rows.length,contract_hash:src.contract_hash,parity,instrument_type_coverage:types,ledger:{accepted_before:before,accepted_after:after,duplicate,remaining_to_20:Math.max(0,20-after)},tables:{data:DATA_TABLE,ledger:LEDGER_TABLE,events:EVENT_TABLE},production_behavior_changed:false};
 fs.writeFileSync('/tmp/turso-phase11-live-shadow-collect.json',JSON.stringify(report,null,2));
 console.log('[TURSO-PHASE11] LIVE_COLLECT_PASS '+JSON.stringify({date,rows:src.rows.length,accepted:after,remaining:Math.max(0,20-after),duplicate,hash:src.contract_hash,categories:types.unique_counts}));
}
main().catch(async e=>{const msg=String(e.message||e);console.error('[TURSO-PHASE11] LIVE_COLLECT_FAILED '+msg);try{if(process.env.TURSO_DATABASE_URL&&process.env.TURSO_AUTH_TOKEN){await setup();const date=TARGET||AUTH_DATE;const key=sha(Buffer.from(date+'|'+msg));await db.execute({sql:'INSERT INTO '+EVENT_TABLE+'(event_key,trade_date,classification,detail,recorded_at) VALUES(?,?,?,?,?) ON CONFLICT(event_key) DO NOTHING',args:[key,date,msg.split(' ')[0].toLowerCase(),msg,new Date().toISOString()]})}}catch{}process.exitCode=1}).finally(()=>db.close());
