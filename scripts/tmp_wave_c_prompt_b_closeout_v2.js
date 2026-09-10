#!/usr/bin/env node
'use strict';
const fs=require('node:fs');
const cp=require('node:child_process');
const crypto=require('node:crypto');
const path=require('node:path');
const BASE='2c695abc191cc30d198c01d9bc8e68c66df030b8';
const WAVE_END='3c427e570b0856f0bab8153872c7f5c2986faae5';
const ROUND='institutional-accumulation-material-information-wave-c-physical-batch-collection-v1';
const NEXT='institutional-accumulation-catalyst-artifact-reconstruction-readiness-v1';
const HANDOFF='data_research/institutional-flow/institutional-accumulation-material-information-api-contract-handoff.md';
const ROUTING='docs/agent-prompts/task-routing.json';
const ROOT='data_research/institutional-flow/official-disclosure-raw/mops-material-information';
const WAVEA='data_research/institutional-flow/official-disclosure-raw/mops-monthly-revenue/202607';
const git=(...a)=>cp.execFileSync('git',a,{encoding:'utf8'}).trim();
const read=f=>JSON.parse(fs.readFileSync(f,'utf8'));
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const plan=read('/tmp/plan.json');
const route=read(ROUTING);
if(route.active_task!=='institutional-accumulation'||route.tasks.filter(t=>t.state==='active').length!==1) throw Error('routing invariant failed');
const at=route.tasks.find(t=>t.id==='institutional-accumulation');
if(!at||at.handoff!==HANDOFF||at.state!=='active') throw Error('active handoff mismatch');
const current=fs.readFileSync(HANDOFF,'utf8');
if(!current.includes(`\`${ROUND}\``)||!current.includes('- Prompt A: **COMPLETE**')||!current.includes('- Prompt B: **PREREGISTERED / PENDING**')) throw Error('Wave C closeout state missing');
const baseHandoff=git('show',`${BASE}:${HANDOFF}`);
const marker='## Prompt B — Wave C physical-batch collection closeout';
const stop='## Stop conditions';
const section=s=>{const i=s.indexOf(marker),j=s.indexOf(stop,i);if(i<0||j<0)throw Error('Prompt B boundaries missing');return s.slice(i,j)};
const promptB=section(current), basePromptB=section(baseHandoff);
const promptBHash=sha(Buffer.from(promptB));
if(promptBHash!==sha(Buffer.from(basePromptB))) throw Error('preregistered Prompt B changed');
if(plan.methodology!==ROUND||!plan.outcome_blind||plan.unresolved_identity_count!==33||plan.legacy_preflight_attempt_count!==2||!plan.material_information_authorized) throw Error('planner gate invariant failed');
if(plan.wave_a.length||plan.wave_b.length||plan.wave_c_listing.length||plan.wave_c_detail.length||plan.wave_c.length) throw Error('planner queue not zero');
const stocks=['1102','1103','1104','1109','1201','1203','1215','1216','1217'];
const required=['source_provider','source_interface','source_url_or_request_key','stock_id','historical_period_or_spoke_date','collected_at','http_status','final_url','response_bytes','response_sha256','parser_version','quality_state','version_safety','pit_known_at','pit_availability_rule','attempt_count','request_body','application_code','application_message','row_count'];
let listingCount=0,detailCount=0,manualCount=0; const manualRows=[];
for(const stock of stocks){
 const d=path.join(ROOT,'listings','115',stock),m=read(path.join(d,'source-meta.json')),b=fs.readFileSync(path.join(d,'source.json'));
 if(m.quality_state!=='quality_passed'||m.attempt_count>3)throw Error(`listing state ${stock}`);
 for(const k of required)if(!(k in m))throw Error(`listing ${stock} missing ${k}`);
 if(m.response_sha256!==sha(b)||m.response_bytes!==b.length)throw Error(`listing hash ${stock}`); listingCount++;
 const raw=JSON.parse(b.toString('utf8')), desc=[],seen=new Set();
 const visit=v=>{if(!v||typeof v!=='object')return;if(!Array.isArray(v)&&v.apiName==='t05st01_detail'&&v.parameters){const p=Object.fromEntries(['enterDate','serialNumber','companyId','marketKind'].map(k=>[k,String(v.parameters[k]??'')]));const key=[p.companyId,p.enterDate,p.serialNumber,p.marketKind].join('|');if(p.companyId===stock&&p.enterDate&&p.serialNumber&&p.marketKind&&!seen.has(key)){seen.add(key);desc.push(p)}};if(Array.isArray(v))v.forEach(visit);else Object.values(v).forEach(visit)}; visit(raw?.result?.data||[]);
 for(const p of desc){const dd=path.join(ROOT,'details','115',stock,`${p.enterDate}_${p.serialNumber}`),sf=path.join(dd,'source-meta.json'),af=path.join(dd,'attempt-meta.json');
  if(fs.existsSync(sf)){const dm=read(sf),db=fs.readFileSync(path.join(dd,'source.json'));if(dm.quality_state!=='quality_passed'||dm.attempt_count>3)throw Error(`detail state ${stock}/${p.enterDate}/${p.serialNumber}`);for(const k of [...required,'source_reported_date','source_reported_time','source_timestamp_precision','source_sequence'])if(!(k in dm))throw Error(`detail missing ${k}`);if(dm.response_sha256!==sha(db)||dm.response_bytes!==db.length)throw Error('detail hash mismatch');detailCount++;}
  else if(fs.existsSync(af)){const am=read(af);if(am.terminal_state!=='manual_review'||Number(am.attempt_count)!==3||!fs.existsSync(path.join(dd,'attempts')))throw Error('manual review state');manualRows.push({request_key:`mops-material-information-detail|stock=${stock}|enterDate=${p.enterDate}|serial=${p.serialNumber}|market=${p.marketKind}`,attempt_count:3,failure_reason:am.failure_reason||am.reason||'unspecified'});manualCount++;}
  else throw Error('missing durable detail state');
 }
}
if(listingCount!==9||detailCount!==255||manualCount!==40||plan.manual_review.filter(x=>x.kind==='detail').length!==40)throw Error(`coverage mismatch ${listingCount}/${detailCount}/${manualCount}`);
const reasonCounts=Object.fromEntries([...new Set(manualRows.map(x=>x.failure_reason))].sort().map(k=>[k,manualRows.filter(x=>x.failure_reason===k).length]));
if(reasonCounts.descriptor_identity_mismatch!==39||reasonCounts.suspected_soft_block_or_transport_failure!==1)throw Error('manual reason mismatch');
for(const f of ['source.html','source-meta.json','rows.json']){if(git('hash-object',path.join(WAVEA,f))!==git('rev-parse',`${BASE}:${path.join(WAVEA,f)}`))throw Error(`Wave A changed: ${f}`)}
// Protected criterion is scoped to the Wave C execution window. Later authorized Withdrawal/backtest changes are not attributed to Wave C.
const protectedRe=/(development-sample-freeze|development-outcome|development-association|stock-holdout|time-holdout|2454|institutional-withdrawal.*v6)/i;
const baseFiles=git('ls-tree','-r','--name-only',BASE,'data_research/institutional-flow').split(/\n/).filter(Boolean).filter(f=>protectedRe.test(f));
const waveChanges=[];for(const f of baseFiles){try{if(git('rev-parse',`${BASE}:${f}`)!==git('rev-parse',`${WAVE_END}:${f}`))waveChanges.push(f)}catch{waveChanges.push(f)}}
if(waveChanges.length)throw Error(`Wave C changed protected files: ${waveChanges.join(',')}`);
const wf=fs.readFileSync('.github/workflows/collect-institutional-accumulation-official-disclosure.yml','utf8'),collector=fs.readFileSync('scripts/collect_institutional_accumulation_mops_material_information_batch.js','utf8');
for(const t of ['max-parallel: 1','cancel-in-progress: false','Collect exactly one listing partition','Collect exactly one detail descriptor','sleep $((20 + RANDOM % 41))'])if(!wf.includes(t))throw Error(`workflow invariant ${t}`);
if(!collector.includes('2000 + Math.floor(Math.random() * 3001)')||!collector.includes("if (attempt > 3) throw new Error('manual_review_attempt_ceiling')"))throw Error('collector boundedness invariant');
if(wf.includes('/mops/web/ajax_t05st01')||collector.includes('/mops/web/ajax_t05st01'))throw Error('legacy endpoint present');
const audited=git('rev-parse','HEAD');
const audit={schema_version:1,round:ROUND,preregistered_baseline_sha:BASE,wave_c_execution_end_sha:WAVE_END,audited_main_sha:audited,prompt_b_sha256:promptBHash,prompt_b_closeout:'PASS',routing_pass:true,protected_execution_window_changes:[],post_wave_c_protected_changes_note:'Later Withdrawal/multi-stock backtest commits on 2026-09-07/08 are outside the Wave C execution window and are not attributed to Wave C.',legacy_attempt_count:2,wave_a_refetched:false,unresolved_identity_count:33,listing_count:9,quality_passed_detail_count:255,retryable_detail_count:0,manual_review_detail_count:40,manual_review_reason_counts:reasonCounts,planner_remaining_queue_count:0,workflow_contract:{max_parallel:1,cancel_in_progress:false,listing_batch_size:1,detail_batch_size:1,pre_request_jitter_seconds:'2-5',inter_batch_cooldown_seconds:'20-60',attempt_ceiling:3},provenance_validation:'PASS',next_round:NEXT,manual_review_details:manualRows};
fs.writeFileSync(path.join(ROOT,'wave-c-prompt-b-closeout.json'),JSON.stringify(audit,null,2)+'\n');
const close=`## Wave C Prompt B closeout\n\nRound: \`${ROUND}\`\n\n**Prompt B closeout: PASS**\n\nPreregistered baseline: \`${BASE}\`; Wave C execution-end checkpoint: \`${WAVE_END}\`; audited current-main SHA: \`${audited}\`; preregistered Prompt B SHA-256: \`${promptBHash}\`.\n\nVerified: listings **9/9**; quality-passed details **255**; retryable **0**; terminal manual_review **40** (descriptor_identity_mismatch=39, suspected_soft_block_or_transport_failure=1); planner queue **0**; legacy attempt_count **2**; Wave A byte-identical to preregistration; protected artifacts unchanged across the Wave C execution window; raw bytes/hashes/provenance/PIT/version-safety fields revalidated. Workflow remains one key per fresh runner, max-parallel=1, 2-5s jitter, 20-60s cooldown, ceiling=3, cancel-in-progress=false, remote-completed-wins, with no legacy endpoint.\n\nA first closeout audit incorrectly compared protected files through 2026-09-10 and therefore included later independent Withdrawal/multi-stock backtest changes from 2026-09-07/08. The corrected criterion compares the preregistered baseline through the final Wave C durable checkpoint only; those later changes are explicitly outside Wave C attribution.\n\nCanonical closeout: \`${ROOT}/wave-c-prompt-b-closeout.json\`. No outcome/holdout/catalyst-association/threshold/score/model/strategy/production behavior was opened by this Prompt B.\n\n`;
const nextA=`## Prompt A — Catalyst artifact reconstruction/readiness\n\n\`\`\`text\nContinue only if current remote main still routes the sole active task to this handoff and round ${NEXT} is Prompt A NOT STARTED / ACTIVE. Fetch current main and read AGENTS.md, project philosophy/roadmap, this handoff, historical validation handoff, frozen source-collection preregistration, exact 33-identity reconstruction artifact, Wave C Prompt B closeout, Wave A raw files, and all Wave C durable listing/detail evidence.\n\nReconstruct an outcome-blind, PIT-safe catalyst-evidence readiness artifact for exactly the frozen 33 source_missing identities using only already-collected official evidence. Issue zero MOPS or other source network requests. Do not open development outcomes, stock/time holdouts, protected 2454 outcomes, catalyst/outcome association, thresholds, scores, models, strategies, or production behavior. Preserve exact source identity, source-reported timestamp precision, parser/provenance, version_safety and PIT disclaimer. Manual_review/missing/ambiguous evidence stays explicit and cannot be imputed positive. Produce machine-readable output plus regression tests.\n\nCompletion requires all 33 identities exactly once, zero network, protected state unchanged/unopened, tests PASS, durable commit, then mark Prompt A COMPLETE / Prompt B pending and stop: Prompt A complete — ready for Prompt B.\n\`\`\`\n\n`;
const nextB=`## Prompt B — Catalyst artifact reconstruction/readiness closeout\n\n\`\`\`text\nPerform mandatory closeout for ${NEXT} only after Prompt A completes. Fetch current remote main and recover this exact Prompt B from durable pre-Prompt-A history. Independently verify sole active routing; exact 33 identities each once; only already-durable Wave A/Wave C evidence; zero source network requests; exact source/timestamp/parser/provenance/version_safety/PIT fields; manual_review ambiguity preserved; protected development outcomes/holdouts/2454/refreshed association/Withdrawal v6 unchanged/unopened by this round; no catalyst/outcome association or thresholds/scores/models/strategies/production behavior; tests reproduce counts/readiness; durable outputs exist on remote main. Fix only bounded defects and restart verification. On PASS record exact commits/tests/counts/limitations, preregister/promote only the correct next round without executing it, end Prompt B closeout: PASS, and stop.\n\`\`\`\n\n`;
let revised=current.replace(`\`${ROUND}\`\n\nStatus:\n- Prompt A: **COMPLETE**\n- Prompt B: **PREREGISTERED / PENDING**`,`\`${NEXT}\`\n\nStatus:\n- Prompt A: **NOT STARTED / ACTIVE**\n- Prompt B: **PREREGISTERED / PENDING**`);
if(revised===current)throw Error('promotion replacement failed');
revised=revised.replace(marker,close+marker);
const si=revised.indexOf(stop);if(si<0)throw Error('stop marker missing');revised=revised.slice(0,si)+nextA+nextB+revised.slice(si);
fs.writeFileSync(HANDOFF,revised);
console.log(JSON.stringify(audit,null,2));