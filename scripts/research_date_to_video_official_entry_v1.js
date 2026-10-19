'use strict';
// Research-only date entry: reuse verified archive or bounded BFI82U recovery before dated D4 diagnostics.
const fs=require('node:fs'),path=require('node:path');
const {recover}=require('./research_official_data_recovery_v1');
const {run}=require('./research_date_to_video_d4_orchestrator');
async function execute(root,date,out,options={}){
 if(!/^20\d{6}$/.test(date||'')||!Number.isFinite(Date.parse(date.slice(0,4)+'-'+date.slice(4,6)+'-'+date.slice(6,8)+'T00:00:00Z'))||new Date(date.slice(0,4)+'-'+date.slice(4,6)+'-'+date.slice(6,8)+'T00:00:00Z').toISOString().slice(0,10)!==date.slice(0,4)+'-'+date.slice(4,6)+'-'+date.slice(6,8))throw Error('INVALID_TARGET_DATE');
 if(!out||path.resolve(out)===path.resolve(root)||path.resolve(out).startsWith(path.resolve(root)+path.sep))throw Error('EXTERNAL_ISOLATED_OUTPUT_DIRECTORY_REQUIRED');
 // A failed retry must never leave the previous successful entry report visible.
 const reportPath=path.join(out,'official-entry-status.json');
 if(fs.existsSync(reportPath))fs.unlinkSync(reportPath);
 const recovery=await recover(root,date,options);
 const d4=run(root,date,out);
 const datedManifest=JSON.parse(fs.readFileSync(path.join(out,'official-data-manifest.json'),'utf8'));
 if(datedManifest.target_date!==date||datedManifest.manifest_sha256!==recovery.manifest.manifest_sha256)throw Error('OFFICIAL_ENTRY_RECOVERY_D4_MANIFEST_MISMATCH');
 const recoveryPlan=JSON.parse(fs.readFileSync(path.join(out,'official-data-recovery-plan.json'),'utf8'));
 if(recoveryPlan.target_date!==date||recoveryPlan.manifest_sha256!==datedManifest.manifest_sha256)throw Error('OFFICIAL_ENTRY_RECOVERY_PLAN_MANIFEST_MISMATCH');
 const report={contract:'DATE_TO_VIDEO_OFFICIAL_ENTRY_RESEARCH_V1',target_date:date,recovery_status:recovery.status,recovery_attempts:recovery.attempts,recovery_reason:recovery.reason||null,manifest_sha256:datedManifest.manifest_sha256,d4_status:d4.stages[0].status,source_actions:recoveryPlan.sources.map(s=>({id:s.id,status:s.status,action_required:s.action_required,automated_retrieval_allowed:s.automated_retrieval_allowed})),blockers:d4.blockers,render_authorized:false,publication_authorized:false};
 fs.writeFileSync(reportPath,JSON.stringify(report,null,2)+'\n');
 return report;
}
if(require.main===module){const [date,root='.',out]=process.argv.slice(2);execute(root,date,out).then(x=>{console.log(JSON.stringify(x,null,2));if(!['REUSED_VERIFIED_ARCHIVE','RECOVERED_VERIFIED_ARCHIVE'].includes(x.recovery_status)||x.blockers.length)process.exitCode=3}).catch(e=>{console.error(e.message);process.exitCode=2});}
module.exports={execute};
