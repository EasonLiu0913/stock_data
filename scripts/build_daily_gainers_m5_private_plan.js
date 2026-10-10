'use strict';
const fs=require('node:fs');
const path=require('node:path');
const {createDraft,validate}=require('./build_daily_gainers_m4_spoken_draft');
const date='20261008';
function build(root=process.cwd()){
 const d=createDraft();validate(d);
 if(d.date!==date||d.publication_authorized!==false)throw Error('M5_SOURCE_DATE_OR_RELEASE_DRIFT');
 const scenes=d.scenes.map((s,i)=>({
  id:i+1,title:s.id,role:s.role,speech_text:s.spoken,
  caption_text:s.srt_text,display_text:s.display_text,
  caption_cues:[{speech:s.spoken,caption:s.srt_text}],
  evidence_ids:s.evidence_ids,source_refs:s.source_refs
 }));
 const plan={schema_version:2,target_date:date,contract:'M5-PRIVATE-TTS-VIDEO-PREVIEW-v2',
  source_contract:d.contract,publication_authorized:false,scene_count:7,scenes};
 const dir=path.join(root,'output','m5-private-preview',date);
 fs.mkdirSync(dir,{recursive:true});
 fs.writeFileSync(path.join(dir,'plan.json'),JSON.stringify(plan,null,2)+'\n');
 return {dir,plan};
}
if(require.main===module)console.log(JSON.stringify(build().plan,null,2));
module.exports={build};
