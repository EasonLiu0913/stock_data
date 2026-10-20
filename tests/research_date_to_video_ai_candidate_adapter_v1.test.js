'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {adapt}=require('../scripts/research_date_to_video_ai_candidate_adapter_v1');
const sha=x=>crypto.createHash('sha256').update(JSON.stringify(x)).digest('hex');
function fixture(){
 const master={target_date:'20261013',status:'RESEARCH_MARKET_MASTER_SOURCE_CROSSCHECKED_EDITORIAL_PENDING',taiex:{close:123}};
 const inventory={target_date:'20261013',claims:[{claim_id:'20261013:6668:PRICE_CHANGE',kind:'PRICE_CHANGE',origin:'FACTS',statement:'price',evidence_sources:[]}]};
 const review={target_date:'20261013',inventory_sha256:sha(inventory),approved_claim_ids:[]};
 const task={contract:'DATE_TO_VIDEO_V1_ORIGINAL_ANALYSIS_TASK',status:'READY_FOR_EVIDENCE_GROUNDED_DRAFT',target_date:'20261013',market_master_sha256:sha(master),claim_inventory_sha256:sha(inventory),required_sections:['market_breadth_vs_index','institutional_flow_vs_breadth','selected_stock_evidence','counterarguments_and_uncertainty','three_point_summary']};
 const response={contract:'DATE_TO_VIDEO_V1_D4_AUTHORED_RESEARCH_CANDIDATE',target_date:'20261013',insights:task.required_sections.map((section,i)=>({id:'insight-'+i,section,observation:'觀察',interpretation:'解讀',uncertainty:'待驗證',evidence:[section==='selected_stock_evidence'?{type:'claim_id',id:'20261013:6668:PRICE_CHANGE'}:{type:'master_field',path:'taiex.close'}]}))};
 return {task,master,inventory,review,response};
}
test('pending reviewed claim remains candidate, never authorizes media',()=>{const f=fixture(),r=adapt(...Object.values(f));assert.equal(r.status,'PENDING_INDEPENDENT_CLAIM_REVIEW');assert.equal(r.preflight.missing_claim_reviews.length,1);assert.equal(r.render_authorized,false);assert.equal(r.narration_authorized,false);assert.equal(r.editorial_certified,false)});
test('wrong date fails closed',()=>{const f=fixture();f.response.target_date='20261014';assert.throws(()=>adapt(...Object.values(f)),/AI_RESPONSE_DATE/)});
test('unknown claim fails closed',()=>{const f=fixture();f.response.insights[2].evidence[0].id='UNKNOWN';assert.throws(()=>adapt(...Object.values(f)),/UNKNOWN_CLAIM/)});
test('invalid master field fails closed',()=>{const f=fixture();f.response.insights[0].evidence[0].path='taiex.missing';assert.throws(()=>adapt(...Object.values(f)),/INVALID_MASTER_FIELD/)});
test('missing AI response fails closed',()=>{const f=fixture();f.response=null;assert.throws(()=>adapt(...Object.values(f)),/AI_RESPONSE_DATE/)});
