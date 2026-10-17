#!/usr/bin/env python3
"""Research-only V3 visual timing manifest; does not certify M8VIS rendering."""
import json,pathlib,sys,hashlib
root=pathlib.Path(sys.argv[1])
bridge=json.loads((root/"media-bridge.json").read_text())
caption=json.loads((root/"research-caption-proof.json").read_text())
assert bridge["contract"]=="AI_V3_SENTENCE_MEDIA_BRIDGE_RESEARCH_ONLY"
assert caption["contract"]=="AI_V3_RESEARCH_SENTENCE_SRT_ONLY"
assert bridge["research_master_sha256"]==caption["research_master_sha256"]
assert bridge["publication_authorized"] is False and bridge["render_authorized"] is False
rows=bridge["sentences"]
assert len(rows)>0 and len(rows)==caption["sentence_count"]
scenes=[]
for row in rows:
 if not scenes or scenes[-1]["id"]!=row["scene"]:
  scenes.append({"id":row["scene"],"start_seconds":row["start_seconds"],"end_seconds":row["end_seconds"],"claim_ids":row["claim_ids"],"card_claim_ids":row["card_claim_ids"]})
 else:
  scene=scenes[-1]
  assert scene["claim_ids"]==row["claim_ids"] and scene["card_claim_ids"]==row["card_claim_ids"]
  scene["end_seconds"]=row["end_seconds"]
assert [x["id"] for x in scenes]==["opening","market","6672","2305","1301","conclusion"]
assert all(x["claim_ids"]==x["card_claim_ids"] for x in scenes)
assert all(a["end_seconds"]<=b["start_seconds"] for a,b in zip(scenes,scenes[1:]))
assert scenes[-1]["end_seconds"]==bridge["total_seconds"]==caption["total_seconds"]
manifest={"contract":"AI_V3_M8VIS_TIMING_HANDOFF_RESEARCH_ONLY","target_date":"20261008","research_master_sha256":bridge["research_master_sha256"],"caption_srt_sha256":caption["srt_sha256"],"total_seconds":bridge["total_seconds"],"scenes":scenes,"visual_assets_verified":False,"vtuber_verified":False,"occlusion_verified":False,"mp4_generated":False,"render_authorized":False,"publication_authorized":False}
(root/"m8vis-timing-handoff.json").write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+"\n")
print(f"V3_M8VIS_TIMING_HANDOFF_PASS scenes={len(scenes)} sentences={len(rows)} visual_render=false no_publish=true")
