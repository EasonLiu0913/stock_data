'use strict';
// Research-only date-parameterized bridge from independently verified MP3 evidence to SRT timing.
// Does not synthesize, render, certify editorial content, or publish.
const {inspect}=require('./research_date_to_video_planned_audio_review_v1');
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
function clock(seconds){
 const ms=Math.round(seconds*1000),h=Math.floor(ms/3600000),m=Math.floor(ms%3600000/60000),s=Math.floor(ms%60000/1000);
 return [h,m,s].map(x=>String(x).padStart(2,'0')).join(':')+','+String(ms%1000).padStart(3,'0');
}
function wrap(text,limit=30){
 if(typeof text!=='string'||!text.trim()||/[\r\n]/.test(text))throw Error('INVALID_CAPTION');
 const chunks=text.match(/[^。！？；，、]+[。！？；，、]?/g)||[],lines=[];let line='';
 if(chunks.join('')!==text)throw Error('CAPTION_DRIFT');
 for(let chunk of chunks){if(line.length+chunk.length>limit&&line){lines.push(line);line='';}while(chunk.length>limit){lines.push(chunk.slice(0,limit));chunk=chunk.slice(limit);}line+=chunk;}
 if(line)lines.push(line);
 if(lines.join('')!==text||lines.some(x=>x.length>limit))throw Error('CAPTION_DRIFT');
 return lines.join('\n');
}
function build(inventory,commandPlan,proof,audioDir,probe){
 const review=inspect(inventory,commandPlan,proof,audioDir,probe);
 if(review.status!=='STRUCTURAL_AND_PLAYABLE_AUDIO_EVIDENCE_EDITORIAL_REVIEW_REQUIRED')return {contract:'DATE_TO_VIDEO_V1_RESEARCH_DATED_MEDIA_BRIDGE',status:'REJECTED',issues:review.issues,render_authorized:false,publication_authorized:false};
 const issues=[];
 if(!Array.isArray(proof.sentences)||proof.sentences.some(s=>typeof s.caption_text!=='string'||!s.caption_text.trim()||/[\r\n]/.test(s.caption_text)))issues.push('CAPTION_INVALID');
 if(issues.length)return {contract:'DATE_TO_VIDEO_V1_RESEARCH_DATED_MEDIA_BRIDGE',status:'REJECTED',issues,render_authorized:false,publication_authorized:false};
 let cursor=0;const sentences=proof.sentences.map(s=>{const start=cursor;cursor+=s.duration_seconds;return {id:s.id,order:s.order,spoken_text:s.spoken_text,caption_text:s.caption_text,audio_file:s.audio_file,audio_sha256:s.audio_sha256,start_seconds:Number(start.toFixed(3)),end_seconds:Number(cursor.toFixed(3))};});
 const srt=sentences.map((s,i)=>String(i+1)+'\n'+clock(s.start_seconds)+' --> '+clock(s.end_seconds)+'\n'+wrap(s.caption_text)+'\n\n').join('');
 return {contract:'DATE_TO_VIDEO_V1_RESEARCH_DATED_MEDIA_BRIDGE',target_date:inventory.target_date,candidate_sha256:inventory.candidate_sha256,status:'PLAYABLE_AUDIO_AND_SRT_STRUCTURAL_ONLY_EDITORIAL_REVIEW_REQUIRED',issues:[],sentences,srt,total_seconds:Number(cursor.toFixed(3)),editorial_certified:false,narration_authorized:false,render_authorized:false,publication_authorized:false};
}
function verifyPersisted(dir){
 const issues=[],jsonPath=path.join(dir,'dated-media-bridge.json'),srtPath=path.join(dir,'dated-media-bridge.srt');
 let manifest,srt;
 try{if(fs.lstatSync(jsonPath).isSymbolicLink()||fs.lstatSync(srtPath).isSymbolicLink())throw Error('SYMLINK');manifest=JSON.parse(fs.readFileSync(jsonPath,'utf8'));srt=fs.readFileSync(srtPath,'utf8');}catch(e){return {status:'REJECTED',issues:['DATED_MEDIA_OUTPUT_UNREADABLE'],render_authorized:false,publication_authorized:false};}
 if(manifest.contract!=='DATE_TO_VIDEO_V1_RESEARCH_DATED_MEDIA_BRIDGE'||manifest.status!=='PLAYABLE_AUDIO_AND_SRT_STRUCTURAL_ONLY_EDITORIAL_REVIEW_REQUIRED')issues.push('MANIFEST_CONTRACT');
 if(manifest.srt_sha256!==sha(Buffer.from(srt,'utf8')))issues.push('SRT_SHA256_MISMATCH');
 if(!/^\d{8}$/.test(manifest.target_date)||!Array.isArray(manifest.sentences)||!manifest.sentences.length||!Number.isFinite(manifest.total_seconds)||manifest.total_seconds<=0)issues.push('MANIFEST_TIMELINE');
 if(['editorial_certified','narration_authorized','render_authorized','publication_authorized'].some(k=>manifest[k]!==false))issues.push('AUTHORITY_LOCK');
 if(!issues.length){
  try{let cursor=0;const expected=manifest.sentences.map((sentence,i)=>{if(sentence.order!==i+1||!Number.isFinite(sentence.start_seconds)||!Number.isFinite(sentence.end_seconds)||sentence.end_seconds<=sentence.start_seconds||Math.abs(sentence.start_seconds-cursor)>0.001)throw Error('TIMELINE_DRIFT');cursor=sentence.end_seconds;return String(i+1)+'\n'+clock(sentence.start_seconds)+' --> '+clock(sentence.end_seconds)+'\n'+wrap(sentence.caption_text)+'\n\n';}).join('');if(expected!==srt||Math.abs(cursor-manifest.total_seconds)>0.001)issues.push('SRT_TIMELINE_DRIFT');}catch(e){issues.push('SRT_TIMELINE_DRIFT');}
 }
 return {contract:'DATE_TO_VIDEO_V1_RESEARCH_DATED_MEDIA_BRIDGE_VERIFY',status:issues.length?'REJECTED':'VERIFIED_STRUCTURAL_ONLY_EDITORIAL_REVIEW_REQUIRED',issues,target_date:manifest.target_date,render_authorized:false,publication_authorized:false};
}
function persist(dir,result,write=fs.writeFileSync){
 if(result?.contract!=='DATE_TO_VIDEO_V1_RESEARCH_DATED_MEDIA_BRIDGE'||result.status!=='PLAYABLE_AUDIO_AND_SRT_STRUCTURAL_ONLY_EDITORIAL_REVIEW_REQUIRED'||result.editorial_certified!==false||result.narration_authorized!==false||result.render_authorized!==false||result.publication_authorized!==false||typeof result.srt!=='string'||!result.srt.trim()||!Array.isArray(result.sentences)||!result.sentences.length)throw Error('DATED_MEDIA_BRIDGE_NOT_READY');
 if(!/^\d{8}$/.test(result.target_date)||!Number.isFinite(result.total_seconds)||result.total_seconds<=0)throw Error('DATED_MEDIA_BRIDGE_TIMELINE_INVALID');
 let cursor=0,expectedSrt;
 try{expectedSrt=result.sentences.map((sentence,i)=>{if(sentence.order!==i+1||!Number.isFinite(sentence.start_seconds)||!Number.isFinite(sentence.end_seconds)||sentence.end_seconds<=sentence.start_seconds||Math.abs(sentence.start_seconds-cursor)>0.001)throw Error('TIMELINE_DRIFT');cursor=sentence.end_seconds;return String(i+1)+'\n'+clock(sentence.start_seconds)+' --> '+clock(sentence.end_seconds)+'\n'+wrap(sentence.caption_text)+'\n\n';}).join('');}catch(e){throw Error('DATED_MEDIA_BRIDGE_TIMELINE_INVALID');}
 if(expectedSrt!==result.srt||Math.abs(cursor-result.total_seconds)>0.001)throw Error('DATED_MEDIA_BRIDGE_SRT_DRIFT');
 const files=[['dated-media-bridge.json',JSON.stringify({...result,srt_sha256:sha(Buffer.from(result.srt,'utf8')),srt:undefined},null,2)+'\n'],['dated-media-bridge.srt',result.srt]];
 for(const [name] of files)if(fs.existsSync(path.join(dir,name)))throw Error('DATED_MEDIA_BRIDGE_OUTPUT_EXISTS:'+name);
 const created=[];try{for(const [name,content] of files){const file=path.join(dir,name);write(file,content,{flag:'wx'});created.push(file);}}catch(e){for(const file of created)if(fs.existsSync(file))fs.unlinkSync(file);throw e;}
 return files.map(([name])=>name);
}

// Research-only on-disk connection. Requires externally collected MP3 proof; never runs TTS.
function buildFromDirectory(dir,probe){
 const names=['sentence-audio-inventory.json','edge-tts-command-plan.json','sentence-audio-proof.json'];
 let inventory,commandPlan,proof;
 try{
  const objects=names.map(name=>{const file=path.join(dir,name),stat=fs.lstatSync(file);if(!stat.isFile()||stat.isSymbolicLink())throw Error('INVALID_EVIDENCE_FILE');return JSON.parse(fs.readFileSync(file,'utf8'));});
  [inventory,commandPlan,proof]=objects;
 }catch(e){return {contract:'DATE_TO_VIDEO_V1_RESEARCH_DATED_MEDIA_BRIDGE',status:'REJECTED',issues:['DATED_AUDIO_EVIDENCE_MISSING_OR_INVALID'],editorial_certified:false,narration_authorized:false,render_authorized:false,publication_authorized:false};}
 const result=build(inventory,commandPlan,proof,path.join(dir,'audio'),probe);
 if(result.status!=='PLAYABLE_AUDIO_AND_SRT_STRUCTURAL_ONLY_EDITORIAL_REVIEW_REQUIRED')return result;
 return result;
}

function verifyD4Source(dir){
 const issues=[],read=name=>{try{const file=path.join(dir,name),stat=fs.lstatSync(file);if(!stat.isFile()||stat.isSymbolicLink())throw Error('NOT_REGULAR');return JSON.parse(fs.readFileSync(file,'utf8'));}catch(e){issues.push('D4_FILE_MISSING_OR_INVALID:'+name);return null;}};
 const claims=read('claims.json'),review=read('editorial-review.json'),worksheet=read('independent-review-worksheet.json'),dated=read('dated-media-input.json');
 const date='20261013';
 if([claims,review,worksheet,dated].some(x=>x?.target_date!==date))issues.push('D4_DATE_MISMATCH');
 const entries=Array.isArray(claims?.claims)?claims.claims:[];
 if(claims?.claim_count!==75||entries.length!==75||entries.some(x=>x.target_date!==date||x.review_status!=='REVIEW_REQUIRED'||x.narration_authorized!==false)||claims?.claim_whitelist_verified!==false||!Array.isArray(claims?.whitelisted_claim_ids)||claims.whitelisted_claim_ids.length!==0)issues.push('D4_CLAIM_REVIEW_STATE');
 const inventoryHash=claims?sha(Buffer.from(JSON.stringify(claims),'utf8')):null;
 if(review?.inventory_sha256!==inventoryHash||worksheet?.inventory_sha256!==inventoryHash)issues.push('D4_INVENTORY_SHA_MISMATCH');
 if(review?.reviewed_count!==0||review?.unreviewed_count!==75||!Array.isArray(review?.approved_claim_ids)||review.approved_claim_ids.length!==0||review?.claim_whitelist_verified!==false)issues.push('D4_REVIEW_GATE');
 if(!Array.isArray(worksheet?.review_items)||!worksheet.review_items.length||worksheet.review_items.some(x=>x.review_decision!=='PENDING_INDEPENDENT_REVIEW'||x.evidence_checked!==false))issues.push('D4_WORKSHEET_PENDING');
 if(dated?.preflight_status!=='BLOCKED'||dated?.audio_manifest!==null||!dated?.blockers?.includes('EDITORIAL_CERTIFICATION_REQUIRED'))issues.push('D4_MEDIA_PREFLIGHT');
 if([claims,review,worksheet,dated].some(x=>x?.editorial_certified!==false||x?.render_authorized!==false||x?.publication_authorized!==false&&x?.publication_authorized!==undefined)||worksheet?.narration_authorized!==false)issues.push('D4_AUTHORITY_LOCK');
 return {contract:'DATE_TO_VIDEO_V1_RESEARCH_D4_20261013_SOURCE_NEGATIVE_VERIFY',target_date:date,status:issues.length?'REJECTED':'VERIFIED_BLOCKED_PENDING_INDEPENDENT_REVIEW',issues,inventory_sha256:inventoryHash,render_authorized:false,publication_authorized:false};
}
module.exports={build,buildFromDirectory,verifyD4Source,wrap,clock,persist,verifyPersisted};
