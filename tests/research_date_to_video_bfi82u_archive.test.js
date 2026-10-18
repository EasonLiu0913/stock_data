'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {archive}=require('../scripts/research_date_to_video_bfi82u_archive');
const {inspect}=require('../scripts/research_date_to_video_bfi82u_v1');
const date='20261008',sourceUrl='https://www.twse.com.tw/rwd/zh/fund/BFI82U?type=day&dayDate='+date+'&response=json';
const fixture=fs.readFileSync(path.join(__dirname,'../data_research/twse-market-opening/primary-archive/20261008/20261008-bfi82u.json'));
const meta={httpStatus:200,contentType:'application/json;charset=UTF-8',sourceUrl,observedAt:'2026-10-10T03:12:36.523Z'};
test('archives verified official bytes and manifest with no publication approval',()=>{const root=fs.mkdtempSync(path.join(os.tmpdir(),'bfi82u-'));try{const a=archive(root,date,fixture,meta);assert.equal(a.status,'VERIFIED_RESEARCH_ARCHIVE');assert.equal(inspect(root,date).status,'VERIFIED');assert.equal(inspect(root,date).publication_authorized,false);assert.throws(()=>archive(root,date,fixture,meta),/ARCHIVE_ALREADY_EXISTS/);}finally{fs.rmSync(root,{recursive:true,force:true});}});
test('rejects wrong date, HTTP failure and forged aggregate without archive',()=>{for(const [bytes,m] of [[fixture,{...meta,httpStatus:403}],[fixture,{...meta,sourceUrl:sourceUrl.replace(date,'20261013')}],[Buffer.from(fixture.toString().replace('340,864,260,628','340,864,260,629')),meta]]){const root=fs.mkdtempSync(path.join(os.tmpdir(),'bfi82u-'));try{assert.throws(()=>archive(root,date,bytes,m));assert.equal(fs.existsSync(path.join(root,'data_research')),false);}finally{fs.rmSync(root,{recursive:true,force:true});}}});
