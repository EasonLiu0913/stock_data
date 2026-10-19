'use strict';
// Explicit-date research-only Manifest-to-Master evidence gate; no automatic certification.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const {build}=require('./research_official_data_manifest_v1');
const {inspect}=require('./research_date_to_video_bfi82u_v1');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
function gate(root,date,manifest=build(root,date)){
 assert.equal(manifest.target_date,date,'MANIFEST_DATE_MISMATCH');
 const fresh=build(root,date);assert.equal(manifest.manifest_sha256,fresh.manifest_sha256,'STALE_OR_TAMPERED_MANIFEST');
 const entry=manifest.entries.find(e=>e.id==='BFI82U');
 const result={contract:'OFFICIAL_MANIFEST_TO_MASTER_RESEARCH_GATE_V1',target_date:date,manifest_sha256:fresh.manifest_sha256,status:'WAITING_SOURCE',institutional:null,unverified_sources:manifest.entries.filter(e=>e.id!=='BFI82U').map(e=>({id:e.id,status:e.status,source_date:e.source_date,provenance_diagnostic:e.provenance_diagnostic||null})),complete:false,master_authorized:false,render_authorized:false,publication_authorized:false};
 if(entry?.status!=='VERIFIED_RESEARCH_ONLY'){result.status=entry?.status||'WAITING_SOURCE';return result;}
 const prefix=path.join(root,'data_research/twse-market-opening/primary-archive',date,date+'-bfi82u');
 const raw=fs.readFileSync(prefix+'.json');assert.equal(sha(raw),entry.raw_sha256,'MANIFEST_RAW_SHA_MISMATCH');
 const checked=inspect(root,date);assert.equal(checked.status,'VERIFIED','BFI82U_REVALIDATION_REQUIRED');
 assert.equal(checked.raw_sha256,entry.raw_sha256,'BFI82U_SOURCE_CHANGED');
 assert.equal(checked.final_six_rows_verified,true);
 result.status='PARTIAL_VERIFIED_INSTITUTIONAL_ONLY';result.institutional={source_date:date,raw_sha256:entry.raw_sha256,groups:checked.institutional,market_scope:'TWSE',ordinary_share_only:false};
 return result;
}
if(require.main===module){try{console.log(JSON.stringify(gate(process.argv[3]||'.',process.argv[2]),null,2))}catch(e){console.error(e.message);process.exitCode=1}}
module.exports={gate};
