'use strict';
// Deterministic offline editorial worksheet; never produces approved narration or media.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {build}=require('./research_date_to_video_dated_media_input_v1');
const sha=x=>crypto.createHash('sha256').update(JSON.stringify(x)).digest('hex');
function prepare(dir){
 const input=build(dir),read=name=>{const p=path.join(dir,name);return fs.existsSync(p)?JSON.parse(fs.readFileSync(p,'utf8')):null};
 const task=read('original-analysis-task.json'),master=read('market-master.json'),draft=read('original-analysis-draft.json'),check=read('original-analysis-draft-check.json');
 const issues=[...input.blockers];
 if(!draft)issues.push('ORIGINAL_ANALYSIS_DRAFT_REQUIRED');
 if(!check||check.status!=='STRUCTURAL_EVIDENCE_VALIDATED_INDEPENDENT_EDITORIAL_REVIEW_REQUIRED'||check.draft_sha256!==sha(draft)||check.task_sha256!==sha(task))issues.push('DRAFT_STRUCTURAL_EVIDENCE_REQUIRED');
 if(!master||!task||task.target_date!==input.target_date||task.market_master_sha256!==sha(master))issues.push('DATED_MASTER_TASK_REQUIRED');
 return {contract:'DATE_TO_VIDEO_V1_RESEARCH_EDITORIAL_NARRATION_WORKSHEET',target_date:input.target_date,source_master_sha256:input.source_master_sha256,draft_sha256:draft?sha(draft):null,status:'INDEPENDENT_EDITORIAL_REVIEW_REQUIRED',issues:[...new Set(issues)],sections:Array.isArray(draft?.insights)?draft.insights.map(x=>({insight_id:x.id,section:x.section,observation:x.observation,interpretation:x.interpretation,uncertainty:x.uncertainty,evidence:x.evidence,narration:null,subtitle:null,editorial_decision:'PENDING'})):[],fixed_opening_lines:input.fixed_opening_lines,editorial_certified:false,narration_authorized:false,render_authorized:false,publication_authorized:false};
}
module.exports={prepare};
