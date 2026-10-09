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
