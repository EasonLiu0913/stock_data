'use strict';
const assert=require('node:assert/strict');
const {decide}=require('./date_decision');
const base={expectedDate:'20261012',scriptDates:['20261008','20261012'],sourceReady:true,scriptValid:true,previewAuthorized:true,uploadAuthorized:false,artifactComplete:false,receiptExists:false};
const cases=[
 ['blank selects target, not prior',{},'RENDER_PREVIEW_ONLY',undefined,'20261012'],
 ['only old script',{scriptDates:['20261008']},'BLOCK','TARGET_DATE_SCRIPT_MISSING'],
 ['missing expected date',{expectedDate:''},'BLOCK','EXPECTED_DATE_UNPROVEN'],
 ['wrong manual date',{inputDate:'20261008'},'BLOCK','HISTORICAL_DATE_NOT_AUTHORIZED'],
 ['bad input',{inputDate:'2026-10-12'},'BLOCK','INVALID_INPUT_DATE'],
 ['missing sources',{sourceReady:false},'BLOCK','TARGET_DATE_SOURCES_INCOMPLETE'],
 ['invalid script',{scriptValid:false},'BLOCK','TARGET_DATE_SCRIPT_INVALID'],
 ['no preview authorization',{previewAuthorized:false},'BLOCK','PREVIEW_NOT_AUTHORIZED'],
 ['preview without upload authorization',{},'RENDER_PREVIEW_ONLY'],
 ['artifact complete but no upload authority',{artifactComplete:true,artifactDate:'20261012'},'HOLD_ARTIFACT','UPLOAD_NOT_AUTHORIZED'],
 ['artifact mismatch',{artifactComplete:true,artifactDate:'20261008',uploadAuthorized:true},'BLOCK','ARTIFACT_DATE_MISMATCH'],
 ['authorized retry',{artifactComplete:true,artifactDate:'20261012',uploadAuthorized:true},'RETRY_UPLOAD'],
 ['existing receipt',{receiptExists:true,uploadAuthorized:true},'NOOP','ALREADY_UPLOADED'],
 ['historical explicitly approved',{inputDate:'20261008',historicalAuthorized:true,scriptDates:['20261008'],sourceReady:true},'RENDER_PREVIEW_ONLY',undefined,'20261008']
];
for(const [name,override,state,reason,date] of cases){const actual=decide({...base,...override});assert.equal(actual.state,state,name);if(reason)assert.equal(actual.reason,reason,name);if(date)assert.equal(actual.date,date,name);}
console.log('PASS isolated video date contract '+cases.length+'/'+cases.length+' scenarios; no side effects');
