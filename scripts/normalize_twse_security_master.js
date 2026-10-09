'use strict';
/**
 * Normalize an archived, externally verified TWSE security classification export.
 * Input JSON:
 * {source:{publisher:"TWSE",reference:"https://...",snapshot_date:"YYYYMMDD",
 *  acquired_at:"ISO time",archive_sha256:"64 lowercase hex"},
 *  securities:[{code,market,security_type,listing_date,delisting_date?}]}
 * This is intentionally NOT a stock-code-length filter or an inference from
 * a *current* ISIN listing. Historical identity cannot be reconstructed from
 * today's roster alone.
 */
const fs=require('node:fs');
const crypto=require('node:crypto');
function ymd(v){return /^20\d{6}$/.test(String(v||''))&&!Number.isNaN(Date.parse(v.slice(0,4)+'-'+v.slice(4,6)+'-'+v.slice(6,8)+'T00:00:00Z'));}
function normalizeArchive(input,date){
 if(!ymd(date))throw Error('INVALID_DATE');
 const s=input?.source;
 if(s?.publisher!=='TWSE'||!/^https:\/\//.test(s.reference||'')||s.snapshot_date!==date||!/^([a-f0-9]{64})$/.test(s.archive_sha256||''))throw Error('UNPROVEN_DATE_SPECIFIC_TWSE_ARCHIVE');
 if(!Array.isArray(input.securities)||!input.securities.length)throw Error('EMPTY_ARCHIVE');
 const seen=new Set(),securities=[];
 for(const row of input.securities){
  const code=String(row?.code||'').trim();
  if(!code||seen.has(code)||row.market!=='TWSE'||!['COMMON_STOCK','OTHER'].includes(row.security_type))throw Error('INVALID_SECURITY_ROW:'+code);
  if(!ymd(row.listing_date)||row.listing_date>date||row.delisting_date&&(!ymd(row.delisting_date)||row.delisting_date<date))throw Error('INVALID_LISTING_WINDOW:'+code);
  seen.add(code);
  securities.push({code,market:'TWSE',security_type:row.security_type,classification_verified:true});
 }
 return {date,market:'TWSE',source:{publisher:s.publisher,reference:s.reference,as_of_date:date,archive_sha256:s.archive_sha256,archive_record_count:securities.length},securities};
}
function main(argv=process.argv.slice(2)){
 const [date,inputPath,outputPath,archivePath]=argv;
 if(!date||!inputPath||!outputPath||!archivePath)throw Error('Usage: node scripts/normalize_twse_security_master.js YYYYMMDD verified-manifest.json output.json source-archive.bin');
 const input=JSON.parse(fs.readFileSync(inputPath,'utf8'));
 // SHA-256 must refer to the externally archived ORIGINAL source, not this manifest.
 // Cross-file provenance verification belongs to the acquisition workflow.
 const digest=verifyArchiveDigest(input,fs.readFileSync(archivePath));
 const result=normalizeArchive(input,date);
 result.source.digest_verified=true;
 result.source.archive_sha256=digest;
 fs.writeFileSync(outputPath,JSON.stringify(result,null,2)+'\n');
}
if(require.main===module){try{main();}catch(error){console.error(error.message);process.exitCode=1;}}
module.exports={normalizeArchive,verifyArchiveDigest,ymd};
