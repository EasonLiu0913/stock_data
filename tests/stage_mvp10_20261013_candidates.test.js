'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {build}=require('../scripts/stage_mvp10_20261013_candidates');
test('staging refuses nonexistent source rather than creating final',()=>{
 const out=path.join(os.tmpdir(),'mvp10-nonexistent-'+process.pid);
 assert.throws(()=>build('/nonexistent/frozen-source',out));
});
test('source tree cannot be staging destination',()=>{
 const p=fs.mkdtempSync(path.join(os.tmpdir(),'mvp10-staging-'));
 try {
  assert.throws(()=>build(p,p),/OUTPUT_MUST_BE_NEW_SEPARATE_ISOLATED_DIRECTORY/);
  assert.throws(()=>build(p,path.join(p,'nested')),/OUTPUT_MUST_BE_NEW_SEPARATE_ISOLATED_DIRECTORY/);
 } finally { fs.rmSync(p,{recursive:true,force:true}); }
});
