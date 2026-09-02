#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict'); const fs=require('node:fs'); const os=require('node:os'); const path=require('node:path');
const {plan,unresolvedIdentities}=require('../scripts/plan_institutional_accumulation_official_disclosure_collection');
const {blocked}=require('../scripts/preflight_institutional_accumulation_mops_material_information');
function reconstruction(){const stocks=['1102','1103','1104','1109','1201','1203','1215','1216','1217'];const rows=[];for(let i=0;i<33;i++)rows.push({stock:stocks[i%stocks.length],t0:`202608${String(14+(i%12)).padStart(2,'0')}`,state:'source_missing'});return{decisions:rows};}
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'accum-official-'));
let p=plan({reconstruction:reconstruction(),rawRoot:tmp});
assert.equal(p.unresolved_identity_count,33); assert.equal(p.wave_a.length,1); assert.equal(p.wave_b.length,1); assert.equal(p.wave_c.length,0); assert.equal(p.material_information_authorized,false);
const monthly=path.join(tmp,'mops-monthly-revenue','202607');fs.mkdirSync(monthly,{recursive:true});fs.writeFileSync(path.join(monthly,'source-meta.json'),JSON.stringify({quality_state:'quality_passed'}));
const pref=path.join(tmp,'mops-material-information');fs.mkdirSync(pref,{recursive:true});
fs.writeFileSync(path.join(pref,'preflight.json'),JSON.stringify({decision:'blocked',reason:'listing_security_or_quality_block',attempt_count:1,retryable:true}));
p=plan({reconstruction:reconstruction(),rawRoot:tmp}); assert.equal(p.wave_a.length,0); assert.equal(p.wave_b.length,1); assert.equal(p.wave_b[0].attempt_count,1); assert.equal(p.wave_c.length,0); assert.equal(p.preflight_retryable,true);
fs.writeFileSync(path.join(pref,'preflight.json'),JSON.stringify({decision:'blocked',reason:'listing_security_or_quality_block',attempt_count:3,retryable:false,terminal_state:'manual_review'}));
p=plan({reconstruction:reconstruction(),rawRoot:tmp}); assert.equal(p.wave_b.length,0); assert.equal(p.wave_c.length,0); assert.equal(p.preflight_retryable,false);
fs.writeFileSync(path.join(pref,'preflight.json'),JSON.stringify({decision:'pass',attempt_count:2,retryable:false}));
p=plan({reconstruction:reconstruction(),rawRoot:tmp}); assert.equal(p.wave_a.length,0); assert.equal(p.wave_b.length,0); assert.equal(p.wave_c.length,9); assert.equal(p.material_information_authorized,true);
assert.throws(()=>unresolvedIdentities({decisions:[{stock:'1102',t0:'20260814',state:'source_missing'}]}),/exactly 33/);
assert.equal(blocked('<html>Access denied</html>',8000),true); assert.equal(blocked('<html>'+('x'.repeat(5000))+'</html>',5013),false);
console.log('institutional accumulation official disclosure collection tests passed');
