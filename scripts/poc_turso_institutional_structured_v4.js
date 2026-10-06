#!/usr/bin/env node
'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {performance}=require('node:perf_hooks');
const {createClient}=require('@libsql/client');

const dir='data_twse_institutional_investors';
const frozenDates=[
 '20260904','20260907','20260908','20260909','20260910','20260911','20260914','20260915','20260916','20260917',
 '20260918','20260921','20260922','20260923','20260924','20260929','20260930','20261001','20261002','20261005'
];
const expectedRows=21475;
const mappings={
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
const keys=Object.keys(mappings);
const cols=['trade_date','stock_id',...keys];
const table='turso_poc_equity_structured_v4_phase7';
const sourceTable='turso_poc_equity_structured_sources_v4_phase7';
const providerQuotaEvidence={
 source:'https://turso.tech/pricing',
 observed_date:'2026-10-06',
 plan:'Free',
 storage_bytes:5*1000*1000*1000,
 monthly_rows_read:500000000,
 monthly_rows_written:10000000,
 monthly_sync_bytes:3*1000*1000*1000,
 databases:100,
 note:'Provider plan limits are quota facts, not SQLite dbstat/page_count measurements. Decimal GB follows provider-facing plan labels.'
};
const fail=(msg)=>{throw Error(msg)};
const verify=(x,msg)=>{if(!x)fail(msg)};
const number=(value)=>{
 if(value==null||String(value).trim()===''||String(value).trim()==='--') return null;
 const s=String(value).trim().replace(/,/g,'');
 verify(/^[+-]?\d+$/.test(s) && Number.isSafeInteger(Number(s)),'Bad numeric value '+JSON.stringify(value));
 return Number(s);
};
const ms=(start)=>Math.round((performance.now()-start)*100)/100;
const db=createClient({url:process.env.TURSO_DATABASE_URL,authToken:process.env.TURSO_AUTH_TOKEN});

function canonical(row){
 return cols.map(k=>row[k]===null?'NULL':String(row[k])).join('|');
}
function digest(rows){
 const h=crypto.createHash('sha256');
 for(const row of rows)h.update(canonical(row)+'\n');
 return h.digest('hex');
}
function loadSource(){
 const source=frozenDates.map(date=>{
  const filename=date+'_twse_institutional_investors.json';
  const raw=fs.readFileSync(path.join(dir,filename));
  const p=JSON.parse(raw.toString('utf8'));
  verify(p.date===date&&Array.isArray(p.fields)&&Array.isArray(p.data),'Malformed source '+filename);
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
  const rows=[...found.values()].sort((a,b)=>a.stock_id.localeCompare(b.stock_id));
  return {date:p.date,rows,rawBytes:raw.length,ignored:p.data.length-found.size,mapping:Object.fromEntries(Object.entries(ix).map(([k,v])=>[k,p.fields[v]])),hash:digest(rows)};
 });
 verify(source.length===20,'Frozen date count changed');
 verify(source.reduce((n,x)=>n+x.rows.length,0)===expectedRows,'Frozen row count changed from '+expectedRows);
 return source;
}
async function scalar(sql,args=[]){
 const r=await db.execute({sql,args});
 const row=r.rows[0];
 return row?Number(Object.values(row)[0]):0;
}
async function storageSnapshot(dataTable=table,metadataTable=sourceTable){
 const out={};
 for(const [name,sql] of Object.entries({
  page_count:'PRAGMA page_count',
  page_size:'PRAGMA page_size',
  freelist_count:'PRAGMA freelist_count'
 })){
  try{out[name]=await scalar(sql);}catch(e){out[name]=null;out[name+'_error']=e.message;}
 }
 if(out.page_count!=null&&out.page_size!=null)out.database_logical_bytes=out.page_count*out.page_size;
 try{
  const schema=await db.execute({
   sql:`SELECT type,name,tbl_name,sql FROM sqlite_master
        WHERE tbl_name IN (?,?) OR name IN (?,?)
        ORDER BY tbl_name,type,name`,
   args:[dataTable,metadataTable,dataTable,metadataTable]
  });
  const objects=schema.rows.map(row=>({
   type:String(row.type),
   name:String(row.name),
   tbl_name:String(row.tbl_name),
   autoindex:row.sql===null,
   sql_present:row.sql!==null
  }));
  const names=[...new Set(objects.map(x=>x.name))];
  verify(names.includes(dataTable)&&names.includes(metadataTable),'sqlite_master did not expose both POC tables');
  const placeholders=names.map(()=>'?').join(',');
  const stats=await db.execute({
   sql:'SELECT name, SUM(pgsize) AS bytes, COUNT(*) AS pages FROM dbstat WHERE name IN ('+placeholders+') GROUP BY name ORDER BY name',
   args:names
  });
  const byName=Object.fromEntries(stats.rows.map(row=>[String(row.name),{bytes:Number(row.bytes),pages:Number(row.pages)}]));
  out.table_family={
   objects:objects.map(obj=>({...obj,bytes:byName[obj.name]?.bytes??0,pages:byName[obj.name]?.pages??0})),
   total_bytes:objects.reduce((sum,obj)=>sum+(byName[obj.name]?.bytes??0),0),
   total_pages:objects.reduce((sum,obj)=>sum+(byName[obj.name]?.pages??0),0),
   missing_dbstat_objects:objects.filter(obj=>!byName[obj.name]).map(obj=>obj.name)
  };
  verify(out.table_family.missing_dbstat_objects.length===0,'dbstat missing POC objects: '+out.table_family.missing_dbstat_objects.join(','));
 }catch(e){
  out.table_family=null;
  out.table_family_error=e.message;
 }
 return out;
}

function feasibility(storage){
 const familyBytes=storage?.table_family?.total_bytes;
 if(!Number.isFinite(familyBytes)||familyBytes<=0)return {available:false,reason:'table-family dbstat bytes unavailable'};
 const observedRows=expectedRows;
 const bytesPerObservedRow=familyBytes/observedRows;
 const assumedTradingDaysPerYear=250;
 const assumedTradingDaysPerMonth=22;
 const rowsPerTradingDay=observedRows/frozenDates.length;
 const projectedRowsPerYear=Math.round(rowsPerTradingDay*assumedTradingDaysPerYear);
 const projectedRowsWrittenPerMonth=Math.round(rowsPerTradingDay*assumedTradingDaysPerMonth+assumedTradingDaysPerMonth);
 const projectedLogicalBytesPerYear=Math.round(bytesPerObservedRow*projectedRowsPerYear);
 return {
  available:true,
  scope:'frozen TWSE T86 four-digit structured dataset only',
  assumptions:{
   observed_dates:frozenDates.length,
   observed_rows:observedRows,
   assumed_trading_days_per_year:assumedTradingDaysPerYear,
   assumed_trading_days_per_month:assumedTradingDaysPerMonth,
   rows_per_trading_day:Math.round(rowsPerTradingDay*100)/100,
   no_additional_dates_imported_in_this_phase:true,
   excludes_provider_overhead:true,
   excludes_other_repository_datasets:true,
   excludes_replay_and_backfill_write_amplification:true
  },
  measured_table_family_logical_bytes:familyBytes,
  logical_bytes_per_observed_row:Math.round(bytesPerObservedRow*100)/100,
  projected_rows_per_year:projectedRowsPerYear,
  projected_table_family_logical_bytes_per_year:projectedLogicalBytesPerYear,
  projected_rows_written_per_month:projectedRowsWrittenPerMonth,
  free_tier_storage_fraction_per_projected_year:projectedLogicalBytesPerYear/providerQuotaEvidence.storage_bytes,
  free_tier_monthly_write_fraction:projectedRowsWrittenPerMonth/providerQuotaEvidence.monthly_rows_written,
  read_quota_note:'No general monthly read fraction is claimed; row-read usage depends on actual query frequency and provider accounting semantics.'
 };
}
async function upsertAll(source,label){
 const stmt='INSERT INTO '+table+'('+cols.join(',')+') VALUES('+cols.map(()=>'?').join(',')+') ON CONFLICT(trade_date,stock_id) DO UPDATE SET '+keys.map(k=>k+'=excluded.'+k).join(',');
 const t=performance.now();
 let batches=0;
 for(const item of source){
  for(let i=0;i<item.rows.length;i+=100){
   await db.batch(item.rows.slice(i,i+100).map(row=>({sql:stmt,args:cols.map(k=>row[k])})),'write');
   batches++;
  }
  await db.execute({sql:'INSERT INTO '+sourceTable+'(trade_date,columns_mapping,source_bytes,eligible_rows) VALUES(?,?,?,?) ON CONFLICT(trade_date) DO UPDATE SET columns_mapping=excluded.columns_mapping,source_bytes=excluded.source_bytes,eligible_rows=excluded.eligible_rows',args:[item.date,JSON.stringify(item.mapping),item.rawBytes,item.rows.length]});
 }
 const elapsed=ms(t);
 console.log('[TURSO-PHASE7] '+label+'_WRITE_PASS rows='+expectedRows+' batches='+batches+' ms='+elapsed);
 return {rows:expectedRows,batches,ms:elapsed};
}
async function verifyAll(source,label){
 const t=performance.now();
 let compared=0,nulls=0,negative=0;
 const dayHashes={};
 for(const item of source){
  const actual=[];
  for(let offset=0;offset<item.rows.length;offset+=250){
   const r=await db.execute({sql:'SELECT '+cols.join(',')+' FROM '+table+' WHERE trade_date=? ORDER BY stock_id LIMIT 250 OFFSET ?',args:[item.date,offset]});
   for(const raw of r.rows){
    const row={trade_date:String(raw.trade_date),stock_id:String(raw.stock_id)};
    for(const k of keys){
      row[k]=raw[k]===null?null:Number(raw[k]);
      if(row[k]===null)nulls++;
      else if(row[k]<0)negative++;
    }
    actual.push(row);
   }
  }
  verify(actual.length===item.rows.length,'Parity row count mismatch '+item.date+' '+actual.length+'/'+item.rows.length);
  for(let i=0;i<item.rows.length;i++){
   const expected=item.rows[i],got=actual[i];
   verify(got.stock_id===expected.stock_id,'Stock order mismatch '+item.date+' index='+i);
   for(const k of keys)verify(got[k]===expected[k],'Parity mismatch '+item.date+' '+expected.stock_id+' '+k+' expected='+expected[k]+' actual='+got[k]);
   compared++;
  }
  const h=digest(actual);
  verify(h===item.hash,'Hash mismatch '+item.date);
  dayHashes[item.date]=h;
 }
 const elapsed=ms(t);
 console.log('[TURSO-PHASE7] '+label+'_PARITY_PASS rows='+compared+' null_values='+nulls+' negative_values='+negative+' ms='+elapsed);
 return {rows:compared,null_values:nulls,negative_values:negative,ms:elapsed,day_hashes:dayHashes};
}
async function timedQuery(name,sql,args){
 const samples=[];
 let rows=0;
 for(let i=0;i<5;i++){
  const t=performance.now();
  const r=await db.execute({sql,args});
  samples.push(ms(t)); rows=r.rows.length;
 }
 const sorted=[...samples].sort((a,b)=>a-b);
 const result={rows,samples_ms:samples,min_ms:sorted[0],median_ms:sorted[2],max_ms:sorted[4]};
 console.log('[TURSO-PHASE7] QUERY_LATENCY '+name+' '+JSON.stringify(result));
 return result;
}
async function main(){
 verify(process.env.TURSO_DATABASE_URL&&process.env.TURSO_AUTH_TOKEN,'Missing secrets');
 const source=loadSource();
 const ndjson=source.flatMap(item=>item.rows).map(row=>JSON.stringify(row)).join('\n')+'\n';
 fs.writeFileSync('/tmp/turso-phase7.ndjson',ndjson);
 const connectStart=performance.now();
 const connected=await db.execute('SELECT 1 AS ok');
 verify(Number(connected.rows[0].ok)===1,'Connectivity failed');
 const connectMs=ms(connectStart);
 console.log('[TURSO-PHASE7] CONNECT_SUCCESS ms='+connectMs);
 await db.execute('CREATE TABLE IF NOT EXISTS '+table+' (trade_date TEXT NOT NULL,stock_id TEXT NOT NULL,foreign_buy INTEGER,foreign_sell INTEGER,foreign_net INTEGER,foreign_dealer_net INTEGER,trust_buy INTEGER,trust_sell INTEGER,trust_net INTEGER,dealer_net INTEGER,total_net INTEGER,PRIMARY KEY(trade_date,stock_id))');
 await db.execute('CREATE INDEX IF NOT EXISTS '+table+'_stock_date ON '+table+'(stock_id,trade_date)');
 await db.execute('CREATE TABLE IF NOT EXISTS '+sourceTable+' (trade_date TEXT PRIMARY KEY,columns_mapping TEXT NOT NULL,source_bytes INTEGER NOT NULL,eligible_rows INTEGER NOT NULL)');
 const before=await storageSnapshot();

 const pass1=await upsertAll(source,'PASS1');
 const parity1=await verifyAll(source,'PASS1');
 const count1=await scalar('SELECT COUNT(*) FROM '+table+' WHERE trade_date>=? AND trade_date<=?',[frozenDates[0],frozenDates.at(-1)]);
 verify(count1===expectedRows,'Pass1 total row count mismatch '+count1);

 const beforeReplay=await storageSnapshot();
 const pass2=await upsertAll(source,'PASS2_REPLAY');
 const parity2=await verifyAll(source,'PASS2_REPLAY');
 const count2=await scalar('SELECT COUNT(*) FROM '+table+' WHERE trade_date>=? AND trade_date<=?',[frozenDates[0],frozenDates.at(-1)]);
 verify(count2===expectedRows,'Pass2 total row count mismatch '+count2);
 verify(JSON.stringify(parity1.day_hashes)===JSON.stringify(parity2.day_hashes),'Replay changed canonical row hashes');
 console.log('[TURSO-PHASE7] REPLAY_IDEMPOTENCY_PASS rows_before='+count1+' rows_after='+count2);

 const queries={
  stock_2330_history:await timedQuery('stock_2330_history','SELECT trade_date,foreign_net,trust_net,dealer_net,total_net FROM '+table+' WHERE stock_id=? AND trade_date>=? AND trade_date<=? ORDER BY trade_date DESC',['2330',frozenDates[0],frozenDates.at(-1)]),
  latest_foreign_top20:await timedQuery('latest_foreign_top20','SELECT stock_id,foreign_net FROM '+table+' WHERE trade_date=? AND foreign_net IS NOT NULL ORDER BY foreign_net DESC LIMIT 20',[frozenDates.at(-1)]),
  date_count:await timedQuery('date_count','SELECT COUNT(*) AS n FROM '+table+' WHERE trade_date=?',[frozenDates.at(-1)])
 };
 verify(queries.stock_2330_history.rows===20,'2330 frozen history should contain 20 rows');
 verify(queries.latest_foreign_top20.rows===20,'Top-20 query should return 20 rows');

 const afterReplay=await storageSnapshot();
 verify(beforeReplay.table_family&&afterReplay.table_family,'Complete table-family dbstat accounting unavailable');
 const priorV3Storage=await storageSnapshot('turso_poc_equity_structured_v3','turso_poc_equity_structured_sources_v3');
 verify(priorV3Storage.table_family,'Prior v3 table-family dbstat accounting unavailable');
 const requiredConsumerMetricColumns={
  foreign_ex_dealer_net:'foreign_net',
  foreign_dealer_net:'foreign_dealer_net',
  trust_net:'trust_net',
  dealer_net:'dealer_net'
 };
 for(const [logical,column] of Object.entries(requiredConsumerMetricColumns)){
  verify(keys.includes(column),'Required consumer metric '+logical+' missing stored column '+column);
 }
 verify(beforeReplay.table_family.total_bytes===afterReplay.table_family.total_bytes,'Replay changed table-family logical bytes '+beforeReplay.table_family.total_bytes+' -> '+afterReplay.table_family.total_bytes);
 console.log('[TURSO-PHASE7] STORAGE_REPLAY_STABLE table_family_bytes='+afterReplay.table_family.total_bytes+' objects='+afterReplay.table_family.objects.length);
 const feasibilityEvidence=feasibility(afterReplay);
 const report={
  schema:'turso_phase7_nine_metric_structured_v4_validation_v1',
  frozen_dates:frozenDates,
  expected_rows:expectedRows,
  columns:keys,
  connectivity_ms:connectMs,
  pass1_write:pass1,
  pass1_parity:{rows:parity1.rows,null_values:parity1.null_values,negative_values:parity1.negative_values,ms:parity1.ms},
  pass2_replay_write:pass2,
  pass2_parity:{rows:parity2.rows,null_values:parity2.null_values,negative_values:parity2.negative_values,ms:parity2.ms},
  idempotent_counts:{before_replay:count1,after_replay:count2},
  queries,
  storage:{before_initial_write:before,before_replay:beforeReplay,after_replay:afterReplay,prior_v3:priorV3Storage,comparison:{v3_table_family_logical_bytes:priorV3Storage.table_family.total_bytes,v4_table_family_logical_bytes:afterReplay.table_family.total_bytes,delta_bytes:afterReplay.table_family.total_bytes-priorV3Storage.table_family.total_bytes,label:'SQLite logical page evidence for the same frozen population; not Turso billing usage'},warning:'PRAGMA page_count/page_size are whole-database logical measures. table_family dbstat totals are SQLite logical page accounting for exposed POC objects. Neither is provider billing/quota usage.'},
  consumer_metric_coverage:{required_stored_metrics_for_proven_current_consumers:Object.keys(requiredConsumerMetricColumns),stored_column_mapping:requiredConsumerMetricColumns,all_required_present:true},
  provider_quota_evidence:providerQuotaEvidence,
  feasibility:feasibilityEvidence,
  source_hashes:parity2.day_hashes,
  selected_ndjson_bytes:Buffer.byteLength(ndjson)
 };
 fs.writeFileSync('/tmp/turso-phase7-validation.json',JSON.stringify(report,null,2));
 console.log('[TURSO-PHASE7] SUCCESS '+JSON.stringify({days:frozenDates.length,rows:expectedRows,pass1_write_ms:pass1.ms,pass2_write_ms:pass2.ms,parity1_ms:parity1.ms,parity2_ms:parity2.ms,table_family_bytes:afterReplay.table_family.total_bytes,storage_replay_stable:beforeReplay.table_family.total_bytes===afterReplay.table_family.total_bytes,provider_quota_plan:providerQuotaEvidence.plan}));
}
main().catch(e=>{console.error('[TURSO-PHASE7] FAILED '+e.stack);process.exitCode=1}).finally(()=>db.close());
