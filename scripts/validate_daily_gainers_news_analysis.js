'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { DAILY_GAINERS_AI_CONTRACT: CONTRACT, isLatestNews } = require('./lib/daily_gainers_ai_contract');
const ROOT = path.resolve(__dirname, '..');
const BASE = path.join(ROOT, 'data_daily_gain_over_5');
function assert(c,m){if(!c)throw new Error(`Invalid daily gainers news analysis: ${m}`)}
function text(v){return typeof v==='string'&&v.trim().length>0}
function http(v){try{const u=new URL(String(v||''));return ['http:','https:'].includes(u.protocol)}catch{return false}}
function main(){
  const date=process.argv[2];
  const file=path.resolve(ROOT,process.argv[3]||`data_daily_gain_over_5/analysis-news/${date}.json`);
  assert(/^20\d{6}$/.test(String(date||'')),'date must be YYYYMMDD');
  const rawFile=path.join(BASE,`${date}.json`); assert(fs.existsSync(rawFile),`missing raw ${date}`); assert(fs.existsSync(file),`missing ${path.relative(ROOT,file)}`);
  const raw=JSON.parse(fs.readFileSync(rawFile,'utf8')), p=JSON.parse(fs.readFileSync(file,'utf8'));
  assert(isLatestNews(p),'payload is not latest news contract');
  assert(p.target_date===date,'target_date mismatch');
  assert(p.source_list_file===`data_daily_gain_over_5/${date}.json`,'source_list_file mismatch');
  const rows=Array.isArray(raw.stocks)?raw.stocks:[], analyses=Array.isArray(p.analyses)?p.analyses:[];
  assert(Number.isInteger(p.stock_count)&&p.stock_count===rows.length&&analyses.length===rows.length,'stock_count/analyses mismatch');
  const rawCodes=rows.map(x=>String(x.code)), codes=analyses.map(x=>String(x.code)); assert(JSON.stringify(rawCodes)===JSON.stringify(codes),'stock order must exactly match raw list');
  const cause=new Set(CONTRACT.cause_types), ev=new Set(CONTRACT.evidence_strength_values), conf=new Set(CONTRACT.confidence_values), tag=/^[a-z0-9]+(?:_[a-z0-9]+)*$/;
  for(let i=0;i<analyses.length;i++){
    const a=analyses[i], r=rows[i]; for(const f of CONTRACT.news.required_analysis_fields)assert(Object.prototype.hasOwnProperty.call(a,f),`missing ${f} for ${a.code||r.code}`);
    assert(String(a.code)===String(r.code),'code mismatch'); assert(text(a.name),'name required'); assert(Number(a.change_pct)===Number(r.change_pct),'change_pct mismatch'); assert(cause.has(a.cause_type),`bad cause_type ${a.code}`);
    assert(Array.isArray(a.cause_tags)&&a.cause_tags.every(x=>text(x)&&tag.test(x))&&new Set(a.cause_tags).size===a.cause_tags.length,`bad cause_tags ${a.code}`);
    assert(ev.has(a.evidence_strength),`bad evidence_strength ${a.code}`); assert(text(a.reason_summary),`reason_summary required ${a.code}`); assert(Array.isArray(a.evidence)&&a.evidence.every(text),`evidence invalid ${a.code}`); assert(conf.has(a.confidence),`confidence invalid ${a.code}`); assert(Array.isArray(a.follow_up)&&a.follow_up.every(text),`follow_up invalid ${a.code}`); assert(Array.isArray(a.sources),`sources invalid ${a.code}`);
    for(const s of a.sources){assert(s&&typeof s==='object'&&text(s.title)&&http(s.url),`source invalid ${a.code}`); if(s.published_at!=null&&s.published_at!=='')assert(!Number.isNaN(Date.parse(s.published_at)),`published_at invalid ${a.code}`)}
    if(['direct','corroborated'].includes(a.evidence_strength))assert(a.sources.length>0,`${a.evidence_strength} requires source ${a.code}`); if(['unknown','low_liquidity'].includes(a.cause_type))assert(a.confidence==='low',`${a.cause_type} requires low confidence ${a.code}`);
  }
  console.log(JSON.stringify({valid:true,date,stock_count:rows.length,methodology:p.methodology_version},null,2));
}
try{main()}catch(e){console.error(e.stack||e.message);process.exit(1)}
