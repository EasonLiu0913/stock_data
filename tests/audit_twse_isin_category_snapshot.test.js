'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {blobSha,parseCsv,inspect}=require('../scripts/audit_twse_isin_category_snapshot');
test('Git blob SHA verifies raw bytes, not ordinary SHA-1',()=>{
 const b=Buffer.from('Code,Name,Industry\n1101,台泥,水泥\n');
 assert.equal(blobSha(b).length,40);
 assert.notEqual(blobSha(b),require('node:crypto').createHash('sha1').update(b).digest('hex'));
});
test('duplicate entries cannot masquerade as category coverage',()=>{
 assert.throws(()=>parseCsv(Buffer.from('Code,Name,Industry\n1101,甲,A\n1101,乙,B\n'),'Stock'),/DUPLICATE/);
});
test('verified bytes still cannot authorize historical trading-day publication',()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'isin-snapshot-'));
 try{
  const expected={};
  for(const [cat,code] of Object.entries({Stock:'1101',InnovationBoard:'2237',TDR:'9103',ETF:'0050'})){
   const b=Buffer.from('Code,Name,Industry\n'+code+',示例,分類\n');
   fs.writeFileSync(path.join(root,'twse_industry_'+cat+'.csv'),b);expected[cat]=blobSha(b);
  }
  const result=inspect({root,expected});
  assert.equal(result.unique_codes,4);
  assert.equal(result.historical_effective_date_verified,false);
  assert.equal(result.publication_authorized,false);
  fs.writeFileSync(path.join(root,'twse_industry_Stock.csv'),'changed');
  assert.throws(()=>inspect({root,expected}),/BLOB_SHA_MISMATCH/);
 }finally{fs.rmSync(root,{recursive:true,force:true});}
});
test('cross-category duplicate codes fail closed',()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'isin-overlap-'));
 try{
  const expected={};
  for(const cat of ['Stock','InnovationBoard']){
   const b=Buffer.from('Code,Name,Industry\n1101,示例,分類\n');
   fs.writeFileSync(path.join(root,'twse_industry_'+cat+'.csv'),b);expected[cat]=blobSha(b);
  }
  assert.throws(()=>inspect({root,expected}),/CROSS_CATEGORY_OVERLAP/);
 }finally{fs.rmSync(root,{recursive:true,force:true});}
});
