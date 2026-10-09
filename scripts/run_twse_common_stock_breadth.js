#!/usr/bin/env node
'use strict';
/*
Usage:
node scripts/run_twse_common_stock_breadth.js YYYYMMDD --mi-index input/MI_INDEX.json --security-master input/twse-security-master.json
Security master is an independently verified date-specific normalized source:
{date:"YYYYMMDD",market:"TWSE",securities:[{code,market:"TWSE",security_type:"COMMON_STOCK"|"OTHER",classification_verified:true}]}
No unchecked current-day company list or guessed classification permitted.
*/
const fs=require('node:fs'),path=require('node:path');
const {buildBreadth}=require('./build_twse_common_stock_breadth');
function opt(args,name){const i=args.indexOf(name);return i>=0?args[i+1]:null;}
function main(args=process.argv.slice(2)){
 const [date]=args,mi=opt(args,'--mi-index'),masterFile=opt(args,'--security-master');
 if(!/^20\d{6}$/.test(date||'')||!mi||!masterFile)throw new Error('Usage: node scripts/run_twse_common_stock_breadth.js YYYYMMDD --mi-index file.json --security-master file.json');
 const payload=JSON.parse(fs.readFileSync(path.resolve(mi),'utf8'));
 const master=JSON.parse(fs.readFileSync(path.resolve(masterFile),'utf8'));
 if(!master.source || master.source.as_of_date!==date || !/^https:\/\//.test(master.source.reference||'') || master.source.publisher!=='TWSE' || master.source.digest_verified!==true || !/^[a-f0-9]{64}$/.test(master.source.archive_sha256||''))throw new Error('UNPROVEN_HISTORICAL_SECURITY_MASTER');
 const result=buildBreadth({payload,master,targetDate:date});
 const root=path.resolve(__dirname,'..'),out=path.join(root,'data_daily_gain_over_5/market-opening',date+'.breadth.json');
 const output={schema_version:1,target_date:date,market:'TWSE',status:'verified_breadth_only',breadth:result,
  source_manifest:[{source_name:'TWSE MI_INDEX',source_date:date,market_scope:'TWSE',unit:'TWD and shares',verified:true,source_path_or_endpoint:path.resolve(mi)},
   {source_name:'date-specific TWSE classified security master',source_date:date,market_scope:'TWSE',unit:'security identities',verified:true,source_path_or_endpoint:master.source.reference}]};
 fs.mkdirSync(path.dirname(out),{recursive:true});fs.writeFileSync(out,JSON.stringify(output,null,2)+'\n');
 console.log(JSON.stringify({date,output:path.relative(root,out),advancers:result.advancers,decliners:result.decliners,unchanged:result.unchanged,gainers_5pct_count:result.gainers_5pct_count,scope:result.scope},null,2));
}
if(require.main===module){try{main();}catch(e){console.error('TWSE breadth blocked: '+e.message);process.exitCode=1;}}
module.exports={main};
