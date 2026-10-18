'use strict';
// Date-parametric research-only final BFI82U verifier. No network, fallback or production writes.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const keys=['自營商(自行買賣)','自營商(避險)','投信','外資及陸資(不含外資自營商)','外資自營商','合計'];
function verify(bytes,manifest,date){
 assert.match(date,/^20\d{6}$/);const hash=crypto.createHash('sha256').update(bytes).digest('hex');
 assert.equal(manifest.sha256,hash,'RAW_SHA_MISMATCH');assert.equal(manifest.bytes,bytes.length,'RAW_SIZE_MISMATCH');
 assert.equal(manifest.source,'bfi82u');assert.equal(manifest.targetDate,date,'MANIFEST_TARGET_DATE');assert.equal(manifest.reportedDate,date,'MANIFEST_REPORTED_DATE');assert.equal(manifest.dateVerified,true);assert.equal(manifest.httpStatus,200);
 const p=JSON.parse(bytes.toString('utf8'));assert.equal(p.stat,'OK');assert.equal(p.date,date,'PAYLOAD_DATE');assert.equal(p.params?.dayDate,date,'PARAM_DATE');
 assert.deepEqual(p.fields,['單位名稱','買進金額','賣出金額','買賣差額']);assert.equal(p.data.length,6);
 const num=s=>{assert.match(s,/^-?(?:0|[1-9]\d{0,2}(?:,\d{3})*|[1-9]\d*)$/);const n=Number(s.replace(/,/g,''));assert.ok(Number.isSafeInteger(n));return n;};
 const rows=new Map();for(const r of p.data){assert.equal(r.length,4);assert.ok(!rows.has(r[0]));const a=r.slice(1).map(num);assert.equal(a[0]-a[1],a[2],'ROW_NET_MISMATCH');rows.set(r[0],a);}
 assert.deepEqual([...rows.keys()],keys);const add=names=>names.reduce((a,k)=>a.map((n,i)=>n+rows.get(k)[i]),[0,0,0]);
 const total=rows.get('合計');assert.deepEqual(add(keys.slice(0,4)),total,'TOTAL_MISMATCH');assert.deepEqual(rows.get('外資自營商'),[0,0,0],'FOREIGN_DEALER_NONZERO_REVIEW_REQUIRED');
 const group=a=>({buy_twd:a[0],sell_twd:a[1],net_twd:a[2],unit:'TWD',market_scope:'TWSE',source_date:date});
 return {target_date:date,source:'TWSE BFI82U',raw_sha256:hash,raw_bytes:bytes.length,institutional:{foreign:group(rows.get(keys[3])),investment_trust:group(rows.get(keys[2])),dealers:group(add(keys.slice(0,2))),total:group(total)},final_six_rows_verified:true,ordinary_share_only:false,publication_authorized:false};
}
function inspect(root,date){
 assert.match(date,/^20\d{6}$/);const prefix=path.join(root,'data_research/twse-market-opening/primary-archive',date,date+'-bfi82u');
 if(!fs.existsSync(prefix+'.json')||!fs.existsSync(prefix+'.manifest.json')){
  const existing=['data_twse_institutional_investors/'+date+'_twse_institutional_investors.json','data_twse_foreign_investors/'+date+'_twse_foreign_investors.json','data_twse_investment_trust/'+date+'_twse_investment_trust.json','data_twse_dealers/'+date+'_twse_dealers.json'];
  const repo_daily_files=existing.filter(p=>fs.existsSync(path.join(root,p)));
  const raw=fs.existsSync(prefix+'.json'),manifest=fs.existsSync(prefix+'.manifest.json');
  return {target_date:date,status:'WAITING_SOURCE',missing:[...(!raw?['DATED_FINAL_BFI82U_RAW_MISSING']:[]),...(!manifest?['DATED_FINAL_BFI82U_MANIFEST_MISSING']:[])],repo_daily_files,repo_daily_institutional_present:repo_daily_files.length>0,bfi82u_archive_status:'MISSING_OR_INCOMPLETE',note:'Daily security-level share counts are not BFI82U market-wide TWD amounts; obtain and verify dated official six-row payload before certification.',final_six_rows_verified:false,publication_authorized:false};
 }
 return {target_date:date,status:'VERIFIED',...verify(fs.readFileSync(prefix+'.json'),JSON.parse(fs.readFileSync(prefix+'.manifest.json','utf8')),date)};
}
module.exports={verify,inspect};
