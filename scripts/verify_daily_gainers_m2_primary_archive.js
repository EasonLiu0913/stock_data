'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const root=path.join(__dirname,'../data_research/twse-market-opening/primary-archive/20261008');
function n(x){const s=String(x);if(!/^-?\d{1,3}(,\d{3})*$|^-?\d+$/.test(s))throw Error('invalid integer '+s);return Number(s.replace(/,/g,''));}
function verifyArchive(dir=root){
 const docs={};const digests={};
 for(const source of ['bfi82u','fmtqik','bfiamu']){
  const b=fs.readFileSync(path.join(dir,'20261008-'+source+'.json'));
  const m=JSON.parse(fs.readFileSync(path.join(dir,'20261008-'+source+'.manifest.json'),'utf8'));
  const sha=crypto.createHash('sha256').update(b).digest('hex');
  assert.equal(sha,m.sha256,'raw SHA '+source);assert.equal(b.length,m.bytes,'raw size '+source);
  assert.equal(m.source,source);assert.equal(m.targetDate,'20261008');assert.equal(m.reportedDate,'20261008');
  assert.equal(m.httpStatus,200);assert.equal(m.dateVerified,true);assert.equal(m.archiveType,'original_http_response');
  assert.equal(m.scopeVerified,false);assert.equal(m.publicationAuthorized,false);
  const j=JSON.parse(b.toString('utf8'));assert.equal(j.stat,'OK');assert.equal(j.date,'20261008');docs[source]=j;digests[source]=sha;
 }
 const i=docs.bfi82u,f=docs.fmtqik,s=docs.bfiamu;
 assert.deepEqual(i.fields,['單位名稱','買進金額','賣出金額','買賣差額']);assert.equal(i.data.length,6);
 const institution=new Map(i.data.map(r=>[r[0],r.slice(1).map(n)]));
 for(const r of i.data){assert.equal(n(r[1])-n(r[2]),n(r[3]),'institution row');}
 const keys=['自營商(自行買賣)','自營商(避險)','投信','外資及陸資(不含外資自營商)'];
 assert.deepEqual(keys.reduce((a,k)=>a.map((v,j)=>v+institution.get(k)[j]),[0,0,0]),institution.get('合計'));
 // The foreign dealer row is already counted in dealer total; never add again.
 assert.equal(institution.get('外資自營商').length,3);
 assert.equal(n(i.data[5][3]),-91574625081);
 assert.deepEqual(f.fields,['日期','成交股數','成交金額','成交筆數','發行量加權股價指數','漲跌點數']);
 const dates=f.data.map(r=>r[0]);assert.deepEqual(dates,['115/10/01','115/10/02','115/10/05','115/10/06','115/10/07','115/10/08']);
 const mean=f.data.slice(0,5).reduce((v,r)=>v+n(r[2]),0)/5;assert.equal(mean,1007158931238.4);
 assert.equal(n(f.data[5][2]),924509097873);
 assert.equal(s.total,34);assert.equal(s.data.length,34);
 const sector=new Map(s.data.map(r=>[r[0].trim(),n(r[2])]));
 assert.equal(sector.size,34);
 const kids=['半導體類指數','電腦及週邊設備類指數','光電類指數','通信網路類指數','電子零組件類指數','電子通路類指數','資訊服務類指數','其他電子類指數'];
 assert.equal(kids.reduce((v,k)=>v+sector.get(k),0),sector.get('電子類指數'));
 assert.equal(sector.get('化學類指數')+sector.get('生技醫療類指數'),sector.get('化學生技醫療類指數'));
 return {date:'20261008',status:'partial',original_http_sha256:digests,raw_bytes_verified:true,source_units:{institutional:'TWD',market_turnover:'TWD',industry_turnover:'TWD'},market_scope:'all TWSE reported market trades, not common-stock-only',institutional_scope:'BFI82U TWD transaction amounts including odd-lot after-hours and blocks',industry_scope:'index category turnover with overlapping parent-child categories; never infer institutional sector cash flow',sector_parent_child_checks:2,industry_categories:34,prior_five_average_twd:mean,per_security_5pct:{validated:false,required_source:'separate dated MI_INDEX legal ordinary-stock security identification and strict >=5% validation',may_substitute_market_aggregate:false},scope_verified_for_publication:false,publication_authorized:false,prompt_a_complete:false,prompt_b_eligible:false};
}
module.exports={verifyArchive};
if(require.main===module)console.log(JSON.stringify(verifyArchive(),null,2));
