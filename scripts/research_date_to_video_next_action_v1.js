'use strict';
// Advisory only. Never dispatches workflows or grants synthesis/publication.
function advise(d4,verification,media){
 const sources=d4.official_recovery_advice?.sources||[];
 const pending=sources.filter(s=>s.action_required!=='REUSE_VERIFIED_ARCHIVE'&&s.status!=='VERIFIED_RESEARCH_ONLY');
 let stage,actions;
 if(verification.status!=='VERIFIED_RESEARCH_ONLY'){stage='REJECTED_PROVENANCE';actions=['REVIEW_VERIFICATION_ISSUES'];}
 else if(pending.length){stage='WAITING_OFFICIAL_SOURCES';actions=pending.map(s=>({source:s.id,action_required:s.action_required,automated_retrieval_allowed:s.automated_retrieval_allowed===true}));}
 else if(media.issues.includes('EDITORIAL_CERTIFICATION_REQUIRED')){stage='WAITING_INDEPENDENT_EDITORIAL_REVIEW';actions=['REVIEW_DATED_MASTER_AND_CLAIMS'];}
 else if(media.issues.includes('DATED_MEDIA_BRIDGE_NOT_IMPLEMENTED')){stage='WAITING_DATED_MEDIA_BRIDGE';actions=['IMPLEMENT_AND_REVIEW_DATED_MEDIA_BRIDGE'];}
 else if(media.status!=='READY_FOR_SEPARATE_MEDIA_REVIEW'){stage='WAITING_MEDIA_PREFLIGHT';actions=media.issues;}
 else {stage='READY_FOR_SEPARATE_MEDIA_REVIEW';actions=['INDEPENDENT_MEDIA_REVIEW_REQUIRED'];}
 return {contract:'DATE_TO_VIDEO_V1_RESEARCH_NEXT_ACTION',target_date:d4.target_date,research_only:true,stage,actions,automatic_dispatch_authorized:false,tts_authorized:false,render_authorized:false,publication_authorized:false};
}
module.exports={advise};
