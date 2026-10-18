'use strict';
// Date-to-Video V1 D1: read-only date entry and fail-closed stage plan. Not a renderer.
const fs=require('node:fs'),path=require('node:path');
const {inspectDate}=require('./research_multidate_input_readiness_v1');
const STAGES=['source_readiness','market_master','original_editorial','semantic_projection','media_render','acceptance_artifacts'];
function plan(root,date){
 const r=inspectDate(root,date);
 const stages=STAGES.map((name,i)=>({name,status:i===0?(r.ready?'INPUT_FILES_PRESENT':'WAITING_SOURCE'):'NOT_RUN'}));
 const blockers=[...r.missing.map(x=>'MISSING:'+x),...r.wrong_date.map(x=>'WRONG_DATE_OR_INVALID_JSON:'+x)];
 // Existence and root date are necessary, never sufficient for provenance or media.
 if(r.ready)blockers.push('SOURCE_PROVENANCE_AND_FINAL_BFI82U_NOT_YET_CERTIFIED');
 return {contract:'DATE_TO_VIDEO_V1_D1',target_date:date,mode:'dry-run',research_only:true,publication_authorized:false,render_authorized:false,ready_to_render:false,stages,blockers,input_file_presence:r.present,baseline_immutable:date==='20261008'};
}
if(require.main===module){
 const date=process.argv[2],root=process.argv[3]||'.',out=process.argv[4];
 if(!date){console.error('Usage: node scripts/research_date_to_video_v1.js YYYYMMDD [repo-root] [output-json]');process.exit(2)}
 try{const result=plan(root,date),body=JSON.stringify(result,null,2)+'\n';if(out){fs.mkdirSync(path.dirname(out),{recursive:true});fs.writeFileSync(out,body)}process.stdout.write(body);process.exitCode=result.stages[0].status==='WAITING_SOURCE'?3:0}catch(e){console.error(e.message);process.exitCode=2}
}
module.exports={plan,STAGES};
