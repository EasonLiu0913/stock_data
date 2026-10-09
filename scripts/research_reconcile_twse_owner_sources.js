#!/usr/bin/env node
'use strict';
// Independent offline research only. Source dates do not authorize historical publication.
// Usage: node scripts/research_reconcile_twse_owner_sources.js ISIN.html COMPANIES.json LISTINGS.rtf OUTPUT_DIR [YYYYMMDD]
const fs=require('node:fs'),crypto=require('node:crypto'),cp=require('node:child_process'),path=require('node:path'),os=require('node:os');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const clean=s=>s.replace(/<[^>]+>/g,'').replace(/&nbsp;|&#160;/gi,' ').replace(/&amp;/gi,'&').replace(/&#(\d+);/g,(_,n)=>String.fromCharCode(+n)).replace(/\s+/g,' ').trim();
function roc(s){const m=String(s||'').match(/^(\d{2,3})[.\/]([01]?\d)[.\/]([0-3]?\d)$/);return m?`${+m[1]+1911}${m[2].padStart(2,'0')}${m[3].padStart(2,'0')}`:null;}
function companyDate(s){const v=String(s||'');return /^(19|20)\d{6}$/.test(v)?v:roc(v.replace(/^(\d{3})(\d\d)(\d\d)$/,'$1.$2.$3'));}
function parseIsin(bytes){
 const html=new TextDecoder('big5').decode(bytes),match=html.match(/Date\s+Stock\s+Updated:\s*(20\d\d)[\/-](\d{1,2})[\/-](\d{1,2})/i);
 const updated=match?`${match[1]}${match[2].padStart(2,'0')}${match[3].padStart(2,'0')}`:null;
 let section='';const bySection={};
 for(const m of html.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)){
  const cells=[...m[1].matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi)].map(x=>clean(x[1]));
  if(cells.length===1){section=cells[0].trim();continue;}
  if(cells.length<7||/Security Code/i.test(cells[0]))continue;
  const id=cells[0].match(/^([^\s]+)\s+(.+)$/);if(!id)continue;
  const listed=cells[2].match(/^((?:19|20)\d\d)[\/-]([01]\d)[\/-]([0-3]\d)$/);
  (bySection[section]??=[]).push({code:id[1],name:id[2],isin:cells[1],listed_date:listed?listed.slice(1).join(''):null,market:cells[3],industry:cells[4],cfi:cells[5],remarks:cells[6]});
 }
 return {updated,bySection};
}
function parseCompany(bytes){
 const data=JSON.parse(bytes.toString('utf8').replace(/^\uFEFF/,''));
 if(!Array.isArray(data))throw Error('COMPANY_NOT_ARRAY');
 const dates=[...new Set(data.map(x=>companyDate(x['出表日期'])))],seen=new Set();
 if(dates.includes(null))throw Error('INVALID_COMPANY_REPORT_DATE');
 for(const row of data){const c=String(row['公司代號']||'');if(!c||seen.has(c))throw Error('DUPLICATE_COMPANY_CODE');seen.add(c);}
 return {data,report_dates:dates};
}
function parseRtf(bytes){
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'twse-listing-'));
 let t;try{const filename=path.join(dir,'in.rtf');fs.writeFileSync(filename,bytes);t=cp.execFileSync('unrtf',['--text',filename],{encoding:'latin1',maxBuffer:16*1024*1024});}finally{fs.rmSync(dir,{recursive:true,force:true});}
 const i=t.indexOf('{');if(i<0)throw Error('RTF_JSON_NOT_FOUND');
 const o=JSON.parse(t.slice(i).replace(/\xa0/g,' '));if(o.stat!=='OK'||!Array.isArray(o.data))throw Error('RTF_LISTING_INVALID');
 return o;
}
function reconcile(isin,company,listings,target){
 const rows=isin.bySection.Stocks||[],seen=new Set(),duplicated=[];
 const firms=new Map(company.data.map(x=>[String(x['公司代號']),x])),events=new Map();
 for(const e of listings.data){if(e[0]&&e[9])events.set(String(e[0]),roc(e[9]));}
 const per_code=rows.map(row=>{
  if(seen.has(row.code))duplicated.push(row.code);seen.add(row.code);
  const firm=firms.get(row.code),event=events.get(row.code),company_listed_date=firm?companyDate(firm['上市日期']):null;
  const issues=[];
  if(!firm)issues.push('NOT_IN_COMPANY_REPORT');
  if(row.listed_date&&row.listed_date>target)issues.push('LISTED_AFTER_TARGET');
  if(firm&&company_listed_date!==row.listed_date)issues.push('LISTING_DATE_CONFLICT');
  if(event&&event!==row.listed_date)issues.push('RECENT_LISTING_DATE_CONFLICT');
  if(row.cfi!=='ESVUFR')issues.push('CFI_REQUIRES_INDEPENDENT_CLASSIFICATION');
  if(isin.updated!==target)issues.push('ISIN_POST_TARGET_SNAPSHOT');
  return {...row,company_listed_date,recent_listing_date:event||null,issues,historical_effective_date_verified:false};
 });
 const extra=company.data.filter(x=>!seen.has(String(x['公司代號']))).map(x=>({code:String(x['公司代號']),name:x['公司簡稱']}));
 const differences=per_code.filter(x=>x.issues.some(y=>y!=='ISIN_POST_TARGET_SNAPSHOT'));
 return {schema_version:1,scope:'RESEARCH_ONLY',target_date:target,isin_publisher_date:isin.updated,company_report_dates:company.report_dates,
  counts:{isin_stock_rows:rows.length,twse_listed:rows.filter(x=>x.market==='TWSE LISTED').length,innovation:rows.filter(x=>x.market==='TAIWAN INNOVATION BOARD').length,company_rows:company.data.length,company_extra:extra.length,listing_events:listings.data.length,extra_differences:differences.length},
  company_extra:extra,duplicate_isin:duplicated,per_code,differences,publication_authorized:false,historical_master_complete:false,
  decision:'BLOCKED_DATE_EFFECTIVENESS'};
}
function audit({isinPath,companyPath,listingPath,outDir,target='20261008'}){
 if(!/^20\d{6}$/.test(target))throw Error('INVALID_TARGET');
 const raw=[fs.readFileSync(isinPath),fs.readFileSync(companyPath),fs.readFileSync(listingPath)];
 const report=reconcile(parseIsin(raw[0]),parseCompany(raw[1]),parseRtf(raw[2]),target);
 report.sources=[isinPath,companyPath,listingPath].map((p,i)=>({name:['isin_html','company_json','listing_rtf'][i],filename:path.basename(p),bytes:raw[i].length,sha256:sha(raw[i])}));
 fs.mkdirSync(outDir,{recursive:true});
 fs.writeFileSync(path.join(outDir,'audit.json'),JSON.stringify(report,null,2)+'\n');
 fs.writeFileSync(path.join(outDir,'per-code-differences.json'),JSON.stringify(report.differences,null,2)+'\n');
 const cells=['code','name','market','cfi','listed_date','company_listed_date','recent_listing_date','issues'];
 const csv=[cells.join(','),...report.differences.map(r=>cells.map(k=>'"'+String(k==='issues'?r.issues.join(';'):(r[k]??'')).replace(/"/g,'""')+'"').join(','))].join('\n')+'\n';
 fs.writeFileSync(path.join(outDir,'per-code-differences.csv'),'\uFEFF'+csv);
 return report;
}
if(require.main===module){try{const [isinPath,companyPath,listingPath,outDir,target]=process.argv.slice(2);if(!outDir)throw Error('Usage: node script.js ISIN.html COMPANIES.json LISTINGS.rtf OUT [YYYYMMDD]');const r=audit({isinPath,companyPath,listingPath,outDir,target});console.log(JSON.stringify({counts:r.counts,decision:r.decision,sources:r.sources}));}catch(e){console.error(e.stack);process.exitCode=1;}}
module.exports={roc,sha,parseIsin,parseCompany,parseRtf,reconcile,audit};
