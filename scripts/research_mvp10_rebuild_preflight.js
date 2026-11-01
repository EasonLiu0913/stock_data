#!/usr/bin/env node
'use strict';
// Read-only 20261008 regeneration dependency preflight. No historical data writes.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const SOURCES=Object.freeze([
  ['raw','data_daily_gain_over_5/{date}.json','stocks'],
  ['news','data_daily_gain_over_5/analysis-news/{date}.json','analyses'],
  ['facts','data_daily_gain_over_5/analysis-facts/{date}.json','stocks'],
  ['ai','data_daily_gain_over_5/analysis-ai/{date}.json','analyses'],
  ['published','data_daily_gain_over_5/analysis/{date}.json','analyses'],
  ['summary','data_daily_gain_over_5/market-summary/{date}.json',null],
  ['script','video_scripts/daily-gainers/{date}.json',null],
]);
const EXCLUDED=Object.freeze([{code:'9103',classification:'TDR',reason:'non-ordinary depositary receipt'}]);
const UNRESOLVED=Object.freeze([
  {code:'6645',classification:'InnovationBoard',reason:'requires dated common-stock eligibility proof'},
  {code:'7740',classification:'InnovationBoard',reason:'requires dated common-stock eligibility proof'}
]);
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
function analyze(root,date){
  if(!/^20\d{6}$/.test(date||''))throw Error('INVALID_DATE');
  const files={},loaded={};
  for(const [key,template,rowsKey] of SOURCES){
    const p=template.replace('{date}',date),bytes=fs.readFileSync(path.join(root,p)),json=JSON.parse(bytes);
    if(json.target_date!==date)throw Error('INPUT_DATE_MISMATCH:'+key);
    const rows=rowsKey?json[rowsKey]:null;
    if(rowsKey&&(!Array.isArray(rows)||json.stock_count!==rows.length))
      throw Error('SOURCE_COUNT_MISMATCH:'+key);
    files[key]={path:p,sha256:sha(bytes),stock_count:json.stock_count??null,
      row_count:rows?.length??null,codes:rows?.map(x=>String(x.code))??null};
    loaded[key]=json;
  }
  const raw=loaded.raw,rawCodes=files.raw.codes;
  if(new Set(rawCodes).size!==rawCodes.length)throw Error('RAW_DUPLICATE_CODE');
  const alignment={};
  for(const key of ['news','facts','ai','published']){
    const codes=files[key].codes;
    const missing=rawCodes.filter(code=>!codes.includes(code));
    const unexpected=codes.filter(code=>!rawCodes.includes(code));
    const order_matches=JSON.stringify(codes)===JSON.stringify(rawCodes);
    alignment[key]={missing,unexpected,order_matches};
    if(missing.length||unexpected.length||!order_matches)throw Error('EXISTING_CHAIN_INCONSISTENT:'+key);
  }
  if(loaded.script.stock_count!==raw.stock_count)throw Error('SCRIPT_COUNT_MISMATCH');
  const script=loaded.script,scenes=script.scenes||[];
  const sceneImpact=scenes.map((scene,index)=>{
    const display=JSON.stringify(scene);
    return {scene:index+1,title:scene.title,
      explicit_excluded_stock_codes:(scene.stock_codes||[]).map(String).filter(x=>EXCLUDED.some(y=>y.code===x)),
      explicit_unresolved_codes:(scene.stock_codes||[]).map(String).filter(x=>UNRESOLVED.some(y=>y.code===x)),
      related_text_flag:/美德醫療|南染|三十五|35檔|生技醫療.{0,9}五檔|催化.{0,10}十三檔/.test(display)};
  }).filter(x=>x.explicit_excluded_stock_codes.length||x.explicit_unresolved_codes.length||x.related_text_flag);
  const summary=loaded.summary;
  if(summary.breadth?.stock_count!==raw.stock_count||summary.coverage?.raw_stock_count!==raw.stock_count)
    throw Error('SUMMARY_COUNT_MISMATCH');
  for(const [name,obj] of Object.entries(files))delete obj.codes;
  return {
    schema_version:1,target_date:date,read_only:true,
    input_files:files,current_alignment:alignment,
    original_stock_count:raw.stock_count,
    known_noncommon:EXCLUDED,ordinary_eligibility_unresolved:UNRESOLVED,
    explicit_stock_scope_verified:false,certified_date_matched_rebuild:false,
    affected_video_scenes:sceneImpact,
    dependent_stage_order:[
      {stage:'scope',action:'independent dated TWSE common-stock eligibility and innovation-board decision'},
      {stage:'raw',action:'rederive eligible >=5% candidate universe from authentic same-day price source'},
      {stage:'facts',action:'rebuild raw-dependent facts from same-day source receipts'},
      {stage:'news',action:'reconcile research-news analysis to new dated ordinary-stock universe'},
      {stage:'ai',action:'regenerate evidence-bound AI synthesis; do not preserve unsupported old claims'},
      {stage:'published',action:'rebuild verified unified analysis in exact raw-code order'},
      {stage:'summary',action:'run existing market-summary builder and validator against reconciled sources'},
      {stage:'script',action:'regenerate all affected scene narration, titles, counts, percentages and codes, then run strict script validator'},
      {stage:'render',action:'run original research-only Render workflow ONLY after all prior gates pass'},
    ],
    next_action:'Rebuild only in a separate research workspace; maintain original date and immutable source evidence',
    decision:'BLOCKED_SOURCE_RECONCILIATION_REQUIRED',
    publication_authorized:false
  };
}
if(require.main===module){
  try{
    const date=process.argv[2],root=process.argv[3]||process.cwd();
    process.stdout.write(JSON.stringify(analyze(root,date),null,2)+'\n');
  }catch(e){console.error(e.stack||e.message);process.exitCode=1;}
}
module.exports={analyze,SOURCES,EXCLUDED,UNRESOLVED};
