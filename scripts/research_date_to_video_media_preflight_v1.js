'use strict';
// Research-only fail-closed date/media provenance preflight. Never authorizes synthesis.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {FIXED_OPENING_LINES}=require('./research_date_to_video_fixed_opening_v1');
const sha=x=>crypto.createHash('sha256').update(x).digest('hex');
function inspect(dir){
 const read=name=>{const file=path.join(dir,name);return fs.existsSync(file)?JSON.parse(fs.readFileSync(file,'utf8')):null};
 const handoff=read('media-handoff.json'),master=read('market-master.json'),task=read('original-analysis-task.json'),review=read('editorial-review.json'),input=read('editorial-input-manifest.json');
 const issues=[];const fail=(code,condition)=>{if(!condition)issues.push(code)};
 fail('HANDOFF_REQUIRED',!!handoff);fail('MASTER_REQUIRED',!!master);fail('ANALYSIS_TASK_REQUIRED',!!task);fail('EDITORIAL_REVIEW_REQUIRED',!!review);fail('EDITORIAL_INPUT_MANIFEST_REQUIRED',!!input);
 const date=handoff?.target_date;
 fail('VALID_EXPLICIT_DATE',typeof date==='string'&&/^20\d{6}$/.test(date));
 for(const [name,obj] of [['MASTER',master],['TASK',task],['REVIEW',review],['INPUT',input]])fail(name+'_DATE_MATCH',!!date&&obj?.target_date===date);
 fail('MASTER_SHA_MATCH',!!master&&!!task&&!!handoff&&task.market_master_sha256===handoff.source_master_sha256&&sha(JSON.stringify(master))===handoff.source_master_sha256);
 fail('TASK_SHA_MATCH',!!task&&!!handoff&&sha(JSON.stringify(task))===handoff.analysis_task_sha256);
 fail('REVIEW_GATE_SHA_MATCH',!!review&&!!input&&!!handoff&&sha(JSON.stringify(review))===input.review_gate_sha256&&input.review_gate_sha256===handoff.review_gate_sha256);
 fail('DRAFT_CHECK_SHA_MATCH',!!input&&!!handoff&&input.draft_check_sha256===handoff.draft_check_sha256);
 fail('OPENING_CANONICAL',!!handoff&&JSON.stringify(handoff.fixed_opening_lines)===JSON.stringify(FIXED_OPENING_LINES));
 fail('NO_RENDER_OR_PUBLICATION_AUTHORIZATION',[handoff,master,task,review,input].every(x=>x&&x.render_authorized!==true&&x.publication_authorized!==true));
 fail('EDITORIAL_CERTIFICATION_REQUIRED',review?.editorial_certified===true&&input?.editorial_certified===true&&handoff?.editorial_certified===true);
 fail('DATED_MEDIA_BRIDGE_NOT_IMPLEMENTED',handoff?.date_parameterized_media_bridge_implemented===true);
 return {contract:'DATE_TO_VIDEO_V1_RESEARCH_MEDIA_PREFLIGHT',target_date:date||null,status:issues.length?'BLOCKED':'READY_FOR_SEPARATE_MEDIA_REVIEW',issues,render_authorized:false,publication_authorized:false};
}
if(require.main===module){const dir=process.argv[2];if(!dir){console.error('Usage: node scripts/research_date_to_video_media_preflight_v1.js D4-output-dir');process.exit(2)}try{const result=inspect(dir);console.log(JSON.stringify(result,null,2));if(result.status==='BLOCKED')process.exitCode=3}catch(e){console.error(e.message);process.exitCode=2}}
module.exports={inspect};
