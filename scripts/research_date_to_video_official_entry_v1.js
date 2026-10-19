'use strict';
// Research-only date entry: reuse verified archive or bounded BFI82U recovery before dated D4 diagnostics.
const fs=require('node:fs'),path=require('node:path');
const {recover}=require('./research_official_data_recovery_v1');
const {run}=require('./research_date_to_video_d4_orchestrator');
async function execute(root,date,out,options={}){
 if(!/^20\d{6}$/.test(date||''))throw Error('INVALID_TARGET_DATE');
 if(!out||path.resolve(out)===path.resolve(root)||path.resolve(out).startsWith(path.resolve(root)+path.sep))throw Error('EXTERNAL_ISOLATED_OUTPUT_DIRECTORY_REQUIRED');
 const recovery=await recover(root,date,options);
 const d4=run(root,date,out);
 const report={contract:'DATE_TO_VIDEO_OFFICIAL_ENTRY_RESEARCH_V1',target_date:date,recovery_status:recovery.status,recovery_attempts:recovery.attempts,recovery_reason:recovery.reason||null,d4_status:d4.stages[0].status,blockers:d4.blockers,render_authorized:false,publication_authorized:false};
 fs.writeFileSync(path.join(out,'official-entry-status.json'),JSON.stringify(report,null,2)+'\n');
 return report;
}
if(require.main===module){const [date,root='.',out]=process.argv.slice(2);execute(root,date,out).then(x=>{console.log(JSON.stringify(x,null,2));if(!['REUSED_VERIFIED_ARCHIVE','RECOVERED_VERIFIED_ARCHIVE'].includes(x.recovery_status)||x.blockers.length)process.exitCode=3}).catch(e=>{console.error(e.message);process.exitCode=2});}
module.exports={execute};
