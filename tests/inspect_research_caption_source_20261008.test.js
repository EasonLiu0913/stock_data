'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {inspectCaptionSource,segmentCaption}=require('../scripts/inspect_research_caption_source_20261008');
const source=JSON.parse(fs.readFileSync('/tmp/video-recovery-proof/20261008-research-caption-source.json','utf8'));
assert.equal(inspectCaptionSource(source),source.parts.reduce((n,p)=>n+p.caption_sentences.length,0));
const original=JSON.parse(fs.readFileSync('data_research/m5/ai-script-generation/20261008-original-script-v3-research.json','utf8'));
for(const part of original.segments){const projected=source.parts.find(p=>p.id===part.id);assert.deepEqual(projected.claim_ids,part.claim_ids,'ARTIFACT_CLAIM_DRIFT');assert.deepEqual(projected.card_claim_ids,part.card_claim_ids,'ARTIFACT_CARD_DRIFT');}
console.log('V3_ARTIFACT_CLAIM_CARD_PARITY_PASS research_only=true');
const segmented=source.parts.map(part=>({id:part.id,lines:part.caption_sentences.map(s=>segmentCaption(s))}));
for (let i=0;i<source.parts.length;i++) for (let j=0;j<source.parts[i].caption_sentences.length;j++) assert.equal(segmented[i].lines[j].join(''),source.parts[i].caption_sentences[j]);
const missing=structuredClone(source);missing.parts[1].caption_sentences.pop();assert.throws(()=>inspectCaptionSource(missing),/SENTENCE_COUNT_DRIFT/);
assert.throws(()=>segmentCaption('甲'.repeat(31)+'。'),/CAPTION_CLAUSE_TOO_LONG/);
fs.writeFileSync('/tmp/video-recovery-proof/20261008-research-caption-segments.json',JSON.stringify({status:'RESEARCH_SEGMENTS_NOT_TIMED_SRT',parts:segmented},null,2));
console.log('RESEARCH_CAPTION_ARTIFACT_INSPECTION_PASS sentences='+source.parts.reduce((n,p)=>n+p.caption_sentences.length,0)+' max_line=30 no_srt=true');
