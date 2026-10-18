'use strict';
// Research-only compatibility report. The legacy M8VIS six-scene renderer is NOT a D4 renderer.
const assert=require('node:assert/strict');
function inspect(projection){
 assert.equal(projection.contract,'DATE_TO_VIDEO_V1_D4_SINGLE_MASTER_SEMANTIC_PROJECTION','M8VIS_D4_PROJECTION_REQUIRED');
 assert.equal(projection.render_authorized,false,'M8VIS_RESEARCH_LOCK_REQUIRED');
 assert.equal(projection.publication_authorized,false,'M8VIS_PUBLICATION_LOCK_REQUIRED');
 assert.deepEqual(projection.scene_plan.map(x=>x.source_section_id),projection.sections.map(x=>x.id),'M8VIS_SECTION_ORDER_DRIFT');
 assert.deepEqual(projection.factual_card_inputs.map(x=>x.section_id),projection.sections.map(x=>x.id),'M8VIS_CARD_ORDER_DRIFT');
 for(const slot of projection.scene_plan){
  assert.equal(slot.source_master_sha256,projection.market_master_sha256,'M8VIS_MASTER_DRIFT');
  assert.equal(slot.visual_asset,null,'M8VIS_UNEXPECTED_RENDERED_ASSET');
  assert.equal(slot.display_authorized,false,'M8VIS_UNAPPROVED_DISPLAY');
 }
 return {contract:'DATE_TO_VIDEO_V1_D4_M8VIS_COMPATIBILITY_RESEARCH',target_date:projection.target_date,source_outline_sha256:projection.source_outline_sha256,market_master_sha256:projection.market_master_sha256,legacy_renderer:'research_ai_v3_m8vis_visual_render_20261008.py',legacy_required_scene_count:6,d4_section_count:projection.scene_plan.length,source_section_ids:projection.scene_plan.map(x=>x.source_section_id),status:'ADAPTER_REQUIRED_LEGACY_FIXED_SCENE_CONTRACT',required_adapter_work:['Map D4 semantic sections to legacy visual scenes without fabricating content','Bind dated numeric manifest to D4 market master','Preserve subtitle and presenter zones','Require independently reviewed narration and timing before rendering'],legacy_renderer_compatible:false,editorial_certified:false,render_authorized:false,publication_authorized:false};
}
module.exports={inspect};
