'use strict';
// Preview is an editorial planning artifact, never an approved script, SRT, scene render or TTS input.
function build(entry,candidate,worksheet){
 const issues=[];
 const check=(code,ok)=>{if(!ok)issues.push(code);};
 check('ENTRY_CONTRACT',entry?.contract==='DATE_TO_VIDEO_V1_VERIFIED_RESEARCH_ENTRY');
 check('CANDIDATE_REVIEW',entry?.narration_candidate_review?.status==='STRUCTURAL_CANDIDATE_INDEPENDENT_EDITORIAL_REVIEW_REQUIRED');
 check('CANDIDATE_SOURCE',!!entry?.narration_candidate_source);
 check('DATE_MATCH',!!candidate?.target_date&&candidate.target_date===entry?.target_date&&candidate.target_date===worksheet?.target_date);
 check('MASTER_MATCH',!!candidate?.source_master_sha256&&candidate.source_master_sha256===entry?.dated_media_input?.source_master_sha256&&candidate.source_master_sha256===worksheet?.source_master_sha256);
 check('WORKSHEET_SECTIONS',Array.isArray(worksheet?.sections)&&worksheet.sections.length>0);
 check('SENTENCES',Array.isArray(candidate?.sentences)&&candidate.sentences.length>=5);
 const sections=worksheet?.sections||[];
 const sentences=Array.isArray(candidate?.sentences)?candidate.sentences:[];
 const cards=sections.map(section=>({insight_id:section.insight_id,section:section.section,observation:section.observation,interpretation:section.interpretation,uncertainty:section.uncertainty,evidence:section.evidence,sentence_ids:sentences.filter(s=>s.insight_id===section.insight_id).map(s=>s.id),rendered_card:null}));
 for(const card of cards)check('SCENE_WITHOUT_SENTENCE:'+card.insight_id,card.sentence_ids.length>0);
 const ready=issues.length===0;
 return {contract:'DATE_TO_VIDEO_V1_RESEARCH_EDITORIAL_MEDIA_PREVIEW',target_date:entry?.target_date||null,source_master_sha256:entry?.dated_media_input?.source_master_sha256||null,status:ready?'STRUCTURAL_PLANNING_PREVIEW_ONLY':'REJECTED',issues,narration_plan:ready?sentences.map(s=>({id:s.id,text:s.narration,insight_id:s.insight_id||null})):null,subtitle_plan:ready?sentences.map(s=>({id:s.id,text:s.subtitle,spoken_subtitle_mappings:s.spoken_subtitle_mappings||[]})):null,scene_plan:ready?cards:null,editorial_certified:false,narration_authorized:false,tts_authorized:false,render_authorized:false,publication_authorized:false};
}
module.exports={build};
