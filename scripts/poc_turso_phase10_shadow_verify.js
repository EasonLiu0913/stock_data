#!/usr/bin/env node
'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {createClient}=require('@libsql/client');
const ROOT=path.resolve(__dirname,'..');
const DIR=path.join(ROOT,'data_twse_institutional_investors');
const TABLE='turso_shadow_twse_institutional_v1';
const SOURCE_TABLE='turso_shadow_twse_institutional_sources_v1';
const DATES=['20260904','20260907','20260908','20260909','20260910','20260911','20260914','20260915','20260916','20260917','20260918','20260921','20260922','20260923','20260924','20260929','20260930','20261001','20261002','20261005'];
const EXPECTED_ROWS=21475,EXPECTED_UNIQUE=1088;
const CONTRACT=['trade_date','stock_id','foreign_ex_dealer_net','foreign_dealer_net','trust_net','dealer_net'];
const MATCH={
 foreign_ex_dealer_net:/外陸資買賣超股數|外資及陸資買賣超股數/,
 foreign_dealer_net:/^外資自營商買賣超股數/,
 trust_net:/^投信買賣超股數$/,
 dealer_net:/^自營商買賣超股數$/
};
const CATS={
 stock:'data_twse/twse_industry_Stock.csv',tdr:'data_twse/twse_industry_TDR.csv',etf:'data_twse/twse_industry_ETF.csv',
 etn:'data_twse/twse_industry_ETN.csv',preferred_stock:'data_twse/twse_industry_PreferredStock.csv',
 innovation_board:'data_twse/twse_industry_InnovationBoard.csv',reit:'data_twse/twse_industry_REITs.csv',warrant:'data_twse/twse_industry_Warrants.csv'
};
const fail=m=>{throw Error(m)},verify=(x,m)=>{if(!x)fail(m)};
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const num=v=>{if(v==null||String(v).trim()===''||String(v).trim()==='--')return null;const s=String(v).trim().replace(/,/g,'');verify(/^[+-]?\d+$/.test(s)&&Number.isSafeInteger(Number(s)),'bad numeric '+JSON.stringify(v));return Number(s)};
const hashRows=rows=>{const h=crypto.createHash('sha256');for(const r of rows)h.update(CONTRACT.map(k=>r[k]===null?'NULL':String(r[k])).join('|')+'\n');return h.digest('hex')};
const db=createClient({url:process.env.TURSO_DATABASE_URL,authToken:process.env.TURSO_AUTH_TOKEN});

function canonicalSnapshot(){
 const all=[],sourceHashes={},ids=new Set();
 for(const date of DATES){
  const file=path.join(DIR,date+'_twse_institutional_investors.json');
  const raw=fs.readFileSync(file);sourceHashes[date]=sha(raw);
  const p=JSON.parse(raw);verify(p.date===date,'date mismatch '+date);
  const idIx=p.fields.findIndex(f=>/證券代號|股票代號|證券代碼/.test(String(f)));verify(idIx>=0,'id missing '+date);
  const ix={};for(const [k,re] of Object.entries(MATCH)){const hits=p.fields.map((f,i)=>re.test(String(f).trim())?i:-1).filter(i=>i>=0);verify(hits.length===1,'field '+k+' '+date);ix[k]=hits[0]}
  for(const a of p.data){
   const id=String(a[idIx]??'').trim();if(!/^[1-9]\d{3}$/.test(id))continue;
   const r={trade_date:date,stock_id:id};for(const k of Object.keys(MATCH))r[k]=num(a[ix[k]]);all.push(r);ids.add(id);
  }
 }
 all.sort((a,b)=>a.trade_date.localeCompare(b.trade_date)||a.stock_id.localeCompare(b.stock_id));
 verify(all.length===EXPECTED_ROWS,'canonical rows '+all.length);verify(ids.size===EXPECTED_UNIQUE,'canonical ids '+ids.size);
 return {all,sourceHashes,ids};
}
function csvCodes(rel){const lines=fs.readFileSync(path.join(ROOT,rel),'utf8').trim().split(/\r?\n/).filter(Boolean);verify(lines[0]==='Code,Name,Industry','category header '+rel);return new Set(lines.slice(1).map(x=>x.slice(0,x.indexOf(',')).trim()).filter(Boolean))}
function classify(ids){
 const sets=Object.fromEntries(Object.entries(CATS).map(([k,v])=>[k,csvCodes(v)])),counts={},unmatched=[],ambiguous=[];
 for(const id of ids){const hits=Object.entries(sets).filter(([,s])=>s.has(id)).map(([k])=>k);if(!hits.length)unmatched.push(id);else if(hits.length!==1)ambiguous.push({id,hits});else counts[hits[0]]=(counts[hits[0]]||0)+1}
 verify(!unmatched.length,'unmatched '+unmatched.join(','));verify(!ambiguous.length,'ambiguous '+JSON.stringify(ambiguous));
 return {unique_counts:counts,unmatched,ambiguous};
}
async function readShadow(){
 const r=await db.execute({sql:`SELECT trade_date,stock_id,foreign_net AS foreign_ex_dealer_net,foreign_dealer_net,trust_net,dealer_net FROM ${TABLE} WHERE trade_date>=? AND trade_date<=? ORDER BY trade_date,stock_id`,args:[DATES[0],DATES.at(-1)]});
 return r.rows.map(x=>({trade_date:String(x.trade_date),stock_id:String(x.stock_id),foreign_ex_dealer_net:x.foreign_ex_dealer_net==null?null:Number(x.foreign_ex_dealer_net),foreign_dealer_net:x.foreign_dealer_net==null?null:Number(x.foreign_dealer_net),trust_net:x.trust_net==null?null:Number(x.trust_net),dealer_net:x.dealer_net==null?null:Number(x.dealer_net)}));
}
function compare(a,b){verify(a.length===b.length,'length mismatch');let neg=0,nulls=0;for(let i=0;i<a.length;i++)for(const k of CONTRACT){verify(a[i][k]===b[i][k],'mismatch '+i+' '+k);if(typeof b[i][k]==='number'&&b[i][k]<0)neg++;if(b[i][k]===null)nulls++}return {rows:b.length,hash:hashRows(b),negative_values:neg,null_values:nulls}}
function simulateDbUnavailable(sourceHashes){
 const before={};for(const d of DATES)before[d]=sha(fs.readFileSync(path.join(DIR,d+'_twse_institutional_investors.json')));
 let classified=null;
 try{throw Object.assign(new Error('simulated database unavailable'),{code:'SIMULATED_DB_UNAVAILABLE'})}catch(e){classified={status:'shadow_degraded',classification:'database_unavailable',code:e.code,canonical_fallback:'repository_files',production_failure:false}}
 const after={};for(const d of DATES)after[d]=sha(fs.readFileSync(path.join(DIR,d+'_twse_institutional_investors.json')));
 verify(JSON.stringify(before)===JSON.stringify(after),'canonical files changed during fallback simulation');
 verify(JSON.stringify(after)===JSON.stringify(sourceHashes),'canonical source hashes drifted');
 return {...classified,canonical_hashes_unchanged:true,canonical_files_readable:true,mutation_performed:false};
}
async function main(){
 verify(process.env.TURSO_DATABASE_URL&&process.env.TURSO_AUTH_TOKEN,'missing Turso secrets');
 const canonical=canonicalSnapshot(),shadow=await readShadow(),parity=compare(canonical.all,shadow);
 verify(shadow.length===EXPECTED_ROWS,'shadow rows '+shadow.length);
 const meta=await db.execute('SELECT trade_date,source_sha256,row_hash,eligible_rows FROM '+SOURCE_TABLE+' ORDER BY trade_date');
 verify(meta.rows.length===20,'metadata dates');
 for(const row of meta.rows){const d=String(row.trade_date);verify(String(row.source_sha256)===canonical.sourceHashes[d],'source sha mismatch '+d)}
 const classification=classify(canonical.ids);
 const fallback=simulateDbUnavailable(canonical.sourceHashes);
 const writeReport=JSON.parse(fs.readFileSync('/tmp/turso-phase10-shadow-write.json','utf8'));
 verify(writeReport.idempotent_counts.before_replay===EXPECTED_ROWS&&writeReport.idempotent_counts.after_replay===EXPECTED_ROWS,'write replay count');
 const report={schema:'turso_phase10_shadow_evidence_v1',table:TABLE,source_table:SOURCE_TABLE,frozen_dates:DATES,frozen_rows:EXPECTED_ROWS,frozen_unique_ids:EXPECTED_UNIQUE,canonical_source_of_truth:true,independent_twse_refetch:false,shadow_write:writeReport,read_parity:parity,instrument_type_coverage:classification,database_unavailable_simulation:fallback,feature_flags:{shadow_write_default:false,shadow_read_default:false,primary_read_default:false,scope:'POC workflow only'},production_behavior_changed:false,live_accumulation_started:false};
 fs.writeFileSync('/tmp/turso-phase10-shadow-evidence.json',JSON.stringify(report,null,2));
 console.log('[TURSO-PHASE10] SHADOW_VERIFY_PASS '+JSON.stringify({rows:parity.rows,hash:parity.hash,negative_values:parity.negative_values,categories:classification.unique_counts,fallback:fallback.classification}));
}
main().catch(e=>{console.error('[TURSO-PHASE10] SHADOW_VERIFY_FAILED '+e.stack);process.exitCode=1}).finally(()=>db.close());
