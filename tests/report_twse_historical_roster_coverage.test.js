'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {report}=require('../scripts/report_twse_historical_roster_coverage');
const {blobSha,PINNED}=require('../scripts/audit_twse_isin_category_snapshot');
test('coverage report never promotes issuer evidence from Git blob integrity',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'twse-coverage-'));
 const original={...PINNED};
 try{
  for(const [category,code] of Object.entries({Stock:'1589',InnovationBoard:'2237',TDR:'9103',ETF:'0050'})){
   const raw=Buffer.from('Code,Name,Industry\n'+code+',示例,產業\n');
   fs.writeFileSync(path.join(dir,'twse_industry_'+category+'.csv'),raw);
   original[category]=blobSha(raw);
  }
  // This test fixture does not match pinned historical blobs and must fail closed.
  assert.throws(()=>report({root:dir}),/BLOB_SHA_MISMATCH/);
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
test('absence of external evidence cannot become effective-date verification',()=>{
 assert.equal(require('../scripts/report_twse_historical_roster_coverage').KNOWN['2323'].status,'SUSPENDED');
 assert.equal(require('../scripts/audit_twse_isin_category_snapshot').SNAPSHOT_COMMIT,'797628c405a1');
});

test('quote join rejects archive whose bytes do not match pinned source',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'mi-quote-invalid-'));
 try{
  const filename=path.join(dir,'quote.json');fs.writeFileSync(filename,'{}');
  assert.throws(()=>require('../scripts/report_twse_historical_roster_coverage').quoteCodes(filename),/QUOTE_ARCHIVE_DIGEST_MISMATCH/);
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
test('quote join rejects mismatched date even when digest matches supplied test digest',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'mi-quote-date-'));
 try{
  const filename=path.join(dir,'quote.json'),bytes=Buffer.from(JSON.stringify({date:'20261007',stat:'OK',tables:[]}));
  fs.writeFileSync(filename,bytes);
  const digest=require('node:crypto').createHash('sha256').update(bytes).digest('hex');
  assert.throws(()=>require('../scripts/report_twse_historical_roster_coverage').quoteCodes(filename,digest),/QUOTE_ARCHIVE_DATE_MISMATCH/);
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
