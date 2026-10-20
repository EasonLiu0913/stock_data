'use strict';
// Research-only AI response adapter. No API invocation, credentials, editorial approval or media authorization.
const fs=require('node:fs'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const {preflight}=require('./research_date_to_video_d4_candidate_preflight');
const sha=x=>crypto.createHash('sha256').update(JSON.stringify(x)).digest('hex');
function adapt(task,master,inventory,review,response){
 assert.equal(task?.contract,'DATE_TO_VIDEO_V1_ORIGINAL_ANALYSIS_TASK','TASK_CONTRACT');
 assert.equal(task.status,'READY_FOR_EVIDENCE_GROUNDED_DRAFT','TASK_NOT_READY');
 assert.equal(task.target_date,master?.target_date,'MASTER_DATE');
 assert.equal(task.target_date,inventory?.target_date,'INVENTORY_DATE');
 assert.equal(task.target_date,review?.target_date,'REVIEW_DATE');
 assert.equal(task.market_master_sha256,sha(master),'MASTER_SHA');
 assert.equal(task.claim_inventory_sha256,sha(inventory),'INVENTORY_SHA');
 assert.equal(response?.target_date,task.target_date,'AI_RESPONSE_DATE');
 assert.equal(response?.contract,'DATE_TO_VIDEO_V1_D4_AUTHORED_RESEARCH_CANDIDATE','AI_RESPONSE_CONTRACT');
 assert.ok(Array.isArray(response.insights)&&response.insights.length>0,'EMPTY_INSIGHTS');
 const ids=new Set(),sections=new Set();
 for(const i of response.insights){
  assert.ok(typeof i.id==='string'&&i.id.trim()&&!ids.has(i.id),'INSIGHT_ID');ids.add(i.id);
  assert.ok(task.required_sections.includes(i.section),'INSIGHT_SECTION');sections.add(i.section);
  for(const k of ['observation','interpretation','uncertainty'])assert.ok(typeof i[k]==='string'&&i[k].trim(),'INSIGHT_'+k);
  assert.ok(Array.isArray(i.evidence)&&i.evidence.length>0,'INSIGHT_EVIDENCE');
  for(const e of i.evidence)assert.ok(e&&((e.type==='claim_id'&&typeof e.id==='string')||(e.type==='master_field'&&typeof e.path==='string'&&/^[a-z_][a-z0-9_]*(?:\.[a-z_][a-z0-9_]*)*$/.test(e.path))),'EVIDENCE_SHAPE');
 }
 for(const s of task.required_sections)assert.ok(sections.has(s),'MISSING_SECTION_'+s);
 const audit=preflight(response,master,inventory,review);
 assert.equal(audit.unknown_claim_ids.length,0,'UNKNOWN_CLAIM');
 assert.equal(audit.invalid_master_fields.length,0,'INVALID_MASTER_FIELD');
 return {contract:'DATE_TO_VIDEO_V1_D4_AI_RESEARCH_CANDIDATE_HANDOFF',target_date:task.target_date,status:audit.missing_claim_reviews.length?'PENDING_INDEPENDENT_CLAIM_REVIEW':'STRUCTURAL_PREFLIGHT_ONLY',candidate:response,candidate_sha256:sha(response),preflight:audit,editorial_certified:false,narration_authorized:false,render_authorized:false,publication_authorized:false};
}
if(require.main===module){
 const args=process.argv.slice(2);
 if(args.length!==6){console.error('Usage: node scripts/research_date_to_video_ai_candidate_adapter_v1.js task.json master.json claims.json review.json ai-response.json output.json');process.exitCode=2;}
 else try{
  const [task,master,inventory,review,response]=args.slice(0,5).map(p=>JSON.parse(fs.readFileSync(p,'utf8')));
  const handoff=adapt(task,master,inventory,review,response);
  fs.writeFileSync(args[5],JSON.stringify(handoff,null,2)+'\n',{flag:'wx'});
  console.log(JSON.stringify({status:handoff.status,target_date:handoff.target_date,candidate_sha256:handoff.candidate_sha256}));
 }catch(e){console.error(e.message);process.exitCode=1;}
}
module.exports={adapt};
