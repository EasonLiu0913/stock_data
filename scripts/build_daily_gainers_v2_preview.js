#!/usr/bin/env node
'use strict';
// Side-effect-free v2 contract preview. Does not render, dispatch or upload video.
// Uses typed semantic Master, verified stock raw data and current visual metadata.
const fs=require('node:fs');
const path=require('node:path');
const {buildVariants}=require('./daily_gainers_text_variants');

function preview(date, root=process.cwd()) {
  if(!/^20\d{6}$/.test(date)) throw new Error('Invalid date');
  const masterPath=path.join(root,'video_scripts/daily-gainers/v2',date,'master.json');
  const rawPath=path.join(root,'data_daily_gain_over_5',date+'.json');
  const visualPath=path.join(root,'video_scripts/daily-gainers',date+'.json');
  const rulesPath=path.join(root,'video_scripts/daily-gainers/rules/text-presentation.v1.json');
  const load=p=>JSON.parse(fs.readFileSync(p,'utf8'));
  const [master,raw,visual,rules]=[masterPath,rawPath,visualPath,rulesPath].map(load);
  if(visual.target_date!==date || master.target_date!==date) throw new Error('Visual/master date mismatch');
  if(!Array.isArray(visual.scenes) || visual.scenes.length!==master.scenes.length)
    throw new Error('Visual/master scene count mismatch');
  if(visual.stock_count!==raw.stock_count) throw new Error('Visual/raw stock count mismatch');
  const variants=buildVariants(master,raw,rules);
  const stockNames=new Map(raw.stocks.map(row=>[String(row.code),String(row.name)]));
  const scenes=visual.scenes.map((v,i)=>{
    const cues=variants.cue_pairs[i].caption_cues;
    const speech=cues.map(c=>c.speech).join('');
    const captions=cues.map(c=>c.caption).join('');
    if(speech!==variants.speech[i].text || captions!==variants.captions[i].text)
      throw new Error('Caption/speech equivalence failed for scene '+(i+1));
    const stock_labels=(v.stock_codes||[]).map(code=>{
      const name=stockNames.get(String(code));
      if(!name) throw new Error('Unverified scene stock code '+code);
      return name+'（'+code+'）';
    });
    const title=(date==='20261008' && i===2 && v.title==='南染與防疫概念')
      ? '美德醫療-DR（9103）與防疫概念' : v.title;
    return {
      id:i+1,title,subtitle:v.subtitle,bullets:v.bullets,stock_labels,
      footer:v.footer||'',stock_codes:v.stock_codes||[],
      // Legacy narration is a compatibility field for downstream QA only.
      narration:speech,speech_text:speech,caption_text:captions,caption_cues:cues
    };
  });
  const plan={
    schema_version:2,methodology_version:'daily-gainers-video-v2-text-variants',
    target_date:date,scene_count:scenes.length,
    narration_chars:scenes.reduce((n,s)=>n+[...s.speech_text].length,0),
    text_variant_manifest:variants.manifest,scenes
  };
  const out=path.join(root,'output/daily-gainers-v2-preview',date);
  fs.mkdirSync(out,{recursive:true});
  for(const name of ['display','captions','speech','cue_pairs','manifest'])
    fs.writeFileSync(path.join(out,name+'.json'),JSON.stringify(variants[name],null,2)+'\n');
  fs.writeFileSync(path.join(out,'plan.json'),JSON.stringify(plan,null,2)+'\n');
  return {output:out,plan,manifest:variants.manifest};
}
if(require.main===module){
  const result=preview(process.argv[2]);
  console.log(JSON.stringify({date:result.plan.target_date,scenes:result.plan.scene_count,
    output:result.output,source_sha256:result.manifest.source_sha256,upload:false,status:'PREVIEW_ONLY_PASS'}));
}
module.exports={preview};
