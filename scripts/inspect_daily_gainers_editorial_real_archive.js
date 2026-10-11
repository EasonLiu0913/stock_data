'use strict';
// Read the actual archived 20261008 facts; never self-certify publication scope.
const fs=require('node:fs'),path=require('node:path');
const {verifyArchive}=require('./verify_daily_gainers_m2_primary_archive');
const {replay}=require('./replay_daily_gainers_m1_breadth_for_m3');
const {build:finance}=require('./build_daily_gainers_m2v2_verified_facts');
const {build:editorial}=require('./build_daily_gainers_editorial_v1_research');
function inspect(root=path.resolve(__dirname,'..')){
 const dir=path.join(root,'data_research/twse-market-opening/primary-archive/20261008');
 const v=verifyArchive(dir),raw=Object.fromEntries(['bfi82u','fmtqik','bfiamu'].map(k=>[k,JSON.parse(fs.readFileSync(path.join(dir,'20261008-'+k+'.json'),'utf8'))]));
 const opening=JSON.parse(fs.readFileSync(path.join(root,'data_daily_gain_over_5/market-opening/20261008.json'),'utf8'));
 const recall=JSON.parse(fs.readFileSync(path.join(root,'data_research/twse-market-opening/20261008-m2v2-daily-five-percent-recall.json'),'utf8'));
 const b=replay(),f=finance({verified:v,raw,recall,opening});
 if(v.date!==opening.target_date||b.date!==v.date||f.date!==v.date)throw Error('EDITORIAL_ARCHIVE_DATE_MISMATCH');
 if(!v.raw_bytes_verified||!f.source_provenance.archive_bytes_verified)throw Error('EDITORIAL_ARCHIVE_UNVERIFIED');
 const evidence={date:v.date,source_sha256:v.original_http_sha256,market_scope:v.market_scope,institutional_scope:v.institutional_scope,breadth:b.counts,index_change_points:opening.taiex.change_points,turnover_twd:f.market_trading.turnover_twd,ma5_twd:f.market_trading.prior_five_mean_twd,groups:Object.fromEntries(['foreign','trust','dealers'].map(k=>[k,f.institutional.groups[k].net_twd])),net_twd:f.institutional.total.net_twd,scope_verified_for_publication:v.scope_verified_for_publication&&f.source_provenance.scope_verified_for_publication};
 if(evidence.scope_verified_for_publication!==false)throw Error('EDITORIAL_RESEARCH_SCOPE_DRIFT');
 return {status:'REAL_ARCHIVE_INTEGRITY_PASS_PUBLICATION_SCOPE_BLOCKED',evidence,publication_authorized:false,tts_authorized:false,video_authorized:false};
}
function candidate(){const report=inspect();if(!report.evidence.scope_verified_for_publication)throw Error('EDITORIAL_PUBLICATION_SCOPE_NOT_CERTIFIED');return editorial(report.evidence);}
if(require.main===module){console.log(JSON.stringify(inspect(),null,2));try{candidate()}catch(e){if(e.message!=='EDITORIAL_PUBLICATION_SCOPE_NOT_CERTIFIED')throw e;console.log('CANDIDATE_BLOCKED: '+e.message);}}
module.exports={inspect,candidate};
