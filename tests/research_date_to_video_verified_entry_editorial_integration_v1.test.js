'use strict';
// Real 20261008 date-entry integration. Never fabricates official source completeness or editorial approval.
const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),crypto=require('node:crypto');
const {execute}=require('../scripts/research_date_to_video_verified_entry_v1');
const {verify}=require('../scripts/research_date_to_video_verified_entry_verify_v1');
const {FIXED_OPENING_LINES}=require('../scripts/research_date_to_video_fixed_opening_v1');
const sha=x=>crypto.createHash('sha256').update(JSON.stringify(x)).digest('hex');
// Owner reconfirmed canonical V4 line four; do not silently restore the superseded CC line.
assert.deepEqual(FIXED_OPENING_LINES,['大家好，歡迎來到 TAIWAN STOCK！','追蹤資金，解讀行情。','錢在哪，我們就在哪！','那麼我們開始囉。']);
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'d4-editorial-integration-'));
const read=n=>JSON.parse(fs.readFileSync(path.join(dir,n),'utf8'));
try{
 execute('.','20261008',dir);
 const inventory=read('claims.json'),claim=inventory.claims.find(c=>c.kind==='PRICE_CHANGE');
 assert.ok(claim,'DATED_PRICE_CLAIM_REQUIRED');
 fs.writeFileSync(path.join(dir,'editorial-review-input.json'),JSON.stringify({target_date:'20261008',inventory_sha256:sha(inventory),decisions:[{claim_id:claim.claim_id,decision:'APPROVE',reviewer:'research-fixture-reviewer',rationale:'Explicit test decision, not editorial certification',evidence_checked:true,causal_language_prohibited:true}]}));
 const insight=(id,section,evidence)=>({id,section,observation:'日期限定觀察',interpretation:'研究解讀待獨立審核',uncertainty:'相關性不代表因果',evidence});
 fs.writeFileSync(path.join(dir,'original-analysis-draft-input.json'),JSON.stringify({target_date:'20261008',insights:[
 insight('breadth','market_breadth_vs_index',[{type:'master_field',path:'breadth.advancers'}]),
 insight('flow','institutional_flow_vs_breadth',[{type:'master_field',path:'institutional.foreign.net_twd'}]),
 insight('stock','selected_stock_evidence',[{type:'claim_id',id:claim.claim_id}]),
 insight('counter','counterarguments_and_uncertainty',[{type:'master_field',path:'breadth.decliners'}]),
 insight('summary','three_point_summary',[{type:'master_field',path:'market_trading.turnover_twd'}])
 ]}));
 const drafted=execute('.','20261008',dir),worksheet=read('editorial-narration-worksheet.json');
 const draftCheck=read('original-analysis-draft-check.json');
 assert.equal(draftCheck.status,'REJECTED');
 assert.match(draftCheck.reason,/^CLAIM_WHITELIST_NOT_VERIFIED(?:\\n|$)/);
 assert.ok(drafted.blockers.includes('ORIGINAL_ANALYSIS_DRAFT_REJECTED'));
 assert.deepEqual(worksheet.sections,[]);
 assert.ok(worksheet.issues.includes('DRAFT_STRUCTURAL_EVIDENCE_REQUIRED'));
 assert.equal(worksheet.editorial_certified,false);
 assert.equal(worksheet.narration_authorized,false);
 assert.equal(verify(dir).status,'VERIFIED_RESEARCH_ONLY');
 assert.equal(drafted.tts_authorized,false);assert.equal(drafted.render_authorized,false);assert.equal(drafted.publication_authorized,false);
 console.log('D4_PARTIAL_REVIEW_EDITORIAL_ENTRY_FAIL_CLOSED_PASS');
}finally{fs.rmSync(dir,{recursive:true,force:true})}
