'use strict';
// Preview is an editorial planning artifact, never an approved script, SRT, scene render or TTS input.
const crypto=require('node:crypto');
const sha=x=>crypto.createHash('sha256').update(JSON.stringify(x)).digest('hex');
function build(entry,candidate,worksheet){
 const issues=[];
 const check=(code,ok)=>{if(!ok)issues.push(code);};
 check('ENTRY_CONTRACT',entry?.contract==='DATE_TO_VIDEO_V1_VERIFIED_RESEARCH_ENTRY');
 check('CANDIDATE_REVIEW',entry?.narration_candidate_review?.status==='STRUCTURAL_CANDIDATE_INDEPENDENT_EDITORIAL_REVIEW_REQUIRED');
 check('CANDIDATE_SOURCE',typeof entry?.narration_candidate_source?.sha256==='string'&&/^[a-f0-9]{64}$/.test(entry.narration_candidate_source.sha256));
 check('CANDIDATE_REVIEW_HASH',!!candidate&&entry?.narration_candidate_review?.candidate_sha256===sha(candidate));
 check('WORKSHEET_REVIEW_HASH',!!worksheet&&entry?.narration_candidate_review?.worksheet_sha256===sha(worksheet));
 check('DATE_MATCH',!!candidate?.target_date&&candidate.target_date===entry?.target_date&&candidate.target_date===worksheet?.target_date);
 check('MASTER_MATCH',!!candidate?.source_master_sha256&&candidate.source_master_sha256===entry?.dated_media_input?.source_master_sha256&&candidate.source_master_sha256===worksheet?.source_master_sha256);
 check('WORKSHEET_SECTIONS',Array.isArray(worksheet?.sections)&&worksheet.sections.length>0);
 check('SENTENCES',Array.isArray(candidate?.sentences)&&candidate.sentences.length>=5);
 check('SENTENCE_IDS_UNIQUE',Array.isArray(candidate?.sentences)&&candidate.sentences.every(s=>typeof s?.id==='string'&&s.id.trim())&&new Set(candidate.sentences.map(s=>s.id)).size===candidate.sentences.length);
 check('INSIGHT_IDS_UNIQUE',Array.isArray(worksheet?.sections)&&worksheet.sections.every(s=>typeof s?.insight_id==='string'&&s.insight_id.trim())&&new Set(worksheet.sections.map(s=>s.insight_id)).size===worksheet.sections.length);
 check('REVIEW_ISSUES_EMPTY',Array.isArray(entry?.narration_candidate_review?.issues)&&entry.narration_candidate_review.issues.length===0);
 const sections=worksheet?.sections||[];
 const sentences=Array.isArray(candidate?.sentences)?candidate.sentences:[];
 const cards=sections.map(section=>({insight_id:section.insight_id,section:section.section,observation:section.observation,interpretation:section.interpretation,uncertainty:section.uncertainty,evidence:section.evidence,sentence_ids:sentences.filter(s=>s.insight_id===section.insight_id).map(s=>s.id),rendered_card:null}));
 for(const card of cards)check('SCENE_WITHOUT_SENTENCE:'+card.insight_id,card.sentence_ids.length>0);
 for(const sentence of sentences.slice(4))check('UNMAPPED_SCENE_SENTENCE:'+sentence.id,sections.some(section=>section.insight_id===sentence.insight_id));
 check('SENTENCE_PARITY_REVIEW',entry?.narration_candidate_review?.sentence_parity?.status==='STRUCTURAL_PARITY_ONLY_EDITORIAL_REVIEW_REQUIRED');
 const ready=issues.length===0;
 return {contract:'DATE_TO_VIDEO_V1_RESEARCH_EDITORIAL_MEDIA_PREVIEW',target_date:entry?.target_date||null,source_master_sha256:entry?.dated_media_input?.source_master_sha256||null,candidate_sha256:candidate?sha(candidate):null,worksheet_sha256:worksheet?sha(worksheet):null,status:ready?'STRUCTURAL_PLANNING_PREVIEW_ONLY':'REJECTED',issues,narration_plan:ready?sentences.map(s=>({id:s.id,text:s.narration,insight_id:s.insight_id||null})):null,subtitle_plan:ready?sentences.map(s=>({id:s.id,text:s.subtitle,spoken_subtitle_mappings:s.spoken_subtitle_mappings||[]})):null,scene_plan:ready?cards:null,editorial_certified:false,narration_authorized:false,tts_authorized:false,render_authorized:false,publication_authorized:false};
}
module.exports={build};
