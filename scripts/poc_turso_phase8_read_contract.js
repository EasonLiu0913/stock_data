#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { performance } = require('node:perf_hooks');
const { createClient } = require('@libsql/client');

const ROOT = path.resolve(__dirname, '..');
const SOURCE_DIR = path.join(ROOT, 'data_twse_institutional_investors');
const TABLE = 'turso_poc_equity_structured_v4_phase7';
const SOURCE_TABLE = 'turso_poc_equity_structured_sources_v4_phase7';
const FROZEN_DATES = [
  '20260904','20260907','20260908','20260909','20260910','20260911','20260914','20260915','20260916','20260917',
  '20260918','20260921','20260922','20260923','20260924','20260929','20260930','20261001','20261002','20261005'
];
const EXPECTED_ROWS = 21475;
const EXPECTED_UNIQUE = 1088;
const CONTRACT_COLUMNS = ['trade_date','stock_id','foreign_ex_dealer_net','foreign_dealer_net','trust_net','dealer_net'];

const CATEGORY_SOURCES = {
  stock: 'data_twse/twse_industry_Stock.csv',
  tdr: 'data_twse/twse_industry_TDR.csv',
  etf: 'data_twse/twse_industry_ETF.csv',
  etn: 'data_twse/twse_industry_ETN.csv',
  preferred_stock: 'data_twse/twse_industry_PreferredStock.csv',
  innovation_board: 'data_twse/twse_industry_InnovationBoard.csv',
  reit: 'data_twse/twse_industry_REITs.csv',
  warrant: 'data_twse/twse_industry_Warrants.csv'
};

const SOURCE_MATCHERS = {
  foreign_ex_dealer_net: /外陸資買賣超股數|外資及陸資買賣超股數/,
  foreign_dealer_net: /^外資自營商買賣超股數/,
  trust_net: /^投信買賣超股數$/,
  dealer_net: /^自營商買賣超股數$/
};

const fail = (m) => { throw new Error(m); };
const verify = (x,m) => { if (!x) fail(m); };
const number = (value) => {
  if (value == null || String(value).trim() === '' || String(value).trim() === '--') return null;
  const s = String(value).trim().replace(/,/g,'');
  verify(/^[+-]?\d+$/.test(s) && Number.isSafeInteger(Number(s)), 'Bad numeric value '+JSON.stringify(value));
  return Number(s);
};
const db = createClient({ url: process.env.TURSO_DATABASE_URL, authToken: process.env.TURSO_AUTH_TOKEN });

function canonical(row) {
  return CONTRACT_COLUMNS.map(k => row[k] === null ? 'NULL' : String(row[k])).join('|');
}
function hashRows(rows) {
  const h = crypto.createHash('sha256');
  for (const row of rows) h.update(canonical(row)+'\n');
  return h.digest('hex');
}
function loadFrozenSource() {
  const all = [];
  const unique = new Set();
  const byDate = {};
  for (const date of FROZEN_DATES) {
    const payload = JSON.parse(fs.readFileSync(path.join(SOURCE_DIR, date+'_twse_institutional_investors.json'),'utf8'));
    verify(payload.date === date && Array.isArray(payload.fields) && Array.isArray(payload.data), 'Malformed source '+date);
    const idIx = payload.fields.findIndex(f => /證券代號|股票代號|證券代碼/.test(String(f)));
    verify(idIx >= 0, 'Missing security id field '+date);
    const metricIx = {};
    for (const [key,re] of Object.entries(SOURCE_MATCHERS)) {
      const hits = payload.fields.map((f,i)=>re.test(String(f).trim())?i:-1).filter(i=>i>=0);
      verify(hits.length===1, 'Ambiguous/missing '+key+' '+date+': '+JSON.stringify(payload.fields));
      metricIx[key] = hits[0];
    }
    const rows = [];
    for (const values of payload.data) {
      const stockId = String(values[idIx] ?? '').trim();
      if (!/^[1-9]\d{3}$/.test(stockId)) continue;
      const row = {trade_date:date,stock_id:stockId};
      for (const key of Object.keys(SOURCE_MATCHERS)) row[key] = number(values[metricIx[key]]);
      rows.push(row);
      unique.add(stockId);
    }
    rows.sort((a,b)=>a.stock_id.localeCompare(b.stock_id));
    byDate[date] = { rows, hash: hashRows(rows) };
    all.push(...rows);
  }
  verify(all.length===EXPECTED_ROWS,'Frozen row count changed '+all.length);
  verify(unique.size===EXPECTED_UNIQUE,'Frozen unique id count changed '+unique.size);
  all.sort((a,b)=>a.trade_date.localeCompare(b.trade_date)||a.stock_id.localeCompare(b.stock_id));
  return {all,byDate,unique};
}
function csvCodes(file) {
  const text=fs.readFileSync(path.join(ROOT,file),'utf8').trim();
  const lines=text.split(/\r?\n/).filter(Boolean);
  verify(lines[0]==='Code,Name,Industry','Unexpected category CSV header '+file);
  return new Set(lines.slice(1).map(line=>line.slice(0,line.indexOf(',')).trim()).filter(Boolean));
}
function classify(ids) {
  const categories=Object.fromEntries(Object.entries(CATEGORY_SOURCES).map(([k,v])=>[k,csvCodes(v)]));
  const uniqueCounts={}, unmatched=[], ambiguous=[];
  for (const id of ids) {
    const hits=Object.entries(categories).filter(([,set])=>set.has(id)).map(([type])=>type);
    if(hits.length===0) unmatched.push(id);
    else if(hits.length!==1) ambiguous.push({id,hits});
    else uniqueCounts[hits[0]]=(uniqueCounts[hits[0]]||0)+1;
  }
  verify(unmatched.length===0,'Unmatched instrument ids '+unmatched.join(','));
  verify(ambiguous.length===0,'Ambiguous instrument ids '+JSON.stringify(ambiguous));
  return {unique_instrument_counts:uniqueCounts,unmatched,ambiguous};
}
async function readContractPass(label) {
  const t=performance.now();
  const res=await db.execute({
    sql:`SELECT trade_date,stock_id,
                foreign_net AS foreign_ex_dealer_net,
                foreign_dealer_net,
                trust_net,
                dealer_net
         FROM ${TABLE}
         WHERE trade_date>=? AND trade_date<=?
         ORDER BY trade_date,stock_id`,
    args:[FROZEN_DATES[0],FROZEN_DATES.at(-1)]
  });
  const rows=res.rows.map(r=>({
    trade_date:String(r.trade_date),
    stock_id:String(r.stock_id),
    foreign_ex_dealer_net:r.foreign_ex_dealer_net==null?null:Number(r.foreign_ex_dealer_net),
    foreign_dealer_net:r.foreign_dealer_net==null?null:Number(r.foreign_dealer_net),
    trust_net:r.trust_net==null?null:Number(r.trust_net),
    dealer_net:r.dealer_net==null?null:Number(r.dealer_net)
  }));
  verify(rows.length===EXPECTED_ROWS,label+' row count mismatch '+rows.length);
  const byDate={};
  for(const date of FROZEN_DATES){
    const day=rows.filter(r=>r.trade_date===date);
    byDate[date]={rows:day.length,hash:hashRows(day)};
  }
  return {rows,hash:hashRows(rows),byDate,ms:Math.round((performance.now()-t)*100)/100};
}
function compare(expected,actual,label) {
  verify(expected.length===actual.length,label+' length mismatch');
  let negative=0, nulls=0;
  for(let i=0;i<expected.length;i++){
    const a=expected[i], b=actual[i];
    for(const key of CONTRACT_COLUMNS){
      verify(a[key]===b[key],label+' mismatch index='+i+' key='+key+' expected='+a[key]+' actual='+b[key]);
      if(typeof b[key]==='number' && b[key]<0) negative++;
      if(b[key]===null) nulls++;
    }
  }
  return {rows:actual.length,negative_values:negative,null_values:nulls,hash:hashRows(actual)};
}
async function timedQuery(name,sql,args=[]) {
  const samples=[];
  let rowCount=null;
  for(let i=0;i<3;i++){
    const t=performance.now();
    const r=await db.execute({sql,args});
    samples.push(Math.round((performance.now()-t)*100)/100);
    rowCount=r.rows.length;
  }
  samples.sort((a,b)=>a-b);
  return {name,rows:rowCount,samples_ms:samples,min_ms:samples[0],median_ms:samples[1],max_ms:samples[2],label:'bounded GitHub-hosted POC observation only; not a production SLA'};
}
async function main(){
  verify(process.env.TURSO_DATABASE_URL&&process.env.TURSO_AUTH_TOKEN,'Missing Turso secrets');
  const source=loadFrozenSource();
  const classification=classify(source.unique);

  const sourceMeta=await db.execute({sql:`SELECT trade_date,eligible_rows FROM ${SOURCE_TABLE} ORDER BY trade_date`});
  verify(sourceMeta.rows.length===FROZEN_DATES.length,'Phase 7 source metadata date count mismatch');
  verify(sourceMeta.rows.reduce((n,r)=>n+Number(r.eligible_rows),0)===EXPECTED_ROWS,'Phase 7 source metadata row total mismatch');

  const pass1=await readContractPass('PASS1');
  const parity1=compare(source.all,pass1.rows,'PASS1');
  for(const date of FROZEN_DATES) verify(source.byDate[date].hash===pass1.byDate[date].hash,'PASS1 date hash mismatch '+date);

  const pass2=await readContractPass('PASS2_REPEAT_READ');
  const parity2=compare(source.all,pass2.rows,'PASS2_REPEAT_READ');
  verify(pass1.hash===pass2.hash,'Repeated read hash drift');
  for(const date of FROZEN_DATES) verify(pass1.byDate[date].hash===pass2.byDate[date].hash,'Repeated date hash drift '+date);

  const queries=[
    await timedQuery('stock_history_required_metrics',`SELECT trade_date,stock_id,foreign_net,foreign_dealer_net,trust_net,dealer_net FROM ${TABLE} WHERE stock_id=? AND trade_date>=? AND trade_date<=? ORDER BY trade_date DESC`,['2330',FROZEN_DATES[0],FROZEN_DATES.at(-1)]),
    await timedQuery('latest_date_top_foreign_ex_dealer',`SELECT stock_id,foreign_net FROM ${TABLE} WHERE trade_date=? ORDER BY foreign_net DESC LIMIT 20`,[FROZEN_DATES.at(-1)]),
    await timedQuery('latest_date_required_metric_rows',`SELECT stock_id,foreign_net,foreign_dealer_net,trust_net,dealer_net FROM ${TABLE} WHERE trade_date=? ORDER BY stock_id`,[FROZEN_DATES.at(-1)])
  ];

  const report={
    schema:'turso_phase8_read_contract_v1',
    source_table:TABLE,
    source_metadata_table:SOURCE_TABLE,
    frozen_dates:FROZEN_DATES,
    frozen_row_count:EXPECTED_ROWS,
    frozen_unique_instrument_count:EXPECTED_UNIQUE,
    contract:{
      identity:['trade_date','stock_id'],
      required_current_consumer_metrics:['foreign_ex_dealer_net','foreign_dealer_net','trust_net','dealer_net'],
      stored_column_mapping:{
        foreign_ex_dealer_net:'foreign_net',
        foreign_dealer_net:'foreign_dealer_net',
        trust_net:'trust_net',
        dealer_net:'dealer_net'
      }
    },
    parity:{
      pass1:{...parity1,read_ms:pass1.ms},
      pass2_repeat_read:{...parity2,read_ms:pass2.ms},
      stable_hash:pass1.hash===pass2.hash,
      per_date_hashes:Object.fromEntries(FROZEN_DATES.map(d=>[d,pass2.byDate[d].hash]))
    },
    instrument_type_coverage:{
      ...classification,
      note:'Explicit TWSE category-file classification; four-digit code shape is not treated as common-stock proof.'
    },
    representative_reads:queries,
    performance_interpretation:'Query timings are bounded GitHub-hosted POC observations only and are not production latency/SLA evidence.',
    mutation_performed:false,
    production_consumer_changed:false,
    production_migration_authorized:false
  };
  fs.writeFileSync('/tmp/turso-phase8-read-contract.json',JSON.stringify(report,null,2));
  console.log('[TURSO-PHASE8] READ_CONTRACT_PASS '+JSON.stringify({
    dates:FROZEN_DATES.length,
    rows:EXPECTED_ROWS,
    unique:EXPECTED_UNIQUE,
    hash:pass2.hash,
    negative_values:parity2.negative_values,
    categories:classification.unique_instrument_counts
  }));
}

main().catch(e=>{console.error('[TURSO-PHASE8] FAILED '+e.stack);process.exitCode=1}).finally(()=>db.close());
