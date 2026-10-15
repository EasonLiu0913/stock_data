'use strict';
const fs=require('node:fs'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const root='data_research/twse-market-opening/primary-archive/20261008/20261008-bfi82u';
function verify(bytes,manifest){
 const digest=crypto.createHash('sha256').update(bytes).digest('hex');
 assert.equal(digest,manifest.sha256,'RAW_SHA_MISMATCH');assert.equal(bytes.length,manifest.bytes,'RAW_SIZE_MISMATCH');
 assert.equal(manifest.source,'bfi82u');assert.equal(manifest.targetDate,'20261008');assert.equal(manifest.reportedDate,'20261008');assert.equal(manifest.dateVerified,true);assert.equal(manifest.httpStatus,200);
 const p=JSON.parse(bytes.toString('utf8'));assert.equal(p.stat,'OK');assert.equal(p.date,'20261008');assert.equal(p.params?.dayDate,'20261008');
 assert.deepEqual(p.fields,['單位名稱','買進金額','賣出金額','買賣差額']);assert.equal(p.data.length,6);
 const num=s=>{assert.match(s,/^-?(?:0|[1-9]\d{0,2}(?:,\d{3})*|[1-9]\d*)$/);const n=Number(s.replace(/,/g,''));assert.ok(Number.isSafeInteger(n));return n;};
 const rows=new Map();for(const r of p.data){assert.equal(r.length,4);assert.ok(!rows.has(r[0]),'DUPLICATE_INSTITUTION');const a=r.slice(1).map(num);assert.equal(a[0]-a[1],a[2],'ROW_NET_MISMATCH');rows.set(r[0],a);}
 const keys=['自營商(自行買賣)','自營商(避險)','投信','外資及陸資(不含外資自營商)','外資自營商','合計'];assert.deepEqual([...rows.keys()],keys);
 const add=(names)=>names.reduce((a,k)=>a.map((n,i)=>n+rows.get(k)[i]),[0,0,0]);
 const dealer=add(keys.slice(0,2)),trust=rows.get(keys[2]),foreign=rows.get(keys[3]),foreignDealer=rows.get(keys[4]),total=rows.get('合計');
 assert.deepEqual(add(keys.slice(0,4)),total,'TOTAL_MISMATCH');assert.deepEqual(total,[340864260628,432438885709,-91574625081]);assert.deepEqual(foreignDealer,[0,0,0]);
 const group=(a)=>({buy_twd:a[0],sell_twd:a[1],net_twd:a[2],unit:'TWD',market_scope:'TWSE'});
 return {target_date:'20261008',source:'TWSE BFI82U',raw_sha256:digest,raw_bytes:bytes.length,institutional:{foreign:group(foreign),investment_trust:group(trust),dealers:group(dealer),total:group(total)},dealer_components:{proprietary:group(rows.get(keys[0])),hedging:group(rows.get(keys[1]))},foreign_dealer_included_again:false,source_scope:'TWSE BFI82U reported transaction amounts; not common-stock-only',source_manifest_scope_verified:false,publication_authorized:false};
}
if(require.main===module){try{const result=verify(fs.readFileSync(root+'.json'),JSON.parse(fs.readFileSync(root+'.manifest.json')));fs.mkdirSync('/tmp/video-recovery-proof',{recursive:true});fs.writeFileSync('/tmp/video-recovery-proof/bfi82u-three-groups.json',JSON.stringify(result,null,2)+'\n');console.log('PASS actual BFI82U original bytes, three groups and total; source sha256 '+result.raw_sha256);}catch(e){console.error(e);process.exitCode=1;}}
module.exports={verify};
