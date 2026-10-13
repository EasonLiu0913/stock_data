'use strict';
const assert=require('node:assert/strict');
const {decide}=require('./date_decision');
const fakeCalls=[];
function route(input) {
 const result=decide(input);
 if(result.state==='RENDER_PREVIEW_ONLY') fakeCalls.push({kind:'MOCK_PREVIEW_ONLY',date:result.date});
 if(result.state==='RETRY_UPLOAD') fakeCalls.push({kind:'MOCK_UPLOAD_ELIGIBILITY_ONLY',date:result.date});
 return result;
}
const base={expectedDate:'20261012',scriptDates:['20261008','20261012'],sourceReady:true,scriptValid:true,previewAuthorized:true,uploadAuthorized:false,artifactComplete:false};
const table=[
 ['blank current preview',{},'RENDER_PREVIEW_ONLY','MOCK_PREVIEW_ONLY'],
 ['blank old only',{scriptDates:['20261008']},'BLOCK',null],
 ['partial current',{sourceReady:false},'BLOCK',null],
 ['invalid source script',{scriptValid:false},'BLOCK',null],
 ['unproven calendar',{expectedDate:undefined},'BLOCK',null],
 ['unapproved historical',{inputDate:'20261008'},'BLOCK',null],
 ['historical authorized',{inputDate:'20261008',historicalAuthorized:true},'RENDER_PREVIEW_ONLY','MOCK_PREVIEW_ONLY'],
 ['artifact wrong date',{artifactComplete:true,artifactDate:'20261008',uploadAuthorized:true},'BLOCK',null],
 ['artifact upload withheld',{artifactComplete:true,artifactDate:'20261012'},'HOLD_ARTIFACT',null],
 ['artifact retry scoped',{artifactComplete:true,artifactDate:'20261012',uploadAuthorized:true},'RETRY_UPLOAD','MOCK_UPLOAD_ELIGIBILITY_ONLY'],
 ['receipt already recorded',{receiptExists:true,artifactComplete:true,artifactDate:'20261012',uploadAuthorized:true},'NOOP',null],
 ['preview denied',{previewAuthorized:false},'BLOCK',null]
];
for(const [name,over,status,call] of table){const before=fakeCalls.length;const out=route({...base,...over});assert.equal(out.state,status,name);assert.equal(fakeCalls.length-before,call?1:0,name);if(call) assert.equal(fakeCalls.at(-1).kind,call,name);}
assert(fakeCalls.every(x=>x.kind!=='RENDER_AND_UPLOAD'&&x.kind!=='GH_WORKFLOW_DISPATCH'));
console.log('PASS isolated integration mock '+table.length+'/'+table.length+' cases; zero real dispatch; preview/upload separated');
