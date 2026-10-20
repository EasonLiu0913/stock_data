'use strict';
// Real 20261008 date-entry integration. Never fabricates official source completeness or editorial approval.
const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),crypto=require('node:crypto');
const {execute}=require('../scripts/research_date_to_video_verified_entry_v1');
const {verify}=require('../scripts/research_date_to_video_verified_entry_verify_v1');
const {FIXED_OPENING_LINES}=require('../scripts/research_date_to_video_fixed_opening_v1');
const sha=x=>crypto.createHash('sha256').update(JSON.stringify(x)).digest('hex');
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'d4-editorial-integration-'));
const read=n=>JSON.parse(fs.readFileSync(path.join(dir,n),'utf8'));
try{
 execute('.','20261008',dir);
 const inventory=read('claims.json'),claim=inventory.claims.find(c=>c.kind==='PRICE_CHANGE');
 assert.ok(claim,'DATED_PRICE_CLAIM_REQUIRED');
 fs.writeFileSync(path.join(dir,'editorial-review-input.json'),JSON.stringify({target_date:'20261008',inventory_sha256:sha(inventory),decisions:[{claim_id:claim.claim_id,decision:'APPROVE',reviewer:'research-fixture-reviewer',rationale:'Explicit test decision, not editorial certification',evidence_checked:true,causal_language_prohibited:true}]}));
 const insight=(id,section,evidence)=>({id,section,observation:'日期限定觀察',interpretation:'研究解讀待獨立審核',uncertainty:'相關性不代表因果',evidence});
 fs.writeFileSync(path.join(dir,'original-analysis-draft-input.json'),JSON.stringify({target_date:'20261008',insights:[
 insight('breadth','market_breadth_vs_index',[{type:'master_field',path:'breadth.advancers'}]),
 insight('flow','institutional_flow_vs_breadth',[{type:'master_field',path:'institutional.foreign.net_twd'}]),
 insight('stock','selected_stock_evidence',[{type:'claim_id',id:claim.claim_id}]),
 insight('counter','counterarguments_and_uncertainty',[{type:'master_field',path:'breadth.decliners'}]),
 insight('summary','three_point_summary',[{type:'master_field',path:'market_trading.turnover_twd'}])
 ]}));
 const drafted=execute('.','20261008',dir),worksheet=read('editorial-narration-worksheet.json');
 assert.equal(read('original-analysis-draft-check.json').status,'STRUCTURAL_EVIDENCE_VALIDATED_INDEPENDENT_EDITORIAL_REVIEW_REQUIRED');
 assert.deepEqual(worksheet.sections.map(x=>x.insight_id),['breadth','flow','stock','counter','summary']);
 assert.equal(verify(dir).status,'VERIFIED_RESEARCH_ONLY');
 const candidate={target_date:'20261008',source_master_sha256:worksheet.source_master_sha256,worksheet_sha256:sha(worksheet),draft_sha256:worksheet.draft_sha256,sentences:[
 ...FIXED_OPENING_LINES.map((line,i)=>({id:'opening-'+i,narration:line,subtitle:line})),
 ...worksheet.sections.map((section,i)=>({id:'insight-'+i,insight_id:section.insight_id,narration:section.observation+'。',subtitle:section.observation+'。'}))
 ]};
 fs.writeFileSync(path.join(dir,'narration-candidate-input.json'),JSON.stringify(candidate));
 const entry=execute('.','20261008',dir);
 assert.equal(entry.narration_candidate_review.target_date,'20261008');
 assert.equal(entry.narration_candidate_review.candidate_sha256,sha(candidate));
 assert.equal(entry.narration_candidate_review.editorial_certified,false);
 if(entry.narration_candidate_review.status==='STRUCTURAL_CANDIDATE_INDEPENDENT_EDITORIAL_REVIEW_REQUIRED'){
  assert.equal(entry.editorial_media_preview.status,'STRUCTURAL_PLANNING_PREVIEW_ONLY',JSON.stringify(entry.editorial_media_preview.issues));
  assert.deepEqual(entry.editorial_media_preview.scene_plan.map(x=>x.insight_id),worksheet.sections.map(x=>x.insight_id));
  assert.equal(entry.editorial_media_preview.tts_authorized,false);
 }else{
  assert.equal(entry.editorial_media_preview,null);
  assert.ok(entry.narration_candidate_review.issues.length>0,'REJECTED_CANDIDATE_MUST_EXPLAIN_BLOCKERS');
 }
 assert.equal(verify(dir).status,'VERIFIED_RESEARCH_ONLY',JSON.stringify(verify(dir).issues));
 assert.equal(entry.tts_authorized,false);assert.equal(entry.render_authorized,false);assert.equal(entry.publication_authorized,false);
 console.log('D4_REAL_DATE_EDITORIAL_ENTRY_INTEGRATION_PASS '+entry.narration_candidate_review.status);
}finally{fs.rmSync(dir,{recursive:true,force:true})}
