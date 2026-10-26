'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),crypto=require('node:crypto');
const {plan}=require('../scripts/research_date_to_video_edge_tts_plan_v1');
const {FIXED_OPENING_LINES}=require('../scripts/research_date_to_video_fixed_opening_v1');
const {wrap,clock,build,buildFromDirectory,verifyD4Source,persist,verifyPersisted}=require('../scripts/research_date_to_video_dated_media_bridge_v1');
test('dated media bridge caption formatting preserves characters and 30-char limit',()=>{
 assert.equal(wrap('今天上漲，明天觀察。'),'今天上漲，明天觀察。');
 assert.equal(wrap('甲'.repeat(31)),'甲'.repeat(30)+'\n甲');
 assert.equal(wrap('甲'.repeat(30)+'，乙'),'甲'.repeat(30)+'\n，乙');
 assert.throws(()=>wrap('甲\n乙'),/INVALID_CAPTION/);
 assert.equal(clock(3661.234),'01:01:01,234');
});
test('dated media bridge rejects missing inventory, proof, and audio without granting authority',()=>{
 const result=build(null,null,null,'/nonexistent');
 assert.equal(result.status,'REJECTED');
 assert.equal(result.render_authorized,false);
 assert.equal(result.publication_authorized,false);
 assert.ok(result.issues.length>0);
});

test('synthetic date-scoped audio proof produces aligned SRT without granting approval',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'dated-bridge-fixture-'));
 try{
  const candidate_sha256='b'.repeat(64),lines=[...FIXED_OPENING_LINES,'十月十三日上漲五％。'],captions=[...FIXED_OPENING_LINES,'10/13上漲5%。'];
  const inventory={contract:'DATE_TO_VIDEO_V1_RESEARCH_SENTENCE_AUDIO_INPUT_INVENTORY',target_date:'20261013',candidate_sha256,voice:'zh-TW-YunJheNeural',rate:'+15%',status:'CANDIDATE_INVENTORY_PENDING_INDEPENDENT_EDITORIAL_REVIEW',audio_generated:false,editorial_certified:false,narration_authorized:false,render_authorized:false,publication_authorized:false,sentences:lines.map((spoken_text,i)=>({id:'sentence-'+i,order:i+1,spoken_text,caption_text:captions[i]}))};
  const commandPlan=plan(inventory);assert.equal(commandPlan.commands.length,5);
  const sentences=inventory.sentences.map((s,i)=>{const audio_file=commandPlan.commands[i].output_file,bytes=Buffer.from('synthetic-test-mp3-'+i);fs.writeFileSync(path.join(dir,audio_file),bytes);return {...s,audio_file,duration_seconds:1.25,audio_sha256:crypto.createHash('sha256').update(bytes).digest('hex')};});
  const proof={contract:'DATE_TO_VIDEO_V1_RESEARCH_SENTENCE_AUDIO_PROOF',target_date:'20261013',candidate_sha256,voice:inventory.voice,rate:inventory.rate,sentences};
  const probe=()=>({status:0,stdout:JSON.stringify({streams:[{codec_name:'mp3'}],format:{duration:'1.25'}})});
  const result=build(inventory,commandPlan,proof,dir,probe);
  assert.equal(result.status,'PLAYABLE_AUDIO_AND_SRT_STRUCTURAL_ONLY_EDITORIAL_REVIEW_REQUIRED');
  assert.equal(result.sentences.length,5);assert.equal(result.total_seconds,6.25);
  assert.ok(result.srt.includes('00:00:05,000 --> 00:00:06,250\n10/13上漲5%。'));
  assert.equal(result.render_authorized,false);assert.equal(result.editorial_certified,false);
  const altered={...proof,sentences:proof.sentences.map((item,i)=>i===4?{...item,caption_text:'10/13上漲6%。'}:item)};
  assert.equal(build(inventory,commandPlan,altered,dir,probe).status,'REJECTED');
  const wrongDate={...proof,target_date:'20261008'};
  assert.equal(build(inventory,commandPlan,wrongDate,dir,probe).status,'REJECTED');
  // A second date must work structurally without inheriting the 20261013 provenance.
  const otherDate='20261014';
  const otherInventory={...inventory,target_date:otherDate,sentences:inventory.sentences.map((s,i)=>i===4?{...s,spoken_text:'十月十四日上漲五％。',caption_text:'10/14上漲5%。'}:s)};
  const otherPlan=plan(otherInventory);
  assert.equal(otherPlan.commands.length,5);
  const otherProof={...proof,target_date:otherDate,sentences:proof.sentences.map((s,i)=>({...s,...otherInventory.sentences[i],audio_file:otherPlan.commands[i].output_file}))};
  const otherResult=build(otherInventory,otherPlan,otherProof,dir,probe);
  assert.equal(otherResult.status,'PLAYABLE_AUDIO_AND_SRT_STRUCTURAL_ONLY_EDITORIAL_REVIEW_REQUIRED');
  assert.equal(otherResult.target_date,otherDate);
  assert.ok(otherResult.srt.includes('10/14上漲5%。'));
  assert.equal(otherResult.render_authorized,false);
  assert.equal(otherResult.publication_authorized,false);
  assert.equal(build(otherInventory,otherPlan,proof,dir,probe).status,'REJECTED');
  assert.equal(build(inventory,commandPlan,otherProof,dir,probe).status,'REJECTED');
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});

test('persist rejects blocked output, existing files and rolls back partial write',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'dated-bridge-persist-'));
 const result={contract:'DATE_TO_VIDEO_V1_RESEARCH_DATED_MEDIA_BRIDGE',status:'PLAYABLE_AUDIO_AND_SRT_STRUCTURAL_ONLY_EDITORIAL_REVIEW_REQUIRED',target_date:'20261013',srt:'1\n00:00:00,000 --> 00:00:01,000\n測試。\n\n',total_seconds:1,sentences:[{id:'test',order:1,start_seconds:0,end_seconds:1,caption_text:'測試。'}],editorial_certified:false,narration_authorized:false,render_authorized:false,publication_authorized:false};
 try{
  assert.throws(()=>persist(dir,{...result,render_authorized:true}),/NOT_READY/);
  assert.throws(()=>persist(dir,{...result,srt:result.srt.replace('測試。','偽造。')}),/SRT_DRIFT/);
  assert.throws(()=>persist(dir,{...result,total_seconds:2}),/SRT_DRIFT/);
  assert.throws(()=>persist(dir,{...result,target_date:'2026-10-13'}),/TIMELINE_INVALID/);
  assert.deepEqual(fs.readdirSync(dir),[]);
  let writes=0;
  assert.throws(()=>persist(dir,result,(file,content,opts)=>{if(++writes===2)throw Error('INJECTED_WRITE_FAILURE');fs.writeFileSync(file,content,opts);}),/INJECTED_WRITE_FAILURE/);
  assert.deepEqual(fs.readdirSync(dir),[]);
  assert.throws(()=>persist(dir,{...result,sentences:[{...result.sentences[0],caption_text:'偽造。'}]}),/SRT_DRIFT/);
  assert.deepEqual(fs.readdirSync(dir),[]);
  assert.deepEqual(persist(dir,result),['dated-media-bridge.json','dated-media-bridge.srt']);
  const manifest=JSON.parse(fs.readFileSync(path.join(dir,'dated-media-bridge.json'),'utf8'));
  assert.equal(manifest.srt_sha256,crypto.createHash('sha256').update(result.srt).digest('hex'));
  assert.equal(fs.readFileSync(path.join(dir,'dated-media-bridge.srt'),'utf8'),result.srt);
  assert.deepEqual(verifyPersisted(dir).issues,[]);
  assert.equal(verifyPersisted(dir).status,'VERIFIED_STRUCTURAL_ONLY_EDITORIAL_REVIEW_REQUIRED');
  assert.throws(()=>persist(dir,result),/OUTPUT_EXISTS/);
  fs.appendFileSync(path.join(dir,'dated-media-bridge.srt'),'tamper');
  assert.ok(verifyPersisted(dir).issues.includes('SRT_SHA256_MISMATCH'));
  fs.writeFileSync(path.join(dir,'dated-media-bridge.srt'),result.srt);
  const altered={...manifest,sentences:[{...manifest.sentences[0],caption_text:'偽造。'}]};
  fs.writeFileSync(path.join(dir,'dated-media-bridge.json'),JSON.stringify(altered));
  assert.ok(verifyPersisted(dir).issues.includes('SRT_TIMELINE_DRIFT'));
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});

test('20261013 date-shaped incomplete handoff without collected audio evidence fails closed and writes nothing',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'dated-bridge-20261013-missing-audio-'));
 try{
  fs.writeFileSync(path.join(dir,'sentence-audio-inventory.json'),JSON.stringify({target_date:'20261013',status:'CANDIDATE_INVENTORY_PENDING_INDEPENDENT_EDITORIAL_REVIEW',sentences:[]}));
  const result=buildFromDirectory(dir);
  assert.equal(result.status,'REJECTED');
  assert.deepEqual(result.issues,['DATED_AUDIO_EVIDENCE_MISSING_OR_INVALID']);
  assert.equal(result.render_authorized,false);
  assert.equal(result.publication_authorized,false);
  assert.throws(()=>persist(dir,result),/NOT_READY/);
  assert.deepEqual(fs.readdirSync(dir),['sentence-audio-inventory.json']);
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});

test('archived D4 20261013 review metadata blocks media output without independently collected audio',()=>{
 // Derived from D4 artifact 12366714758: editorial-review.json and dated-media-input.json.
 const gate={target_date:'20261013',reviewed_count:0,unreviewed_count:75,approved_claim_ids:[],claim_whitelist_verified:false,editorial_certified:false,render_authorized:false,publication_authorized:false};
 const dated={target_date:'20261013',review_gate_sha256:crypto.createHash('sha256').update(JSON.stringify(gate)).digest('hex'),preflight_status:'BLOCKED',blockers:['EDITORIAL_CERTIFICATION_REQUIRED','DATED_MEDIA_BRIDGE_NOT_IMPLEMENTED'],audio_manifest:null,editorial_certified:false,render_authorized:false,publication_authorized:false};
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'d4-20261013-archive-negative-'));
 try{
  assert.equal(gate.reviewed_count+gate.unreviewed_count,75);
  assert.equal(gate.approved_claim_ids.length,0);
  assert.equal(gate.claim_whitelist_verified,false);
  assert.equal(dated.preflight_status,'BLOCKED');
  assert.equal(dated.audio_manifest,null);
  const result=buildFromDirectory(dir);
  assert.equal(result.status,'REJECTED');
  assert.deepEqual(result.issues,['DATED_AUDIO_EVIDENCE_MISSING_OR_INVALID']);
  assert.equal(result.render_authorized,false);
  assert.equal(result.publication_authorized,false);
  assert.throws(()=>persist(dir,result),/NOT_READY/);
  assert.deepEqual(fs.readdirSync(dir),[]);
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});

test('D4 20261013 source verifier checks inventory hash, review gate and date before media',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'d4-source-negative-'));
 const put=(name,value)=>fs.writeFileSync(path.join(dir,name),JSON.stringify(value));
 try{
  const claims={target_date:'20261013',claim_count:75,claims:Array.from({length:75},(_,i)=>({target_date:'20261013',claim_id:'20261013:'+i+':PRICE_CHANGE',kind:'PRICE_CHANGE',origin:'facts.price.change_pct',statement:i,evidence_sources:[],review_status:'REVIEW_REQUIRED',narration_authorized:false})),claim_whitelist_verified:false,whitelisted_claim_ids:[],editorial_certified:false,render_authorized:false,publication_authorized:false};
  const inventoryHash=crypto.createHash('sha256').update(JSON.stringify(claims)).digest('hex');
  const review={target_date:'20261013',inventory_sha256:inventoryHash,reviewed_count:0,unreviewed_count:75,approved_claim_ids:[],claim_whitelist_verified:false,editorial_certified:false,render_authorized:false,publication_authorized:false};
  const worksheet={target_date:'20261013',inventory_sha256:inventoryHash,review_items:Array.from({length:3},(_,i)=>({claim_id:'20261013:'+i+':PRICE_CHANGE',kind:'PRICE_CHANGE',origin:'facts.price.change_pct',statement:i,evidence_sources:[],review_decision:'PENDING_INDEPENDENT_REVIEW',evidence_checked:false})),editorial_certified:false,narration_authorized:false,render_authorized:false,publication_authorized:false};
  const dated={target_date:'20261013',review_gate_sha256:crypto.createHash('sha256').update(JSON.stringify(review)).digest('hex'),preflight_status:'BLOCKED',audio_manifest:null,blockers:['EDITORIAL_CERTIFICATION_REQUIRED'],editorial_certified:false,render_authorized:false,publication_authorized:false};
  put('claims.json',claims);put('editorial-review.json',review);put('independent-review-worksheet.json',worksheet);put('dated-media-input.json',dated);
  assert.equal(verifyD4Source(dir).status,'VERIFIED_BLOCKED_PENDING_INDEPENDENT_REVIEW');
  put('editorial-review.json',{...review,inventory_sha256:'0'.repeat(64)});
  assert.ok(verifyD4Source(dir).issues.includes('D4_INVENTORY_SHA_MISMATCH'));
  put('editorial-review.json',{...review,unreviewed_count:74});
  assert.ok(verifyD4Source(dir).issues.includes('D4_REVIEW_INVENTORY_PARITY'));
  put('editorial-review.json',review);
  put('dated-media-input.json',{...dated,review_gate_sha256:'0'.repeat(64)});
  assert.ok(verifyD4Source(dir).issues.includes('D4_DATED_REVIEW_SHA_MISMATCH'));
  put('dated-media-input.json',dated);
  put('independent-review-worksheet.json',{...worksheet,review_items:[{...worksheet.review_items[0],statement:'tampered'},...worksheet.review_items.slice(1)]});
  assert.ok(verifyD4Source(dir).issues.includes('D4_WORKSHEET_CLAIM_CONTENT_DRIFT'));
  put('independent-review-worksheet.json',worksheet);
  put('editorial-review.json',review);put('independent-review-worksheet.json',{...worksheet,review_items:[{...worksheet.review_items[0],claim_id:'20261013:unknown:PRICE_CHANGE'},...worksheet.review_items.slice(1)]});
  assert.ok(verifyD4Source(dir).issues.includes('D4_WORKSHEET_PENDING'));
  put('independent-review-worksheet.json',worksheet);
  put('claims.json',{...claims,claims:[claims.claims[0],...claims.claims.slice(0,74)]});
  assert.ok(verifyD4Source(dir).issues.includes('D4_CLAIM_IDENTITY'));
  put('claims.json',claims);
  put('editorial-review.json',{...review,editorial_certified:true});
  assert.ok(verifyD4Source(dir).issues.includes('D4_AUTHORITY_LOCK'));
  put('editorial-review.json',review);
  put('dated-media-input.json',{...dated,target_date:'20261014'});
  assert.ok(verifyD4Source(dir).issues.includes('D4_DATE_MISMATCH'));
  put('dated-media-input.json',dated);
  put('editorial-review.json',review);put('dated-media-input.json',{...dated,audio_manifest:{unverified:true}});
  assert.ok(verifyD4Source(dir).issues.includes('D4_MEDIA_PREFLIGHT'));
  assert.deepEqual(fs.readdirSync(dir).sort(),['claims.json','dated-media-input.json','editorial-review.json','independent-review-worksheet.json']);
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});

test('dated on-disk bridge rejects unanchored audio manifests before any media output',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'d4-unanchored-audio-'));
 try{
  for(const name of ['sentence-audio-inventory.json','edge-tts-command-plan.json','sentence-audio-proof.json'])fs.writeFileSync(path.join(dir,name),JSON.stringify({target_date:'20261013'}));
  const result=buildFromDirectory(dir);
  assert.equal(result.status,'REJECTED');
  assert.ok(result.issues.includes('D4_SOURCE_PROVENANCE_REJECTED'));
  assert.equal(result.render_authorized,false);
  assert.equal(result.publication_authorized,false);
  assert.throws(()=>persist(dir,result),/NOT_READY/);
  assert.equal(fs.existsSync(path.join(dir,'dated-media-bridge.srt')),false);
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});

test('D4 M8VIS dated timeline inspector rejects mixed dates, master drift and pending claims',()=>{
 const {inspectDatedTimeline}=require('../scripts/research_date_to_video_d4_m8vis_adapter');
 const hash='a'.repeat(64);
 const scene={id:'market',market_master_sha256:hash,render_authorized:false,visual_asset:null,stock_claim_review_pending:false,excluded_pending_claim_ids:[]};
 const adapter={contract:'DATE_TO_VIDEO_V1_D4_M8VIS_DATED_SCENE_ADAPTER_RESEARCH',target_date:'20261014',market_master_sha256:hash,scenes:[scene],legacy_renderer_compatible:false,editorial_certified:false,render_authorized:false,publication_authorized:false};
 const bridge={contract:'DATE_TO_VIDEO_V1_RESEARCH_DATED_MEDIA_BRIDGE',target_date:'20261014',status:'PLAYABLE_AUDIO_AND_SRT_STRUCTURAL_ONLY_EDITORIAL_REVIEW_REQUIRED',sentences:[{id:'one',order:1,caption_text:'測試。',start_seconds:0,end_seconds:1}],total_seconds:1,srt:'1\n00:00:00,000 --> 00:00:01,000\n測試。\n\n',editorial_certified:false,narration_authorized:false,render_authorized:false,publication_authorized:false};
 const accepted=inspectDatedTimeline(adapter,bridge);
 assert.equal(accepted.status,'STRUCTURAL_INPUTS_ONLY_SCENE_ALIGNMENT_PENDING');
 assert.equal(accepted.scene_alignment_verified,false);
 assert.equal(accepted.legacy_renderer_compatible,false);
 assert.equal(accepted.render_authorized,false);
 assert.equal(accepted.publication_authorized,false);
 const reject=(a,b,code)=>{const result=inspectDatedTimeline(a,b);assert.equal(result.status,'REJECTED');assert.ok(result.issues.includes(code));assert.equal(result.render_authorized,false);};
 reject(adapter,{...bridge,target_date:'20261013'},'DATE_MATCH');
 reject({...adapter,scenes:[{...scene,market_master_sha256:'b'.repeat(64)}]},bridge,'SCENES');
 reject({...adapter,scenes:[{...scene,stock_claim_review_pending:true}]},bridge,'SCENES');
 reject({...adapter,scenes:[{...scene,excluded_pending_claim_ids:['20261014:2330:PRICE_CHANGE']}]},bridge,'SCENES');
 reject(adapter,{...bridge,render_authorized:true},'BRIDGE_LOCK');
 reject(adapter,{...bridge,srt:''},'SRT_PRESENT');
 reject(adapter,{...bridge,total_seconds:2},'TIMELINE_TOTAL');

 reject(adapter,{...bridge,srt:bridge.srt.replace('測試。','偽造。')},'SRT_TIMELINE_PARITY');
 reject(adapter,{...bridge,sentences:[{...bridge.sentences[0],start_seconds:0.25}]},'SRT_TIMELINE_PARITY');
 reject(adapter,{...bridge,sentences:[{...bridge.sentences[0],caption_text:'偽造。'}]},'SRT_TIMELINE_PARITY');
 reject(adapter,{...bridge,sentences:[{...bridge.sentences[0],order:2}]},'SRT_TIMELINE_PARITY');

 const second={id:'two',order:2,caption_text:'第二句。',start_seconds:1,end_seconds:2};
 const twoSentenceSrt=bridge.srt+'2\n00:00:01,000 --> 00:00:02,000\n第二句。\n\n';
 const two={...bridge,sentences:[...bridge.sentences,second],total_seconds:2,srt:twoSentenceSrt};
 assert.equal(inspectDatedTimeline(adapter,two).status,'STRUCTURAL_INPUTS_ONLY_SCENE_ALIGNMENT_PENDING');
 reject(adapter,{...two,sentences:[bridge.sentences[0],{...second,id:'one'}]},'SRT_TIMELINE_PARITY');
 reject(adapter,{...two,sentences:[bridge.sentences[0],{...second,start_seconds:1.2}]},'SRT_TIMELINE_PARITY');
 reject(adapter,{...two,sentences:[bridge.sentences[0],{...second,caption_text:'第三句。'}]},'SRT_TIMELINE_PARITY');
});

test('M8VIS explicit scene alignment requires ordered complete sentence ownership',()=>{
 const {inspectSceneAlignment}=require('../scripts/research_date_to_video_d4_m8vis_adapter');
 const hash='a'.repeat(64),outlineHash='b'.repeat(64),makeScene=id=>({id,source_section_ids:id==='opening'?[]:[id+'_section'],market_master_sha256:hash,render_authorized:false,visual_asset:null,stock_claim_review_pending:false,excluded_pending_claim_ids:[]});
 const adapter={contract:'DATE_TO_VIDEO_V1_D4_M8VIS_DATED_SCENE_ADAPTER_RESEARCH',target_date:'20261014',source_outline_sha256:outlineHash,market_master_sha256:hash,scenes:[makeScene('opening'),makeScene('market')],legacy_renderer_compatible:false,editorial_certified:false,render_authorized:false,publication_authorized:false};
 const sentences=[{id:'a',order:1,caption_text:'第一句。',start_seconds:0,end_seconds:1},{id:'b',order:2,caption_text:'第二句。',start_seconds:1,end_seconds:2}];
 const srt='1\n00:00:00,000 --> 00:00:01,000\n第一句。\n\n2\n00:00:01,000 --> 00:00:02,000\n第二句。\n\n';
 const bridge={contract:'DATE_TO_VIDEO_V1_RESEARCH_DATED_MEDIA_BRIDGE',target_date:'20261014',status:'PLAYABLE_AUDIO_AND_SRT_STRUCTURAL_ONLY_EDITORIAL_REVIEW_REQUIRED',sentences,srt,total_seconds:2,editorial_certified:false,narration_authorized:false,render_authorized:false,publication_authorized:false};
 const evidence={evidence_claim_ids:[],source_outline_sha256:outlineHash,market_master_sha256:hash,editorial_certified:false,render_authorized:false,publication_authorized:false};
 const assignments=[{...evidence,source_section_ids:[],scene_id:'opening',sentence_ids:['a']},{...evidence,source_section_ids:['market_section'],scene_id:'market',sentence_ids:['b']}];
 const valid=inspectSceneAlignment(adapter,bridge,assignments);
 assert.equal(valid.status,'EXPLICIT_SCENE_MAPPING_STRUCTURAL_ONLY_EDITORIAL_REVIEW_REQUIRED');
 assert.equal(valid.scene_alignment_verified,true);
 assert.deepEqual(valid.scene_plan.map(s=>[s.start_seconds,s.end_seconds]),[[0,1],[1,2]]);
 assert.equal(valid.render_authorized,false);assert.equal(valid.publication_authorized,false);assert.equal(valid.legacy_renderer_compatible,false);
 const reject=(a,b,m,code)=>{const result=inspectSceneAlignment(a,b,m);assert.equal(result.status,'REJECTED');assert.ok(result.issues.includes(code));assert.equal(result.scene_plan,null);};
 reject(adapter,bridge,[assignments[0]],'ASSIGNMENTS_REQUIRED');
 reject(adapter,bridge,[{...evidence,source_section_ids:['market_section'],scene_id:'market',sentence_ids:['a']},assignments[1]],'SCENE_ORDER');
 reject(adapter,bridge,[assignments[0],{...evidence,source_section_ids:['market_section'],scene_id:'market',sentence_ids:['a']}],'UNKNOWN_OR_DUPLICATE_SENTENCE');
 reject(adapter,bridge,[assignments[0],{...evidence,source_section_ids:['market_section'],scene_id:'market',sentence_ids:['unknown']}],'UNKNOWN_OR_DUPLICATE_SENTENCE');
 reject(adapter,{...bridge,target_date:'20261013'},assignments,'DATE_MATCH');
 reject(adapter,bridge,[assignments[0],{...evidence,source_section_ids:['market_section'],scene_id:'market',sentence_ids:[]}],'SCENE_SENTENCES');
 reject(adapter,bridge,[{...assignments[0],source_outline_sha256:'c'.repeat(64)},assignments[1]],'ASSIGNMENT_SOURCE_HASH');
 reject({...adapter,source_outline_sha256:'invalid'},bridge,assignments,'ADAPTER_OUTLINE_HASH');
 reject(adapter,bridge,[{...assignments[0],market_master_sha256:'c'.repeat(64)},assignments[1]],'ASSIGNMENT_MASTER_HASH');
 reject(adapter,bridge,[{...assignments[0],editorial_certified:true},assignments[1]],'ASSIGNMENT_REVIEW_LOCK');
 reject(adapter,bridge,[{...assignments[0],source_section_ids:['wrong_section']},assignments[1]],'SCENE_EVIDENCE_PARITY');
 reject(adapter,bridge,[{...assignments[0],source_section_ids:['fabricated_section']},assignments[1]],'ASSIGNMENT_EVIDENCE_REFS');
 reject(adapter,bridge,[{...assignments[0],evidence_claim_ids:['20261014:2330:PRICE_CHANGE']},assignments[1]],'SCENE_EVIDENCE_PARITY');
 const stockClaim='20261014:2330:PRICE_CHANGE';
 const stockAdapter={...adapter,scenes:[adapter.scenes[0],{...adapter.scenes[1],stock_claim_id:stockClaim}]};
 reject(stockAdapter,bridge,assignments,'SCENE_EVIDENCE_PARITY');
 const stockAssignments=[assignments[0],{...assignments[1],evidence_claim_ids:[stockClaim]}];
 assert.equal(inspectSceneAlignment(stockAdapter,bridge,stockAssignments).status,'EXPLICIT_SCENE_MAPPING_STRUCTURAL_ONLY_EDITORIAL_REVIEW_REQUIRED');
 reject(stockAdapter,bridge,[assignments[0],{...stockAssignments[1],evidence_claim_ids:[stockClaim,'20261014:9999:PRICE_CHANGE']}],'SCENE_EVIDENCE_PARITY');
 const pendingStockAdapter={...stockAdapter,scenes:[stockAdapter.scenes[0],{...stockAdapter.scenes[1],excluded_pending_claim_ids:[stockClaim]}]};
 reject(pendingStockAdapter,bridge,stockAssignments,'PENDING_CLAIM_EXCLUSION');
 reject(adapter,bridge,[{...assignments[0],evidence_claim_ids:['20261013:2330:PRICE_CHANGE']},assignments[1]],'ASSIGNMENT_EVIDENCE_REFS');
 reject(adapter,bridge,[assignments[0],{...assignments[1],source_section_ids:[]}],'ASSIGNMENT_EVIDENCE_REFS');

 reject(adapter,bridge,[{...evidence,source_section_ids:[],scene_id:'opening',sentence_ids:['b']},{...evidence,source_section_ids:['market_section'],scene_id:'market',sentence_ids:['a']}],'SCENE_TIMELINE_CONTINUITY');
 reject(adapter,{...bridge,publication_authorized:true},assignments,'BRIDGE_LOCK');
 reject({...adapter,scenes:{}},bridge,assignments,'SCENE_INPUT_ARRAY');
 reject(adapter,{...bridge,sentences:{}},assignments,'SENTENCE_INPUT_ARRAY');
 reject({...adapter,scenes:[null,adapter.scenes[1]]},bridge,assignments,'SCENES');
 reject(adapter,{...bridge,sentences:[null,bridge.sentences[1]]},assignments,'SENTENCES');
 reject({...adapter,scenes:[{...adapter.scenes[0],stock_claim_review_pending:true},adapter.scenes[1]]},bridge,assignments,'SCENES');
 reject({...adapter,scenes:[{...adapter.scenes[0],excluded_pending_claim_ids:['20261014:2330:PRICE_CHANGE']},adapter.scenes[1]]},bridge,assignments,'SCENES');
});
