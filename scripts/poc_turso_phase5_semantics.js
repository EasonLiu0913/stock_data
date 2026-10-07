#!/usr/bin/env node
'use strict';
const fs=require('node:fs'),path=require('node:path');

const frozenDates=[
 '20260904','20260907','20260908','20260909','20260910','20260911','20260914','20260915','20260916','20260917',
 '20260918','20260921','20260922','20260923','20260924','20260929','20260930','20261001','20261002','20261005'
];
const expectedRows=21475;
const sourceDir='data_twse_institutional_investors';
const classificationFiles={
 stock_list:'data_twse/twse_industry.csv',
 etf:'data_twse/twse_industry_ETF.csv',
 warrant:'data_twse/twse_industry_Warrants.csv'
};
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
function fail(msg){throw Error(msg)}
function verify(x,msg){if(!x)fail(msg)}
function parseCsv(file){
 const rows=fs.readFileSync(file,'utf8').trim().split(/\r?\n/).slice(1);
 const map=new Map();
 for(const line of rows){
  const first=line.indexOf(','), second=line.indexOf(',',first+1);
  verify(first>0&&second>first,'Malformed classification CSV line in '+file);
  const code=line.slice(0,first).trim(), name=line.slice(first+1,second).trim(), industry=line.slice(second+1).trim();
  map.set(code,{code,name,industry});
 }
 return map;
}
function fieldRole(field){
 const f=String(field).trim();
 for(const [key,re] of Object.entries(mappings)) if(re.test(f)) return {status:'structured_mapped',structured_field:key,reason:'Stored directly in the current eight-metric fact schema.'};
 if(/證券代號|股票代號|證券代碼/.test(f)) return {status:'required_identity',reason:'Required fact key and security-master join key.'};
 if(/證券名稱|股票名稱/.test(f)) return {status:'required_dimension_or_derivable',reason:'Needed for human-readable identity, but may be derived from a validated security master instead of duplicated in each fact row.'};
 if(/^外資自營商/.test(f)) return {status:'optional_additional_metric',reason:'Distinct source metric not represented by the current eight fields and not derivable from them; retain if this participant subtype is required.'};
 if(/^自營商.*\(自行買賣\)/.test(f)) return {status:'optional_additional_metric',reason:'Dealer proprietary component is not represented separately in the current eight fields; retain if component-level analysis is required.'};
 if(/^自營商.*\(避險\)/.test(f)) return {status:'optional_additional_metric',reason:'Dealer hedge component is not represented separately in the current eight fields; retain if component-level analysis is required.'};
 if(/^自營商買進股數$|^自營商賣出股數$/.test(f)) return {status:'optional_additional_metric',reason:'Gross dealer buy/sell is not derivable from dealer net alone.'};
 return {status:'unclassified_gap',reason:'No Phase 5 rule; must be reviewed before production schema promotion.'};
}
function classify(code,masters){
 if(masters.etf.has(code)) return {type:'etf',source:'data_twse/twse_industry_ETF.csv',record:masters.etf.get(code)};
 if(masters.warrant.has(code)) return {type:'warrant',source:'data_twse/twse_industry_Warrants.csv',record:masters.warrant.get(code)};
 if(masters.stock_list.has(code)){
  const record=masters.stock_list.get(code);
  if(/-DR$/i.test(record.name)) return {type:'tdr',source:'data_twse/twse_industry.csv',record};
  return {type:'twse_stock_list_non_dr',source:'data_twse/twse_industry.csv',record};
 }
 return {type:'unclassified',source:null,record:null};
}
function inc(obj,key,n=1){obj[key]=(obj[key]||0)+n}
function main(){
 const masters=Object.fromEntries(Object.entries(classificationFiles).map(([k,v])=>[k,parseCsv(v)]));
 const fieldSets=new Map(), unique=new Map(), rowCounts={}, dates=[];
 let eligibleRows=0;
 for(const date of frozenDates){
  const file=path.join(sourceDir,date+'_twse_institutional_investors.json');
  const p=JSON.parse(fs.readFileSync(file,'utf8'));
  verify(p.date===date&&Array.isArray(p.fields)&&Array.isArray(p.data),'Malformed source '+file);
  dates.push(date);
  const sig=JSON.stringify(p.fields);
  if(!fieldSets.has(sig))fieldSets.set(sig,{fields:p.fields,dates:[]});
  fieldSets.get(sig).dates.push(date);
  const idMatches=p.fields.map((f,i)=>/證券代號|股票代號|證券代碼/.test(String(f))?i:-1).filter(i=>i>=0);
  verify(idMatches.length===1,'Stock ID field not unique '+date);
  for(const row of p.data){
   const code=String(row[idMatches[0]]).trim();
   if(!/^[1-9]\d{3}$/.test(code))continue;
   eligibleRows++;
   const c=classify(code,masters);
   inc(rowCounts,c.type);
   if(!unique.has(code))unique.set(code,{code,type:c.type,name:c.record?.name||null,industry:c.record?.industry||null,source:c.source,occurrences:0});
   unique.get(code).occurrences++;
  }
 }
 verify(eligibleRows===expectedRows,'Frozen eligible row count changed '+eligibleRows+'/'+expectedRows);
 verify(fieldSets.size===1,'Raw T86 field schema changed within frozen dates: '+fieldSets.size+' variants');
 const fields=[...fieldSets.values()][0].fields;
 const audit=fields.map((field,index)=>({index,source_field:String(field),...fieldRole(field)}));
 verify(audit.filter(x=>x.status==='structured_mapped').length===8,'Expected exactly eight mapped structured fields');
 const unknown=audit.filter(x=>x.status==='unclassified_gap');
 verify(unknown.length===0,'Unclassified raw T86 source columns: '+unknown.map(x=>x.source_field).join(' | '));
 const uniqueCounts={};
 for(const r of unique.values())inc(uniqueCounts,r.type);
 const examples={};
 for(const type of Object.keys(uniqueCounts)) examples[type]=[...unique.values()].filter(x=>x.type===type).slice(0,12);
 const report={
  schema:'turso_phase5_semantics_v1',
  frozen_dates:frozenDates,
  frozen_row_count:eligibleRows,
  classification_source:{
   trust_boundary:'Repository-generated TWSE classification lists are used as a reproducible source-backed partition. twse_industry.csv is not asserted to be a pure common-stock master; non-DR members are therefore labeled twse_stock_list_non_dr rather than common_stock.',
   files:Object.fromEntries(Object.entries(classificationFiles).map(([k,v])=>[k,{path:v,rows:masters[k].size}]))
  },
  classification:{row_counts:rowCounts,unique_instrument_counts:uniqueCounts,examples},
  raw_schema:{variant_count:fieldSets.size,fields,audit},
  production_readiness:{
   common_stock_claim_supported:false,
   reason:'The repository source partitions ETF and warrants and explicitly reveals DR names, but does not provide a verified security-type field proving every remaining four-digit stock-list member is common stock.',
   required_before_production:['Use an authoritative security-master field for instrument type if production requires common-stock-only semantics.','Decide whether omitted foreign-dealer and dealer component/gross metrics are required by production consumers before freezing the schema.'],
   current_eight_field_scope:'Adequate for the existing POC parity/query objectives only; not declared complete for all T86 semantics.'
  }
 };
 fs.writeFileSync('/tmp/turso-phase5-semantics.json',JSON.stringify(report,null,2));
 console.log('[TURSO-PHASE5] SEMANTICS_PASS '+JSON.stringify({rows:eligibleRows,unique:unique.size,row_counts:rowCounts,unique_counts:uniqueCounts,raw_fields:fields.length,mapped_fields:8}));
}
try{main()}catch(e){console.error('[TURSO-PHASE5] FAILED '+e.stack);process.exitCode=1}
