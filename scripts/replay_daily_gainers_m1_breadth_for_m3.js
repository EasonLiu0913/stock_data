'use strict';
const fs=require('node:fs'),crypto=require('node:crypto'),path=require('node:path');
const {verifyOfficialMarketBreadth}=require('./verify_daily_gainers_official_market_breadth');
const evidence=require('../data_research/twse-market-opening/20261008-m1v2-prompt-a-official-market-breadth-evidence.json');
const filename=path.resolve(__dirname,'../data_twse_mi_index/20261008_twse_mi_index.json');
function replay(raw=fs.readFileSync(filename),ref=evidence){
 const digest=crypto.createHash('sha256').update(raw).digest('hex');
 if(digest!==ref.source.archived_full_original_sha256_from_prior_provenance)throw Error('M1_ORIGINAL_SHA_MISMATCH');
 const p=JSON.parse(raw.toString('utf8'));if(p.stat!=='OK'||p.date!==ref.target_date)throw Error('M1_SOURCE_DATE_STATUS');
 const t=p.tables?.find(x=>x.title==='漲跌證券數合計');
 if(!t||JSON.stringify(t.fields)!==JSON.stringify(['類型','整體市場','股票'])||t.data?.length!==5)throw Error('M1_TABLE_SCHEMA');
 const n=x=>{const m=String(x).match(/^(\d[\d,]*)(?:\(\d+\))?$/);if(!m)throw Error('M1_BAD_STOCK_COUNT');return Number(m[1].replaceAll(',',''));};
 const labels=['上漲','下跌','持平','未成交','無比價'];
 const keys=['advancers','decliners','unchanged','no_trade_count','no_comparison_count'];
 const counts={};for(let i=0;i<5;i++){if(!String(t.data[i][0]).startsWith(labels[i]))throw Error('M1_BUCKET_LABEL_MISMATCH');counts[keys[i]]=n(t.data[i][2]);}
 const x=verifyOfficialMarketBreadth({target_date:ref.target_date,source_date:p.date,market:'TWSE',source_name:'TWSE_MI_INDEX',source_scope:'TWSE_OFFICIAL_STOCK_COLUMN',stock_counts:counts,source_sha256:digest});
 if(x.total!==1082||keys.some(k=>counts[k]!==ref.source.stock_counts[k]))throw Error('M1_ACCEPTED_BREADTH_DRIFT');
 return {date:p.date,source_file:'data_twse_mi_index/20261008_twse_mi_index.json',sha256:digest,source_git_blob_sha:ref.source.git_blob_sha,scope:x.source_scope,counts,total:x.total,individual_gainers_certified:false};
}
if(require.main===module)console.log(JSON.stringify(replay(),null,2));
module.exports={replay};
