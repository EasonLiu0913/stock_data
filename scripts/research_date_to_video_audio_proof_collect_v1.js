'use strict';
// Read-only MP3 evidence collection. Does not run TTS, approve narration, or authorize rendering.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),cp=require('node:child_process');
const {plan}=require('./research_date_to_video_edge_tts_plan_v1');
const {build}=require('./research_date_to_video_dated_media_input_v1');
const {prepare}=require('./research_date_to_video_editorial_narration_worksheet_v1');
const {inspect}=require('./research_date_to_video_planned_audio_review_v1');
const {inspectDirectory:inspectCandidate}=require('./research_date_to_video_narration_candidate_review_v1');
const sha=x=>crypto.createHash('sha256').update(x).digest('hex');
function checkAudioSet(audioDir,commands){
 const stat=fs.lstatSync(audioDir);if(!stat.isDirectory()||stat.isSymbolicLink())throw Error('AUDIO_DIRECTORY_INVALID');
 const expectedNames=new Set(commands.map(c=>c.output_file)),actualNames=fs.readdirSync(audioDir);
 if(actualNames.length!==expectedNames.size||actualNames.some(name=>!expectedNames.has(name)))throw Error('AUDIO_FILE_SET_MISMATCH');
}
function checkSentence(source,command){if(!source||source.id!==command.sentence_id||source.order!==command.order||source.spoken_text!==command.argv[6])throw Error('AUDIO_SENTENCE_PLAN_MISMATCH_'+command.output_file);}
function collect(dir,probe=cp.spawnSync){
 const read=name=>JSON.parse(fs.readFileSync(path.join(dir,name),'utf8'));
 const inventory=read('sentence-audio-inventory.json'),commands=read('edge-tts-command-plan.json'),expected=plan(inventory);
 if(expected.status!=='PLAN_ONLY_INDEPENDENT_EDITORIAL_APPROVAL_REQUIRED'||JSON.stringify(commands)!==JSON.stringify(expected))throw Error('DATED_AUDIO_COMMAND_PLAN_REJECTED');
 const dated=build(dir),worksheet=read('editorial-narration-worksheet.json'),candidate=read('narration-candidate.json');
 const candidateReview=inspectCandidate(dir,candidate);
 if(candidateReview.status!=='STRUCTURAL_CANDIDATE_INDEPENDENT_EDITORIAL_REVIEW_REQUIRED'||inventory.candidate_sha256!==sha(JSON.stringify(candidate)))throw Error('DATED_AUDIO_CANDIDATE_PROVENANCE_REJECTED');
 if(inventory.target_date!==dated.target_date||inventory.source_master_sha256!==dated.source_master_sha256||inventory.worksheet_sha256!==sha(JSON.stringify(worksheet))||sha(JSON.stringify(worksheet))!==sha(JSON.stringify(prepare(dir))))throw Error('DATED_AUDIO_D4_PROVENANCE_REJECTED');
 const audioDir=path.join(dir,'audio'),sentences=[];
 checkAudioSet(audioDir,expected.commands);
 for(const c of expected.commands){
  const name=c.output_file;
  if(!/^\d{3}\.mp3$/.test(name))throw Error('UNSAFE_AUDIO_FILENAME');
  const file=path.join(audioDir,name),stat=fs.lstatSync(file);
  if(!stat.isFile()||stat.isSymbolicLink())throw Error('AUDIO_NOT_REGULAR_FILE');
  const result=probe('ffprobe',['-v','error','-show_entries','stream=codec_name:format=duration','-of','json',file],{encoding:'utf8',timeout:20000,maxBuffer:1024*1024});
  if(result.error||result.status!==0)throw Error('AUDIO_FFPROBE_FAILED_'+name);
  const info=JSON.parse(result.stdout),duration=Number(info?.format?.duration);
  if(!info?.streams?.some(s=>s.codec_name==='mp3')||!Number.isFinite(duration)||duration<=0.1||duration>=120)throw Error('AUDIO_CODEC_OR_DURATION_INVALID_'+name);
  const source=inventory.sentences[c.order-1];
  checkSentence(source,c);
  sentences.push({id:source.id,order:source.order,spoken_text:source.spoken_text,caption_text:source.caption_text,audio_file:name,duration_seconds:duration,audio_sha256:sha(fs.readFileSync(file))});
 }
 const proof={contract:'DATE_TO_VIDEO_V1_RESEARCH_SENTENCE_AUDIO_PROOF',target_date:inventory.target_date,candidate_sha256:inventory.candidate_sha256,voice:inventory.voice,rate:inventory.rate,sentences,editorial_certified:false,narration_authorized:false,render_authorized:false,publication_authorized:false};
 const review=inspect(inventory,commands,proof,audioDir,probe);
 if(review.status!=='STRUCTURAL_AND_PLAYABLE_AUDIO_EVIDENCE_EDITORIAL_REVIEW_REQUIRED')throw Error('AUDIO_PROOF_REJECTED:'+review.issues.join(','));
 return {proof,review};
}
if(require.main===module){const dir=process.argv[2];if(!dir){console.error('Usage: node scripts/research_date_to_video_audio_proof_collect_v1.js D4-output-dir');process.exitCode=2;}else try{const result=collect(dir);const file=path.join(dir,'sentence-audio-proof.json');fs.writeFileSync(file,JSON.stringify(result.proof,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify(result.review,null,2));}catch(e){console.error('AUDIO_PROOF_COLLECTION_ERROR: '+e.message);process.exitCode=1;}}
module.exports={collect,checkAudioSet,checkSentence};
