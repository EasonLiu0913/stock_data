'use strict';
// Advisory only. Never dispatches workflows or grants synthesis/publication.
function advise(d4,verification,media,sentenceHandoff=null,narrationCandidateReview=null){
 const sources=d4.official_recovery_advice?.sources||[];
 const required=['BFI82U','BFIAMU','FMTQIK','MI_INDEX'];
 const validInventory=Array.isArray(d4.official_recovery_advice?.sources)&&sources.length===required.length&&required.every(id=>sources.filter(s=>s?.id===id).length===1);
 const ready=s=>(s.id==='BFI82U'&&s.status==='VERIFIED_RESEARCH_ONLY'&&s.action_required==='REUSE_VERIFIED_ARCHIVE')||(['FMTQIK','MI_INDEX'].includes(s.id)&&s.status==='WORKFLOW_OUTPUT_VALIDATED_FOR_RESEARCH_USE'&&s.action_required==='REUSE_DATED_WORKFLOW_OUTPUT')||(s.id==='BFIAMU'&&s.action_required==='OPTIONAL_CONTEXT_NOT_REQUIRED');
 const pending=validInventory?sources.filter(s=>s.id!=='BFIAMU'&&!ready(s)):[];
 let stage,actions;
 if(verification.status!=='VERIFIED_RESEARCH_ONLY'){stage='REJECTED_PROVENANCE';actions=['REVIEW_VERIFICATION_ISSUES'];}
 else if(sentenceHandoff&&(sentenceHandoff.status==='REJECTED'||sentenceHandoff.sentence_parity?.status==='REJECTED')){stage='REJECTED_SENTENCE_PACKET';actions=sentenceHandoff.issues||sentenceHandoff.sentence_parity?.issues||['REVIEW_SENTENCE_PACKET'];}
 else if(narrationCandidateReview?.status==='REJECTED'){stage='REJECTED_NARRATION_CANDIDATE';actions=narrationCandidateReview.issues||['REVIEW_NARRATION_CANDIDATE'];}
 else if(!validInventory){stage='WAITING_OFFICIAL_SOURCE_INVENTORY';actions=['REBUILD_DATE_SCOPED_SOURCE_INVENTORY'];}
 else if(pending.length){stage='WAITING_OFFICIAL_SOURCES';actions=pending.map(s=>({source:s.id,action_required:s.action_required,automated_retrieval_allowed:s.automated_retrieval_allowed===true}));}
 else if(media.issues.includes('EDITORIAL_CERTIFICATION_REQUIRED')){stage='WAITING_INDEPENDENT_EDITORIAL_REVIEW';actions=['REVIEW_DATED_MASTER_AND_CLAIMS'];}
 else if(media.issues.includes('DATED_MEDIA_BRIDGE_NOT_IMPLEMENTED')){stage='WAITING_DATED_MEDIA_BRIDGE';actions=['IMPLEMENT_AND_REVIEW_DATED_MEDIA_BRIDGE'];}
 else if(media.status!=='READY_FOR_SEPARATE_MEDIA_REVIEW'){stage='WAITING_MEDIA_PREFLIGHT';actions=media.issues;}
 else {stage='READY_FOR_SEPARATE_MEDIA_REVIEW';actions=['INDEPENDENT_MEDIA_REVIEW_REQUIRED'];}
 return {contract:'DATE_TO_VIDEO_V1_RESEARCH_NEXT_ACTION',target_date:d4.target_date,research_only:true,stage,actions,automatic_dispatch_authorized:false,tts_authorized:false,render_authorized:false,publication_authorized:false};
}
module.exports={advise};
