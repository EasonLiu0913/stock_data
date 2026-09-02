#!/usr/bin/env node
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { plan, unresolvedIdentities, CORRECTED_API_CONTRACT_VERSION, ROW_SHAPE_PREFLIGHT_VERSION, MATERIAL_STOCKS, descriptorRows } = require('../scripts/plan_institutional_accumulation_official_disclosure_collection');
const { API_ENDPOINT, REQUEST_BODY, analyzeListingPayload, rowShapeDiagnostics, findDetailDescriptors, legacyEvidence } = require('../scripts/preflight_institutional_accumulation_mops_material_information');
const collector = require('../scripts/collect_institutional_accumulation_mops_material_information_batch');

function reconstruction() {
  const rows=[]; for(let i=0;i<33;i++) rows.push({stock:MATERIAL_STOCKS[i%MATERIAL_STOCKS.length],t0:`202608${String(14+(i%12)).padStart(2,'0')}`,state:'source_missing'}); return {decisions:rows};
}
assert.equal(API_ENDPOINT,'https://mops.twse.com.tw/mops/api/t05st01');
assert.equal(collector.LIST_ENDPOINT,'https://mops.twse.com.tw/mops/api/t05st01');
assert.equal(collector.DETAIL_ENDPOINT,'https://mops.twse.com.tw/mops/api/t05st01_detail');
assert.deepEqual(REQUEST_BODY,{companyId:'1102',year:'115',month:'all',firstDay:'',lastDay:''});
const descriptor={apiName:'t05st01_detail',parameters:{enterDate:'1150115',serialNumber:'1',companyId:'1102',marketKind:'sii'}};
let analysis=analyzeListingPayload({code:200,message:'查詢成功',result:{companyId:'1102',data:[['115/01/15','x','x','x','x',descriptor]]}});
assert.equal(analysis.listing_contract_passed,true);assert.equal(analysis.detail_descriptor_count,1);
assert.equal(descriptorRows({result:{data:[['x',descriptor]]}},'1102').length,1);
assert.equal(rowShapeDiagnostics([['x',1],['y']]).coherent,false);
assert.equal(findDetailDescriptors([['x',descriptor]]).length,1);
const legacy=legacyEvidence({decision:'blocked',attempt_count:2,retryable:true,terminal_state:null,diagnostics:{requests:[]}});assert.equal(legacy.attempt_count,2);

const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'accum-official-'));
let p=plan({reconstruction:reconstruction(),rawRoot:tmp});
assert.equal(p.unresolved_identity_count,33);assert.equal(p.wave_a.length,1);assert.equal(p.wave_b.length,1);assert.equal(p.wave_c.length,0);assert.equal(p.material_information_authorized,false);
const monthly=path.join(tmp,'mops-monthly-revenue','202607');fs.mkdirSync(monthly,{recursive:true});fs.writeFileSync(path.join(monthly,'source-meta.json'),JSON.stringify({quality_state:'quality_passed'}));
const pref=path.join(tmp,'mops-material-information');fs.mkdirSync(pref,{recursive:true});
fs.writeFileSync(path.join(pref,'preflight.json'),JSON.stringify({schema_version:3,methodology:ROW_SHAPE_PREFLIGHT_VERSION,decision:'listing_contract_passed_detail_contract_unproven',contracts:{legacy:{attempt_count:2,retryable:true,terminal_state:null},corrected_api:{contract_version:CORRECTED_API_CONTRACT_VERSION,attempt_count:1,listing_contract_passed:true,detail_contract:{status:'unproven'}}}}));
const rawDir=path.join(pref,'corrected-api-preflight');fs.mkdirSync(rawDir,{recursive:true});fs.writeFileSync(path.join(rawDir,'source.json'),JSON.stringify({code:200,result:{companyId:'1102',data:[['x',descriptor]]}}));fs.writeFileSync(path.join(rawDir,'source-meta.json'),JSON.stringify({methodology:ROW_SHAPE_PREFLIGHT_VERSION,listing_contract_passed:true}));
p=plan({reconstruction:reconstruction(),rawRoot:tmp});assert.equal(p.wave_a.length,0);assert.equal(p.wave_b.length,0);assert.equal(p.wave_c.length,0);assert.equal(p.material_information_authorized,false);

fs.writeFileSync(path.join(pref,'preflight.json'),JSON.stringify({schema_version:4,methodology:'institutional-accumulation-material-information-detail-contract-resolution-v1',decision:'listing_and_detail_contract_passed',contracts:{legacy:{attempt_count:2,retryable:true,terminal_state:null},corrected_api:{contract_version:CORRECTED_API_CONTRACT_VERSION,attempt_count:1,listing_contract_passed:true,detail_contract:{status:'passed',descriptor_mapping_verified:true}}}}));
p=plan({reconstruction:reconstruction(),rawRoot:tmp});
assert.equal(p.material_information_authorized,true);assert.equal(p.wave_c_listing.length,9);assert.equal(p.wave_c_detail.length,0);assert.equal(p.wave_c.length,9);assert.deepEqual(p.wave_c_listing.map(x=>x.stock),MATERIAL_STOCKS);

const listingDir=path.join(pref,'listings','115','1102');fs.mkdirSync(listingDir,{recursive:true});fs.writeFileSync(path.join(listingDir,'source-meta.json'),JSON.stringify({quality_state:'quality_passed',attempt_count:1}));fs.writeFileSync(path.join(listingDir,'source.json'),JSON.stringify({code:200,message:'查詢成功',result:{companyId:'1102',data:[['115/01/15','18:29:04','x','x','x',descriptor]]}}));
p=plan({reconstruction:reconstruction(),rawRoot:tmp});assert.equal(p.wave_c_listing.length,8);assert.equal(p.wave_c_detail.length,1);assert.equal(p.wave_c_detail[0].stock,'1102');assert.equal(p.wave_c_detail[0].enterDate,'1150115');
const detailDir=path.join(pref,'details','115','1102','1150115_1');fs.mkdirSync(detailDir,{recursive:true});fs.writeFileSync(path.join(detailDir,'source-meta.json'),JSON.stringify({quality_state:'quality_passed',attempt_count:1}));
p=plan({reconstruction:reconstruction(),rawRoot:tmp});assert.equal(p.wave_c_detail.length,0);assert.equal(p.wave_c_listing.length,8);

const retryDir=path.join(pref,'listings','115','1103');fs.mkdirSync(retryDir,{recursive:true});fs.writeFileSync(path.join(retryDir,'attempt-meta.json'),JSON.stringify({quality_state:'retryable_failure',attempt_count:3,terminal_state:'manual_review'}));
p=plan({reconstruction:reconstruction(),rawRoot:tmp});assert.equal(p.wave_c_listing.some(x=>x.stock==='1103'),false);assert.equal(p.manual_review.some(x=>x.stock==='1103'),true);
assert.throws(()=>unresolvedIdentities({decisions:[{stock:'1102',t0:'20260814',state:'source_missing'}]}),/exactly 33/);
console.log('institutional accumulation official disclosure collection tests passed');
