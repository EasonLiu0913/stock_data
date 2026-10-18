'use strict';
const fs=require('node:fs');
const path=require('node:path');
function inspectDate(root,date){
 if(!/^20\d{6}$/.test(date)) throw new Error('INVALID_DATE_FORMAT');
 const names=['market-opening','analysis-facts','analysis-news','analysis-ai'];
 const files=Object.fromEntries(names.map(n=>[n,path.join(root,'data_daily_gain_over_5',n,`${date}.json`)]));
 const present=Object.fromEntries(Object.entries(files).map(([n,p])=>[n,fs.existsSync(p)]));
 const missing=names.filter(n=>!present[n]);
 return {target_date:date,ready:missing.length===0,missing,present,baseline:date==='20261008',research_only:true,publication_authorized:false};
}
if(require.main===module){
 const date=process.argv[2];if(!date){console.error('Usage: node scripts/research_multidate_input_readiness_v1.js YYYYMMDD [repo-root]');process.exit(2)}
 try{const r=inspectDate(process.argv[3]||'.',date);console.log(JSON.stringify(r));if(!r.ready)process.exitCode=3;}catch(e){console.error(e.message);process.exitCode=2}
}
module.exports={inspectDate};
