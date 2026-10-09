'use strict';
// Research-only: pinned TWSE ISIN exports. Git blob integrity is not proof of
// exchange acquisition time, effective-date coverage, or publication authority.
const fs=require('node:fs'), crypto=require('node:crypto');
const PINNED=Object.freeze({
 Stock:'3ae90b6796f67e39448e1df5b9320f04e46af660',
 InnovationBoard:'943b00417696a63f6d85535cfa553a829fc723d6',
 TDR:'adbd3d6a1174b2908c072e8b653d115bbb5b5680',
 ETF:'6a0a8b92c44ccebe47bc1da038cb4b38cd1be20b'
});
const SNAPSHOT_COMMIT='797628c405a1';
function blobSha(bytes){return crypto.createHash('sha1').update(Buffer.concat([Buffer.from('blob '+bytes.length+'\0'),bytes])).digest('hex');}
function parseCsv(bytes,category){
 const content=bytes.toString('utf8').replace(/^\uFEFF/,'');
 const lines=content.split(/\r?\n/).filter(Boolean);
 if(lines.shift()!=='Code,Name,Industry')throw Error('CSV_HEADER_INVALID:'+category);
 const records=new Map();
 for(const line of lines){
  const [code,name]=line.split(',');
  if(!code||!name||records.has(code))throw Error('INVALID_OR_DUPLICATE_CODE:'+category+':'+code);
  records.set(code,name);
 }
 return records;
}
function inspect({root='data_twse',expected=PINNED}={}){
 const categories={};const seen=new Map();const overlaps=[];
 for(const [category,expectedSha] of Object.entries(expected)){
  if(!/^[a-f0-9]{40}$/.test(expectedSha))throw Error('INVALID_PINNED_SHA:'+category);
  const bytes=fs.readFileSync(root+'/twse_industry_'+category+'.csv');
  const actual=blobSha(bytes);
  if(actual!==expectedSha)throw Error('BLOB_SHA_MISMATCH:'+category);
  const records=parseCsv(bytes,category);
  categories[category]={count:records.size,blob_sha:actual};
  for(const code of records.keys()){
   if(seen.has(code))overlaps.push({code,first:seen.get(code),second:category});
   else seen.set(code,category);
  }
 }
 if(overlaps.length)throw Error('CROSS_CATEGORY_OVERLAP:'+JSON.stringify(overlaps.slice(0,10)));
 return {snapshot_commit:SNAPSHOT_COMMIT,categories,unique_codes:seen.size,
  source_integrity_verified:true,historical_effective_date_verified:false,
  twse_common_stock_scope_verified:false,publication_authorized:false};
}
if(require.main===module){try{console.log(JSON.stringify(inspect(),null,2));}catch(e){console.error(e.message);process.exitCode=1;}}
module.exports={blobSha,parseCsv,inspect,PINNED,SNAPSHOT_COMMIT};
