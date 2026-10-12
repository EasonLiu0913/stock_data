'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const KEY='facts';
function recover(root, request) {
 assert.deepEqual(Object.keys(request).sort(), ['as_of','dataset','date','mode','target'].sort());
 assert.equal(request.target,'daily_5pct_video');
 assert.equal(request.mode,'synthetic_data_only');
 assert.equal(request.dataset,KEY);
 assert.match(request.date,/^20[0-9]{6}$/);
 const iso=request.date.slice(0,4)+'-'+request.date.slice(4,6)+'-'+request.date.slice(6);
 assert.equal(new Date(iso+'T00:00:00Z').toISOString().slice(0,10),iso);
 assert.equal(request.as_of,request.date);
 const dir=path.join(root,'research-artifacts','daily-recovery-exp03');
 const dest=path.join(dir,request.date+'-'+KEY+'.json');
 const expected={date:request.date,as_of:request.as_of,dataset:KEY,origin:'synthetic_exp03',record_count:1,records:[{stock:'2330',valid:true}]};
 if(fs.existsSync(dest)) {
   const old=JSON.parse(fs.readFileSync(dest,'utf8'));
   assert.deepEqual(old,expected,'existing artifact is invalid; fail closed');
   return {decision:'COMPLETE',written:false,path:dest};
 }
 fs.mkdirSync(dir,{recursive:true});
 const bytes=JSON.stringify(expected,null,2)+'\n';
 const temp=dest+'.tmp';
 fs.writeFileSync(temp,bytes,{flag:'wx'});
 fs.renameSync(temp,dest);
 const verified=JSON.parse(fs.readFileSync(dest,'utf8'));
 assert.deepEqual(verified,expected);
 return {decision:'RECOVERED_SYNTHETIC',written:true,path:dest,sha256:crypto.createHash('sha256').update(bytes).digest('hex')};
}
module.exports={recover};
if(require.main===module) {
 const [root,file]=process.argv.slice(2);
 assert(root&&file,'requires explicit sandbox root and JSON request');
 process.stdout.write(JSON.stringify(recover(root,JSON.parse(fs.readFileSync(file,'utf8'))))+'\n');
}
