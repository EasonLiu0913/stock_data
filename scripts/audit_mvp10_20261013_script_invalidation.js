#!/usr/bin/env node
'use strict';
// Research-only invalidation plan. Never edits narration/media or approves reuse.
const fs=require('node:fs');
const STALE_STOCK_COUNT=/(?:二十五|廿五|25)\s*檔/g;
function audit(script,originalRaw,provisionalManifest){
 if(script.target_date!=='20261013'||originalRaw.target_date!==script.target_date||
   script.stock_count!==originalRaw.stock_count||script.stock_count!==25||
   !Array.isArray(script.scenes)||script.scenes.length!==7)
   throw Error('ORIGINAL_SCRIPT_OR_SOURCE_IDENTITY_DRIFT');
 if(provisionalManifest.provisional_stock_count!==20||
    provisionalManifest.analysis_final_rebuilt!==false||
    provisionalManifest.render_authorized!==false||
    provisionalManifest.publication_authorized!==false)
   throw Error('UNVERIFIED_STAGING_MANIFEST');
 const excluded=new Set(provisionalManifest.excluded_original_codes.map(String));
 if(excluded.size!==5)throw Error('EXCLUSION_SCOPE_MISMATCH');
 const scenes=script.scenes.map((scene,i)=>{
  const fields={title:scene.title,subtitle:scene.subtitle,narration:scene.narration,
   bullets:(scene.bullets||[]).join('\n'),footer:scene.footer||''};
  const originalCountMentions=Object.entries(fields).flatMap(([field,v])=>
    [...String(v).matchAll(STALE_STOCK_COUNT)].map(m=>({field,phrase:m[0]})));
  const excludedSceneCodes=(scene.stock_codes||[]).map(String).filter(c=>excluded.has(c));
  // All scenes are invalid for reuse until re-reviewed against 20-stock summary;
  // changed first two scenes additionally contain explicit count references.
  return {scene:i+1,title:scene.title,original_count_mentions:originalCountMentions,
    excluded_scene_codes:excludedSceneCodes,
    source_scope_modified:true,original_editorial_approval_reusable:false,
    original_tts_reusable:false,original_srt_reusable:false,original_render_reusable:false,
    rewrite_required:originalCountMentions.length>0||
      excludedSceneCodes.length>0||i===0||i===1,
    editorial_revalidation_required:true};
 });
 const withCounts=scenes.filter(s=>s.original_count_mentions.length>0).map(s=>s.scene);
 return {target_date:'20261013',research_only:true,old_universe:25,
  new_provisional_universe:20,stale_stock_count_scenes:withCounts,
  excluded_original_codes:[...excluded].sort(),scenes,
  regenerated_script_exists:false,regenerated_tts_exists:false,
  regenerated_srt_exists:false,regenerated_full_mp4_exists:false,
  source_date_scope_certified:false,render_authorized:false,publication_authorized:false,
  decision:'ALL_SEVEN_SCENES_REQUIRE_REVIEW_AND_MEDIA_REGENERATION'};
}
if(require.main===module){
 const [src,original,stage,output]=process.argv.slice(2);
 if(!output)throw Error('Usage: audit_mvp10_20261013_script_invalidation.js SCRIPT RAW STAGE_MANIFEST OUT');
 const r=audit(JSON.parse(fs.readFileSync(src)),JSON.parse(fs.readFileSync(original)),
   JSON.parse(fs.readFileSync(stage)));
 fs.writeFileSync(output,JSON.stringify(r,null,2)+'\n',{flag:'wx'});
 console.log(JSON.stringify({stale_count_scenes:r.stale_stock_count_scenes,
    invalidate_all_original_media:r.scenes.every(x=>!x.original_render_reusable)}));
}
module.exports={audit};
