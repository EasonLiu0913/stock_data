'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {verifyArchive}=require('./verify_daily_gainers_m2_primary_archive');
const ROOT=path.resolve(__dirname,'..');
function num(v){const n=Number(String(v).replaceAll(',',''));if(!Number.isFinite(n))throw Error('INVALID_NUMBER');return n;}
function build({verified,raw,recall,opening}){
 assert.equal(verified.date,'20261008');assert.equal(verified.raw_bytes_verified,true);
 assert.equal(recall.date,'20261008');assert.equal(recall.match.candidate_code_recall_within_these_two_sources,'35/35');
 assert.equal(opening.target_date,'20261008');
 const bfi=raw.bfi82u,fmt=raw.fmtqik,industry=raw.bfiamu;
 for(const x of [bfi,fmt,industry]){assert.equal(x.stat,'OK');assert.equal(x.date,'20261008');}
 const values=new Map(bfi.data.map(r=>[r[0],{buy_twd:num(r[1]),sell_twd:num(r[2]),net_twd:num(r[3])}]));
 function institution(groups){return groups.reduce((a,k)=>{const row=values.get(k);assert(row,'MISSING_INSTITUTION:'+k);return {buy_twd:a.buy_twd+row.buy_twd,sell_twd:a.sell_twd+row.sell_twd,net_twd:a.net_twd+row.net_twd};},{buy_twd:0,sell_twd:0,net_twd:0});}
 const dealers=institution(['自營商(自行買賣)','自營商(避險)']);
 const three={foreign:institution(['外資及陸資(不含外資自營商)']),trust:institution(['投信']),dealers};
 const total=institution(['合計']);
 assert.equal(three.foreign.net_twd+three.trust.net_twd+three.dealers.net_twd,total.net_twd);
 assert.equal(three.foreign.buy_twd+three.trust.buy_twd+three.dealers.buy_twd,total.buy_twd);
 const today=fmt.data.at(-1);assert.equal(today[0],'115/10/08');
 const turnover=num(today[2]);const ma5=fmt.data.slice(0,5).reduce((a,r)=>a+num(r[2]),0)/5;
 assert.equal(turnover,opening.market_trading.turnover_twd);
 assert.equal(ma5,verified.prior_five_average_twd);
 const sectors=industry.data.map(row=>({name:row[0],turnover_twd:num(row[2])}));
 assert.equal(sectors.length,34);
 return {date:'20261008',goal_version:'goal-v3',phase:'M2-v2',status:'partial',publication_authorized:false,scope:'RESEARCH_ONLY_TWSE_OFFICIAL_FINANCIAL_FACTS',source_provenance:{archive_sha256:verified.original_http_sha256,archive_bytes_verified:true,scope_verified_for_publication:false},taiex:opening.taiex,market_trading:{scope:verified.market_scope,unit:'TWD',turnover_twd:turnover,prior_five_mean_twd:ma5,ratio_to_ma5:turnover/ma5},institutional:{unit:'TWD',scope:verified.institutional_scope,groups:three,total},industry:{unit:'TWD',scope:verified.industry_scope,reported_categories:sectors.length,non_additive_categories:sectors,turnover_not_institutional_net:true},observed_gainers:{count:recall.daily_list.stock_count,matching_mi_index:recall.match.exact_code_intersection,fully_verified_as_ordinary_stock:false,featured_certified_count:0},quality:{identity_asof_verified:false,selected_stock_strict_gate_completed:false,unobserved_universe_materiality_resolved:false,source_scope_ready_for_publication:false},prompt_a_complete:false,prompt_b_eligible:false};
}
function main(){const dir=path.join(ROOT,'data_research/twse-market-opening/primary-archive/20261008');const verified=verifyArchive(dir);const raw=Object.fromEntries(['bfi82u','fmtqik','bfiamu'].map(k=>[k,JSON.parse(fs.readFileSync(path.join(dir,'20261008-'+k+'.json'),'utf8'))]));const recall=JSON.parse(fs.readFileSync(path.join(ROOT,'data_research/twse-market-opening/20261008-m2v2-daily-five-percent-recall.json')));const opening=JSON.parse(fs.readFileSync(path.join(ROOT,'data_daily_gain_over_5/market-opening/20261008.json')));console.log(JSON.stringify(build({verified,raw,recall,opening}),null,2));}
if(require.main===module){try{main()}catch(e){console.error(e.stack);process.exitCode=1;}}
module.exports={build};
