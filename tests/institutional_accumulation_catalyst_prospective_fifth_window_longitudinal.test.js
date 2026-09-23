'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { buildProspectiveSnapshot, snapshotRelativePath } = require('../scripts/institutional_accumulation_catalyst_prospective_pit_capture_contract');
const { buildFifthWindowLongitudinalAudit } = require('../scripts/audit_institutional_accumulation_catalyst_prospective_fifth_window_longitudinal');

const ROOT='data_research/institutional-flow/official-disclosure-raw/prospective-catalyst-pit';
const STOCKS=['1102','1104','1216'];
const INTERFACES=['prospective_material_information_detail','prospective_material_information_listing'];
const METHODOLOGY='institutional-accumulation-catalyst-prospective-live-capture-canary-v1';
const PARSER='institutional-accumulation-catalyst-prospective-canary-parser-v1';
function repo(){return fs.mkdtempSync(path.join(os.tmpdir(),'prospective-fifth-window-'));}
function key(stock,iface){return iface.endsWith('_listing')?`${stock}|115|all`:`${stock}|1150101|1|sii`;}
function snap(stock,iface,at,raw){return buildProspectiveSnapshot({source_provider:'MOPS',source_interface:iface,source_request_key:key(stock,iface),collected_at:at,source_reported_at:null,source_timestamp_precision:'collection_timestamp_only',parser_version:PARSER,methodology_identity:METHODOLOGY,raw_response:Buffer.from(raw)});}
function write(root,s){const rel=snapshotRelativePath(s);const abs=path.join(root,...rel.split('/'));fs.mkdirSync(path.dirname(abs),{recursive:true});fs.writeFileSync(abs,`${JSON.stringify(s,null,2)}\n`);}
function addWindow(root,day,hour,suffix){let minute=0;for(const stock of STOCKS)for(const iface of INTERFACES)write(root,snap(stock,iface,`2026-09-${day}T${String(hour).padStart(2,'0')}:${String(minute++).padStart(2,'0')}:00.000Z`,`${stock}|${iface}|${suffix}`));}

test('accepts exactly five complete windows with fifth-window cross-day spacing',()=>{
 const root=repo(); addWindow(root,10,13,'w1'); addWindow(root,10,14,'w2'); addWindow(root,11,14,'w3'); addWindow(root,22,14,'w4'); addWindow(root,23,14,'w5');
 const a=buildFifthWindowLongitudinalAudit(root,{rootRelative:ROOT});
 assert.equal(a.observation_count,30); assert.equal(a.chain_count,6); assert.equal(a.fifth_window_gate.later_asia_taipei_date,true); assert.equal(a.fifth_window_gate.minimum_elapsed_satisfied,true);
});
test('four windows are not enough',()=>{const root=repo(); addWindow(root,10,13,'w1'); addWindow(root,10,14,'w2'); addWindow(root,11,14,'w3'); addWindow(root,22,14,'w4'); assert.throws(()=>buildFifthWindowLongitudinalAudit(root,{rootRelative:ROOT}),/unexpected_observation_shape/);});
test('same Taipei date fails closed',()=>{const root=repo(); addWindow(root,10,13,'w1'); addWindow(root,10,14,'w2'); addWindow(root,11,14,'w3'); addWindow(root,22,1,'w4'); addWindow(root,22,2,'w5'); assert.throws(()=>buildFifthWindowLongitudinalAudit(root,{rootRelative:ROOT}),/cross_day_requirement_failed/);});
test('later local date but less than 12 hours fails closed',()=>{const root=repo(); addWindow(root,10,13,'w1'); addWindow(root,10,14,'w2'); addWindow(root,11,14,'w3'); addWindow(root,22,14,'w4'); addWindow(root,22,17,'w5'); assert.throws(()=>buildFifthWindowLongitudinalAudit(root,{rootRelative:ROOT}),/minimum_elapsed_requirement_failed/);});
