'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { classifyIdentity, ALLOWED_STATES } = require('../scripts/reconstruct_institutional_accumulation_official_disclosure_artifacts');
function writeJson(file,payload){fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,`${JSON.stringify(payload,null,2)}\n`);}
function makeSource(root,stock,period,knownDate){const file=path.join(root,'data_finmind_quarterly_financial_quality',stock,`${period}.json`);writeJson(file,{methodology:{conservative_known_date:knownDate},source:{provider:'FinMind'},standalone_quarter:{revenue:1}});return `data_finmind_quarterly_financial_quality/${stock}/${period}.json`;}
test('reconstructable only when source is known and committed by T0',()=>{const root=fs.mkdtempSync(path.join(os.tmpdir(),'acc-recon-'));const rel=makeSource(root,'1102','2026Q1','2026-05-15');const row=classifyIdentity({stock:'1102',t0:'20260814',artifact:'data_fundamental_events/1102/2026.json'},{root,historyResolver:p=>p===rel?'2026-06-01T00:00:00+08:00':null});assert.equal(row.state,'reconstructable_from_pre_T0_durable_inputs');assert.deepEqual(row.safe_source_paths,[rel]);});
test('late source commit is unsafe',()=>{const root=fs.mkdtempSync(path.join(os.tmpdir(),'acc-recon-'));const rel=makeSource(root,'1104','2026Q1','2026-05-15');const row=classifyIdentity({stock:'1104',t0:'20260814',artifact:'data_fundamental_events/1104/2026.json'},{root,historyResolver:p=>p===rel?'2026-08-20T00:00:00+08:00':null});assert.equal(row.state,'source_exists_but_version_or_timing_unsafe');});
test('missing directory is source_missing',()=>{const root=fs.mkdtempSync(path.join(os.tmpdir(),'acc-recon-'));const row=classifyIdentity({stock:'1201',t0:'20260814',artifact:'data_fundamental_events/1201/2026.json'},{root,historyResolver:()=>null});assert.equal(row.state,'source_missing');});
test('only post-T0 known sources are not_applicable',()=>{const root=fs.mkdtempSync(path.join(os.tmpdir(),'acc-recon-'));const rel=makeSource(root,'1215','2026Q3','2026-11-14');const row=classifyIdentity({stock:'1215',t0:'20260814',artifact:'data_fundamental_events/1215/2026.json'},{root,historyResolver:p=>p===rel?'2026-08-01T00:00:00+08:00':null});assert.equal(row.state,'not_applicable');});
test('four preregistered states only',()=>{assert.deepEqual([...ALLOWED_STATES].sort(),['not_applicable','reconstructable_from_pre_T0_durable_inputs','source_exists_but_version_or_timing_unsafe','source_missing']);});
