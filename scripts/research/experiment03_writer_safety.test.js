'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {recover}=require('./experiment03_data_only');
const root=fs.mkdtempSync(path.join(os.tmpdir(),'daily-recovery-exp03-'));
try {
 const request={target:'daily_5pct_video',mode:'synthetic_data_only',dataset:'facts',date:'20261013',as_of:'20261013'};
 const first=recover(root,request);assert.equal(first.written,true);
 const second=recover(root,request);assert.equal(second.written,false);
 const invalid={...request,date:'20261399'};assert.throws(()=>recover(root,invalid));
 const stale={...request,as_of:'20261012'};assert.throws(()=>recover(root,stale));
 const other={...request,dataset:'news'};assert.throws(()=>recover(root,other));
 const extra={...request,workflow:'deploy-pages'};assert.throws(()=>recover(root,extra));
 fs.writeFileSync(first.path,JSON.stringify({stale:true}));
 assert.throws(()=>recover(root,request));
 console.log('EXPERIMENT_03_WRITER_SAFETY_PASS: synthetic write, idempotency and fail-closed; zero production writes');
} finally {fs.rmSync(root,{recursive:true,force:true});}
