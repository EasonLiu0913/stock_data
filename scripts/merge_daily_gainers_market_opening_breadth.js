'use strict';
const fs=require('node:fs');
const path=require('node:path');
function mergeVerifiedBreadth(snapshot,evidence){
 if(!snapshot||!evidence)throw Error('MISSING_INPUT');
 if(snapshot.status!=='partial'||snapshot.market!=='TWSE'||evidence.market!=='TWSE')throw Error('INVALID_MARKET_OR_STATE');
 if(snapshot.target_date!==evidence.target_date)throw Error('BREADTH_DATE_MISMATCH');
 if(evidence.status!=='verified_breadth_only'||!evidence.market_opening_breadth||!Array.isArray(evidence.source_manifest)||evidence.source_manifest.length<1)throw Error('UNVERIFIED_BREADTH_EVIDENCE');
 const sources=evidence.source_manifest;
 if(!sources.some(s=>s.source_name==='TWSE MI_INDEX'))throw Error('MISSING_BREADTH_PROVENANCE');
 for(const s of sources)if(s.source_date!==snapshot.target_date||s.market_scope!=='TWSE'||s.verified!==true)throw Error('INVALID_BREADTH_PROVENANCE');
 const merged=JSON.parse(JSON.stringify(snapshot));
 merged.schema_version=3;
 merged.market_opening_breadth=evidence.market_opening_breadth;
 merged.source_manifest.push(...sources);
 merged.quality.missing_fields=merged.quality.missing_fields.filter(s=>s!=='market_opening_breadth');
 merged.quality.warnings=[...merged.quality.warnings,'Official MI_INDEX stock-column breadth verified; other market opening components remain incomplete'];
 merged.status='partial'; // Do not automatically promote to complete
 // This artifact intentionally remains partial. Common-stock identity is an
 // independent optional scope and is not an input to the official opening.
 const mb=merged.market_opening_breadth;
 if(mb.scope!=='TWSE_MI_INDEX_OFFICIAL_STOCK_COLUMN'||mb.source_date!==merged.target_date||!Array.isArray(mb.source_manifest)||!mb.source_manifest.length)throw Error('INVALID_MARKET_OPENING_BREADTH');
 for(const key of ['advancers','decliners','unchanged','limit_up','limit_down','no_trade','no_comparison'])if(!Number.isInteger(mb[key])||mb[key]<0)throw Error('INVALID_MARKET_OPENING_BREADTH_COUNT');
 if(mb.eligible_count!==mb.advancers+mb.decliners+mb.unchanged+mb.no_trade+mb.no_comparison)throw Error('INVALID_MARKET_OPENING_BREADTH_DENOMINATOR');
 return merged;
}
function main(args=process.argv.slice(2)){
 const [date]=args;
 if(!/^20\d{6}$/.test(date||''))throw Error('Usage: node scripts/merge_daily_gainers_market_opening_breadth.js YYYYMMDD');
 const root=path.resolve(__dirname,'..');
 const base=path.join(root,'data_daily_gain_over_5/market-opening',date+'.json');
 const evidence=path.join(root,'data_daily_gain_over_5/market-opening',date+'.breadth.json');
 const result=mergeVerifiedBreadth(JSON.parse(fs.readFileSync(base,'utf8')),JSON.parse(fs.readFileSync(evidence,'utf8')));
 // Output separately; never overwrite a previously published partial/full snapshot.
 const out=path.join(root,'data_daily_gain_over_5/market-opening',date+'.with-breadth.json');
 fs.writeFileSync(out,JSON.stringify(result,null,2)+'\n');
 console.log(JSON.stringify({date,status:result.status,output:path.relative(root,out),breadth:result.breadth.eligible_count}));
}
if(require.main===module){try{main();}catch(e){console.error('BREADTH_MERGE_BLOCKED:'+e.message);process.exitCode=1;}}
module.exports={mergeVerifiedBreadth};
