'use strict';
const fs=require('node:fs'),path=require('node:path');
const BASE=path.resolve(__dirname,'..'),DATE='20261008';
function readCSV(file){const text=fs.readFileSync(path.join(BASE,'data_twse',file),'utf8').trim().split(/\r?\n/);if(text[0]!=='Code,Name,Industry')throw Error('INVALID_CLASSIFICATION_SCHEMA:'+file);const map=new Map();for(const line of text.slice(1)){const [code,name,...industry]=line.split(',');if(!code||!name||map.has(code))throw Error('INVALID_CLASSIFICATION_ENTRY:'+file+':'+code);map.set(code,{name,industry:industry.join(',')});}return map;}
function decimal(s){if(typeof s!=='string'&&typeof s!=='number')return NaN;const v=Number(String(s).replace(/,/g,''));return Number.isFinite(v)?v:NaN;}
function audit(input,classification){
 if(input?.date!==DATE||input?.stat!=='OK')throw Error('SOURCE_DATE_OR_STATUS');
 const table=input.tables?.find(t=>t.title?.includes('每日收盤行情(全部)'));
 if(!table||!Array.isArray(table.data)||!Array.isArray(table.fields)||table.fields[0]!=='證券代號'||table.fields[8]!=='收盤價')throw Error('INVALID_MI_INDEX_SCHEMA');
 const buckets=['Stock','InnovationBoard','ETF','TDR','ETN','PreferredStock','Warrants'];
 const sets=buckets.map(k=>[k,classification[k]||new Map()]);
 const seen=new Set(), candidates=[],unknown=[],exceptions=[];
 let fourDigitRows=0;
 for(const r of table.data){
  const code=String(r?.[0]||'').trim();if(!/^\d{4}$/.test(code))continue;
  fourDigitRows++;if(seen.has(code))throw Error('DUPLICATE_QUOTE:'+code);seen.add(code);
  const groups=sets.filter(([,m])=>m.has(code)).map(([k])=>k);
  if(groups.length>1)throw Error('CONFLICTING_CLASSIFICATION:'+code);
  const category=groups[0]||'UNKNOWN',close=decimal(r[8]),delta=decimal(r[10]);
  const sign=String(r[9]||'').includes('+')?1:String(r[9]||'').includes('-')?-1:0;
  const previous=close-sign*delta;
  if(!(close>0&&previous>0&&delta>=0)){exceptions.push({code,reason:'NON_POSITIVE_OR_INVALID_PRICE'});continue;}
  const gain=100*sign*delta/previous;
  if(!Number.isFinite(gain)||gain<5)continue;
  const item={code,name:r[1],category,gain_percent:Number(gain.toFixed(5)),turnover_twd:decimal(r[4]),classification_asof_verified:false,strict_five_percent_verified:false,featured_eligible:false};
  if(category==='UNKNOWN')unknown.push(item);
  candidates.push(item);
 }
 candidates.sort((a,b)=>b.turnover_twd-a.turnover_twd||a.code.localeCompare(b.code));
 const countByCategory=Object.fromEntries([...new Set([...buckets,'UNKNOWN'])].map(k=>[k,candidates.filter(c=>c.category===k).length]));
 return {date:DATE,phase:'M2-v2',goal_version:'goal-v3',status:'partial',scope:'OBSERVED_FOUR_DIGIT_PRICE_MOVERS_NOT_CERTIFIED_COMMON_STOCK',publication_authorized:false,source_status:'dated MI_INDEX with undated current classification CSV',four_digit_rows:fourDigitRows,candidate_count:candidates.length,count_by_category:countByCategory,candidates,unknown,exceptions_count:exceptions.length,materiality:{method:'All candidate exceptions and category discrepancies must be reviewed; no invented numeric completeness threshold',external_recall_comparison:'NOT_AVAILABLE',high_turnover_candidates:candidates.slice(0,10).map(c=>c.code),unresolved:true},quality:{date_effective_security_identity:false,disposition_suspension_verified:false,original_strict_per_security_gate_executed:false,full_universe_completeness_claim:false},prompt_a_complete:false,prompt_b_eligible:false};
}
function main(){const input=JSON.parse(fs.readFileSync(path.join(BASE,'data_twse_mi_index',DATE+'_twse_mi_index.json'),'utf8'));const classification=Object.fromEntries(['Stock','InnovationBoard','ETF','TDR','ETN','PreferredStock','Warrants'].map(k=>[k,readCSV('twse_industry_'+k+'.csv')]));console.log(JSON.stringify(audit(input,classification),null,2));}
if(require.main===module){try{main()}catch(e){console.error(e);process.exitCode=1;}}
module.exports={audit,readCSV};
