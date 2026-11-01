#!/usr/bin/env node
'use strict';
// RESEARCH ONLY: rewrite the previously unverified four middle scenes with
// independently source-checked dated numeric claims; no causation invented.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {build:buildBase}=require('./research_mvp10_full_editorial_storyboard');
const {verify}=require('./research_mvp10_multi_security_source_claims');
const {assertOpening}=require('./daily_gainers_brand_opening');
const {verifyPresentationDocument}=require('./daily_gainers_presentation_contract');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
function build(root,out){
 if(!root||!out||path.resolve(out)===path.resolve(root)||path.resolve(out).startsWith(path.resolve(root)+path.sep))
   throw Error('OUTPUT_MUST_BE_OUTSIDE_REPOSITORY');
 if(fs.existsSync(out))throw Error('OUTPUT_ALREADY_EXISTS');
 const initial=buildBase(root,out);
 const buf=fs.readFileSync(initial.path),j=JSON.parse(buf);
 if(j.target_date!=='20261008'||j.stock_count!==32||j.scenes?.length!==9||
    j.render_authorized!==false||j.publication_authorized!==false||
    JSON.stringify(j.remaining_legacy_prose_unverified_scenes)!=='[4,5,6,7]')
    throw Error('UNVERIFIED_INPUT_STORYBOARD_CHANGED');
 const codes=['6672','2305','1301','3416','2428'];
 const z=new Map(codes.map(code=>[code,verify(root,code)]));
 const raw=JSON.parse(fs.readFileSync(path.join(root,'data_daily_gain_over_5/20261008.json')));
 const byCode=new Map(raw.stocks.map(s=>[String(s.code),s]));
 for(const code of codes){
  const e=z.get(code),s=byCode.get(code);
  if(!s||e.code!==code||e.render_authorized!==false||e.target_date!==j.target_date||
     Number(s.close)!==e.official_close||!Number.isFinite(e.margin.delta)||
     e.external_news_catalyst_verified!==false)
     throw Error('ORIGINAL_SOURCE_NOT_VALID_FOR_NARRATION:'+code);
 }
 const lots=shares=>Math.round(shares/1000);
 const price=code=>byCode.get(code).close;
 const gain=code=>byCode.get(code).change_pct;
 const foreign=code=>lots(z.get(code).institutional.foreign.net_shares);
 const margin=code=>z.get(code).margin.delta;
 const trend=(n,up='買超',down='賣超')=>n>0?`${up}${n}張`:n<0?`${down}${Math.abs(n)}張`:'淨額0張';
 const fm=n=>n>0?`融資增加${n}張`:n<0?`融資減少${Math.abs(n)}張`:'融資餘額持平';
 const caution='這些數據不代表已確認新的訂單或公司利多，仍應以個別公司公告與後續交易日行情進一步查證。';
 const replacements={
  4:{
   title:'6672：同日價格與法人資金',
   subtitle:'基本數據已核對，題材因果未證實',
   stock_codes:['6672'],
   bullets:[`6672 收${price('6672')}元，漲${gain('6672')}%`,`外資${trend(foreign('6672'))}`,fm(margin('6672'))],
   narration:`先看代號6672，十月八日的同日行情記錄收盤${price('6672')}元，漲幅百分之${gain('6672')}。外資${trend(foreign('6672'))}，${fm(margin('6672'))}。價格上漲與法人方向值得合併觀察，但這不能單獨解釋上漲原因。${caution}`
  },
  5:{
   title:'2305：買盤與融資同時變化',
   subtitle:'不以股價推定營收成長的因果',
   stock_codes:['2305'],
   bullets:[`2305 收${price('2305')}元，漲${gain('2305')}%`,`外資${trend(foreign('2305'))}`,fm(margin('2305'))],
   narration:`接著看代號2305，十月八日收盤${price('2305')}元，漲幅百分之${gain('2305')}。獨立對照同日原始資料，外資${trend(foreign('2305'))}，${fm(margin('2305'))}。這代表當天外資買盤與融資餘額都增加，應留意後續波動與回吐風險。${caution}`
  },
  6:{
   title:'1301 台塑：資金方向與融資風險',
   subtitle:'法人淨額與融資餘額有同日來源',
   stock_codes:['1301'],
   bullets:[`台塑收${price('1301')}元，漲${gain('1301')}%`,`外資${trend(foreign('1301'))}`,fm(margin('1301'))],
   narration:`接著是台塑，代號1301。十月八日收在${price('1301')}元，漲幅百分之${gain('1301')}。當日外資${trend(foreign('1301'))}，${fm(margin('1301'))}。法人買盤和融資增加可能同時發生，但我們不能把一天的淨流入當作未來繼續上漲的保證。石化景氣和公司利差的說法仍需要公司財務與公告佐證。`
  },
  7:{
   title:'3416 與 2428：不同的籌碼方向',
   subtitle:'同日數字已核對，產業題材仍需追蹤',
   stock_codes:['3416','2428'],
   bullets:[`3416 收${price('3416')}元，外資${trend(foreign('3416'))}`,`2428 收${price('2428')}元，外資${trend(foreign('2428'))}`,'不同股票不能混為同一利多'],
   narration:`最後比較兩檔走勢。代號3416十月八日收${price('3416')}元，外資${trend(foreign('3416'))}，${fm(margin('3416'))}。另一檔代號2428收${price('2428')}元，外資${trend(foreign('2428'))}，${fm(margin('2428'))}。即使同一天都上漲，籌碼背景也未必一致。公司營收、產品漲價或個別訂單原因，仍需逐條核對正式公告，不能從價格變動直接推論。`
  }
 };
 for(const [id,replace] of Object.entries(replacements)){
  const scene=j.scenes[Number(id)-1];
  if(!scene||scene.source_provenance_review!=='LEGACY_PROSE_NEEDS_FULL_SOURCE_CLAIM_REVALIDATION')
   throw Error('UNEXPECTED_SCENE_PROVENANCE:'+id);
  Object.assign(scene,replace);
  scene.source_provenance_review='EXCHANGE_NUMERIC_SOURCE_CHECK_PASS_CAUSAL_NOT_VERIFIED';
 }
 j.remaining_legacy_prose_unverified_scenes=[];
 j.independent_numeric_original_source_verified_codes=['9919',...codes];
 j.independent_news_causality_verified=false;
 j.full_storyboard_numeric_claims_reconciled_for_replaced_scenes=true;
 j.eligible_stock_identity_verified=false;
 j.upstream_ai_semantic_reverified=false;
 j.market_summary_final=false;
 j.render_authorized=false;
 j.publication_authorized=false;
 j.decision='NUMERIC_RECONCILED_NINE_SCENE_RESEARCH_DRAFT_NOT_RENDERABLE';
 for(let i=0;i<j.scenes.length;i++){
  const s=j.scenes[i],content=JSON.stringify(s);
  if(s.narration.length<75||s.narration.length>1800||
     /美德醫療|南染|9103|三十五檔|35檔/.test(content))throw Error('SCENE_UNSAFE:'+i);
 }
 assertOpening(j.scenes[0].narration);
 verifyPresentationDocument({scenes:j.scenes});
 const n=j.scenes.reduce((sum,s)=>sum+[...s.narration].length,0);
 if(n<1100||n>5500)throw Error('STORYBOARD_TOTAL_LENGTH:'+n);
 j.narration_chars=n;
 const outFile=path.join(out,'stock-category-only','source-reconciled-full-nine-scene-research-draft.json');
 const bytes=Buffer.from(JSON.stringify(j,null,2)+'\n');
 fs.writeFileSync(outFile,bytes,{flag:'wx'});
 return {path:outFile,sha256:sha(bytes),scene_count:j.scenes.length,narration_chars:n,
  numeric_source_verified_codes:j.independent_numeric_original_source_verified_codes,
  final_analysis_verified:false,render_authorized:false,publication_authorized:false};
}
if(require.main===module){try{
 const [root,out]=process.argv.slice(2);
 if(!root||!out)throw Error('Usage: node scripts/research_mvp10_evidence_safe_nine_scene_script.js ROOT TEMP_OUT');
 console.log(JSON.stringify(build(root,out),null,2));
}catch(e){console.error(e.stack||e.message);process.exitCode=1}}
module.exports={build};
