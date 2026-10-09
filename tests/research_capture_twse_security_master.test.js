'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {assess,collect,publisherDate,validDate,sha}=require('../scripts/research_capture_twse_security_master');
test('real dates validated, invalid days blocked',()=>{assert.equal(validDate('20261008'),true);assert.equal(validDate('20260230'),false);assert.equal(validDate('2026-10-08'),false);});
test('ISIN publisher date is independent from acquisition and target',()=>{
 assert.equal(publisherDate('Date Stock Updated:2026/09/26'),'20260926');
 const a=assess({date:'20261008',sourceName:'isin_listed',bytes:Buffer.from('ISIN Date Stock Updated:2026/09/26'),status:200,contentType:'text/html',acquiredAt:'2026-10-10T00:00:00.000Z',sourceUrl:'https://isin.twse.com.tw/isin/e_C_public.jsp?strMode=2'});
 assert.deepEqual(a.issues,['SOURCE_DATE_NOT_TARGET','ACQUISITION_DATE_NOT_TARGET']);
 assert.equal(a.publisher_date_ok,'BLOCKED');assert.equal(a.date_effective_coverage_ok,'BLOCKED');
});
test('JSON invalid response cannot be certified',()=>{
 const a=assess({date:'20261008',sourceName:'listed_companies',bytes:Buffer.from('<html>login</html>'),status:200,contentType:'text/html',acquiredAt:'2026-10-08T00:00:00.000Z',sourceUrl:'https://openapi.twse.com.tw/v1/opendata/t187ap03_L'});
 assert.ok(a.issues.includes('INVALID_JSON'));assert.ok(a.issues.includes('UNEXPECTED_CONTENT_TYPE'));
});
test('manual collector preserves raw hashes and never authorizes publication',async()=>{
 const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'twse-manual-'));
 const map={isin_listed:['text/html','ISIN Date Stock Updated:2026/10/08'],listed_companies:['application/json','[]'],recent_listings:['application/json','{"data":[]}']};let i=0;
 const fake=async()=>{const [type,body]=Object.values(map)[i++];return {status:200,headers:{get(k){return k==='content-type'?type:null}},arrayBuffer:async()=>Buffer.from(body)}};
 try{const result=await collect({date:'20261008',dir:path.join(tmp,'run'),fetcher:fake,now:()=> '2026-10-08T11:00:00.000Z'});
 assert.equal(result.publication_authorized,false);assert.equal(result.historical_master_complete,false);
 assert.equal(result.decision,'BLOCKED');assert.equal(result.sources.length,3);
 for(const s of result.sources)assert.equal(sha(fs.readFileSync(path.join(tmp,'run',s.original_path))),s.sha256);
 await assert.rejects(()=>collect({date:'20261008',dir:path.join(tmp,'run'),fetcher:fake}),/EEXIST|Cannot read properties/);
 }finally{fs.rmSync(tmp,{recursive:true,force:true});}
});
