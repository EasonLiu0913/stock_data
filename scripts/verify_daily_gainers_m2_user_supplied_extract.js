'use strict';
const fs=require('node:fs');
const path=require('node:path');
function verify(input){
 if(input.date!=='20261008'||input.provenance.kind!=='user_supplied_api_response_transcription'||input.provenance.original_http_bytes!==false||input.provenance.raw_response_sha256!==null)throw Error('source date/provenance invalid');
 const i=input.institutional;
 if(i.unit!=='TWD'||i.rows.length!==6)throw Error('institution coverage/unit invalid');
 for(const r of i.rows){if(!r.slice(1).every(Number.isSafeInteger)||r[1]-r[2]!==r[3])throw Error('institution row arithmetic');}
 const sum=i.rows.slice(0,4).reduce((a,r)=>a.map((n,k)=>n+r[k+1]),[0,0,0]);
 if(sum.some((n,k)=>n!==i.rows[5][k+1])||i.rows[4][0]!=='外資自營商')throw Error('institution total/double count');
 const f=input.fmtqik.rows;
 if(input.fmtqik.unit!=='TWD'||f.length!==6||f[5][0]!=='20261008'||f.some((r,j)=>j&&r[0]<=f[j-1][0]))throw Error('FMTQIK date/coverage');
 const five=f.slice(0,5),mean=five.reduce((a,r)=>a+r[2],0)/5;
 if(mean!==1007158931238.4||f[5][2]!==924509097873)throw Error('five-day turnover mismatch');
 const sector=input.industry;
 if(sector.unit!=='TWD'||sector.total!==34||sector.rows.length!==34||new Set(sector.rows.map(x=>x[0])).size!==34||!sector.rows.every(x=>Number.isSafeInteger(x[1])&&x[1]>=0))throw Error('industry coverage');
 const index=new Map(sector.rows);
 const electronic=['半導體','電腦及週邊設備','光電','通信網路','電子零組件','電子通路','資訊服務','其他電子'].reduce((sum,k)=>sum+index.get(k),0);
 if(electronic!==index.get('電子')||index.get('化學')+index.get('生技醫療')!==index.get('化學生技醫療'))throw Error('sector parent-child overlap');
 if(input.status!=='partial'||input.provenance.publication_authorized!==false)throw Error('premature promotion');
 return {status:'partial',institutional_net_twd:sum[2],five_day_mean_twd:mean,industry_categories:34,industry_hierarchies_verified:2,raw_source_hash_verified:false,publication_authorized:false};
}
module.exports={verify};
if(require.main===module){const p=path.join(__dirname,'../data_research/twse-market-opening/20261008-m2-user-supplied-official-json-extract.json');console.log(JSON.stringify(verify(JSON.parse(fs.readFileSync(p,'utf8'))),null,2));}
