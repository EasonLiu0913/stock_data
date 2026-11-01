'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const {calculate,run}=require('../scripts/research_mvp10_candidate_aggregate');
const sourcePaths=['data_daily_gain_over_5/20261008.json',
'data_daily_gain_over_5/analysis-facts/20261008.json',
'data_daily_gain_over_5/analysis-news/20261008.json',
'data_daily_gain_over_5/analysis-ai/20261008.json',
'data_daily_gain_over_5/analysis/20261008.json',
'data_twse/twse_industry_Stock.csv','data_twse/twse_industry_InnovationBoard.csv',
'data_twse/twse_industry_TDR.csv','data_twse/twse_industry_ETF.csv',
'config/daily-gainers-theme-taxonomy.json'];
function temp(fn){const d=fs.mkdtempSync(path.join(os.tmpdir(),'mvp10-aggregate-'));try{return fn(d)}finally{fs.rmSync(d,{recursive:true,force:true})}}
const taxonomy=()=>JSON.parse(fs.readFileSync('config/daily-gainers-theme-taxonomy.json'));
test('genuine 20261008 research metrics are recomputed and not render-authorized',()=>temp(d=>{
 const out=path.join(d,'work'),reports=run(process.cwd(),out);
 assert.deepEqual(reports.map(x=>x.stock_count),[32,34]);
 assert.deepEqual(reports.map(x=>x.evidence_count),[11,12]);
 assert.deepEqual(reports.map(x=>x.coverage_pct),[34.4,35.3]);
 const a=calculate(path.join(out,'stock-category-only'),taxonomy());
 const b=calculate(path.join(out,'innovation-conditional'),taxonomy());
 assert.equal(a.biotech_cause_tag_mean_gain_pct,9.89);
 assert.equal(b.biotech_cause_tag_mean_gain_pct,9.86);
 assert.deepEqual(a.biotech_cause_tag_stocks,['9919','1325','6504']);
 assert.deepEqual(b.biotech_cause_tag_stocks,['9919','1325','6504','6645']);
 for(const r of [a,b]){
  assert.equal(r.semantic_evidence_reverified,false);
  assert.equal(r.market_summary_final,false);
  assert.equal(r.render_authorized,false);
  assert.equal(r.illustrative_stock_9919.foreign_net_lots,-18);
  assert.equal(r.illustrative_stock_9919.margin_delta_lots,-327);
  assert.equal(Object.values(r.price_bands).reduce((s,x)=>s+x,0),r.stock_count);
  assert.equal(Object.values(r.catalyst_counts).reduce((s,x)=>s+x,0),r.stock_count);
  assert.equal(r.theme_ranking.some(x=>x.stock_codes.includes('9103')),false);
 }
}));
test('no source bytes are changed by research aggregate rebuilding',()=>temp(d=>{
 const old=sourcePaths.map(p=>fs.readFileSync(p));
 run(process.cwd(),path.join(d,'work'));
 sourcePaths.forEach((p,i)=>assert(fs.readFileSync(p).equals(old[i]),p));
}));
test('tampering candidate facts or digest fails closed',()=>temp(d=>{
 const out=path.join(d,'work');run(process.cwd(),out);
 const base=path.join(out,'stock-category-only');
 const p=path.join(base,'facts-row-candidates.json');
 const obj=JSON.parse(fs.readFileSync(p));obj.records[0].price.change_pct=6.01;fs.writeFileSync(p,JSON.stringify(obj));
 assert.throws(()=>calculate(base,taxonomy()),/CANDIDATE_ROW_DIGEST_MISMATCH:facts/);
}));
test('workspace cannot be silently reused or overwritten',()=>temp(d=>{
 const out=path.join(d,'work');run(process.cwd(),out);
 assert.throws(()=>run(process.cwd(),out),/RESEARCH_WORKSPACE_EXISTS/);
}));
