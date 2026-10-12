'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
function write(root,request,sourceBytes,outputBytes){
 assert.equal(request.mode,'isolated_research_only');assert.equal(request.dataset,'daily_gainers_list');assert.equal(request.date,'20261008');assert.equal(request.prior_date,'20261007');
 assert.deepEqual(Object.keys(request).sort(),['dataset','date','mode','prior_date','source_sha256','target'].sort());assert.equal(request.target,'daily_5pct_video');
 assert(Array.isArray(request.source_sha256)&&request.source_sha256.length===2);
 assert(sourceBytes.length===2);sourceBytes.forEach((b,i)=>assert.equal(sha(b),request.source_sha256[i],'source digest mismatch'));
 const data=JSON.parse(outputBytes.toString('utf8'));assert.equal(data.target_date,request.date);assert.equal(data.previous_date,request.prior_date);assert.equal(data.threshold_pct,5);assert.equal(data.stock_count,data.stocks.length);assert(data.stock_count>0);
 assert.deepEqual(data.source_files,['data_fubon/fubon_20261007_sma.json','data_fubon/fubon_20261008_sma.json']);
 for(const x of data.stocks)assert(x.change_pct>=5&&x.close>0&&x.previous_close>0);
 assert(fs.realpathSync(root).startsWith(fs.realpathSync(require('node:os').tmpdir())+path.sep),'root must be OS temp');
 const dest=path.join(root,'exp05-writer-20261008.json'),manifestPath=path.join(root,'exp05-writer-20261008.manifest.json');
 const manifest={schema:'exp05-isolated-writer-v1',date:request.date,source_sha256:request.source_sha256,output_sha256:sha(outputBytes),stock_count:data.stock_count,production_safe_paths:[]};
 if(fs.existsSync(dest)||fs.existsSync(manifestPath)){assert(fs.existsSync(dest)&&fs.existsSync(manifestPath),'partial state');assert.equal(sha(fs.readFileSync(dest)),manifest.output_sha256,'immutable output mismatch');assert.deepEqual(JSON.parse(fs.readFileSync(manifestPath,'utf8')),manifest,'immutable manifest mismatch');return {decision:'ALREADY_COMPLETE',manifest};}
 fs.writeFileSync(dest,outputBytes,{flag:'wx'});fs.writeFileSync(manifestPath,JSON.stringify(manifest,null,2)+'\n',{flag:'wx'});
 return {decision:'WRITTEN_ISOLATED',manifest};
}
module.exports={write,sha};
