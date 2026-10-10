'use strict';
const {build}=require('./build_daily_gainers_m3_regime_assertions');
const {createDraft,validate}=require('./build_daily_gainers_m4_spoken_draft');
function audit(d=createDraft(),l=build()){
 validate(d,l);
 const e=Object.fromEntries(l.evidence.map(x=>[x.id,x]));
 const scenes=Object.fromEntries(d.scenes.map(x=>[x.id,x]));
 const required={
 market:['index','breadth'],turnover:['turnover'],institutions:['institutional'],caution:['sector','gainers']
 };
 for(const [id,refs] of Object.entries(required)){
  const s=scenes[id];if(!s||JSON.stringify(s.evidence_ids)!==JSON.stringify(refs))throw Error('M4_LINE_EVIDENCE_DRIFT:'+id);
  if(refs.some(k=>e[k].date!==d.date||!s.source_refs.includes(e[k].source)))throw Error('M4_LINE_SOURCE_MISMATCH:'+id);
 }
 const b=e.breadth.value,i=e.institutional.value;
 if(e.index.value!==-492.93||b.advance!==425||b.decline!==540||b.unchanged!==109||b.no_trade!==3||b.no_comparison!==5)throw Error('M4_MARKET_NUMBER_MISMATCH');
 if(e.turnover.value!==924509097873||i.total.net_twd!==-91574625081||i.groups.foreign.net_twd>=0||i.groups.trust.net_twd<=0||i.groups.dealers.net_twd>=0)throw Error('M4_FINANCE_NUMBER_MISMATCH');
 if(!scenes.market.spoken.includes('四百九十二點九三')||!scenes.turnover.spoken.includes('九千二百四十五')||!scenes.institutions.spoken.includes('九百一十六'))throw Error('M4_SPOKEN_AMOUNT_MISMATCH');
 const counts=d.scenes.map(x=>({id:x.id,role:x.role,characters:[...x.spoken].length}));
 const total=counts.reduce((n,x)=>n+x.characters,0);
 return {date:d.date,source_verified:true,scene_count:d.scenes.length,spoken_characters:total,by_role:{anchor:counts.filter(x=>x.role==='anchor').reduce((n,x)=>n+x.characters,0),analyst:counts.filter(x=>x.role==='analyst').reduce((n,x)=>n+x.characters,0)},note:'Character counts are editorial feasibility only; NOT measured TTS duration or a verified 70/30 delivery ratio',publication_authorized:false,actual_tts_duration_seconds:null};
}
if(require.main===module)console.log(JSON.stringify(audit(),null,2));
module.exports={audit};
