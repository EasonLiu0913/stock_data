#!/usr/bin/env python3
"""Offline WordBoundary diagnostic against final PCM scene ranges; no acoustic certification."""
import hashlib,json,sys
from pathlib import Path
plan=json.loads(Path(sys.argv[1]).read_text(encoding="utf-8")); a,b,c,d=map(Path,sys.argv[2:6]);out=Path(sys.argv[6]);out.parent.mkdir(parents=True,exist_ok=True)
def one(root,name):
 v=list(root.rglob(name));assert len(v)==1,(name,len(v));return v[0]
manifest=json.loads(one(a,"tts-manifest.json").read_text(encoding="utf-8"))
six=json.loads(one(b,"scene06-research-proof.json").read_text(encoding="utf-8"))
seven=json.loads(one(c,"scene07-research-proof.json").read_text(encoding="utf-8"))
pcm=json.loads(one(d,"pcm-caption-proof.json").read_text(encoding="utf-8"))
assert plan["target_date"]=="20261008" and plan["publication_authorized"] is False and len(plan["scenes"])==7
assert pcm["status"]=="PCM_SCENE_BOUNDARY_REVIEW_NOT_INDEPENDENT_SPEECH_SYNC" and pcm["scene_count"]==7 and pcm["delta_samples"]==0
assert manifest["voice"]==six["voice"]==seven["voice"]=="zh-TW-YunJheNeural" and manifest["rate"]==six["rate"]==seven["rate"]=="+15%"
assert six["source_sha256"]==hashlib.sha256(plan["scenes"][5]["speech_text"].encode()).hexdigest() and seven["source_sha256"]==hashlib.sha256(plan["scenes"][6]["speech_text"].encode()).hexdigest()
rows=[];issues=[]
for i in range(1,8):
 scene=plan["scenes"][i-1];rg=pcm["scene_ranges"][i-1]
 assert rg["scene"]==i
 if i<=5:
  m=manifest["scenes"][i-1];assert m["id"]==i and m["spoken_text"]==scene["speech_text"]
  ev=m["word_boundaries"];source="original_scene"
 elif i==6:
  assert "".join(x["text"] for x in six["records"])==scene["speech_text"]
  ev=six["mapped_word_boundaries"];source="seven_chunk_mapped_estimate"
 else:
  assert seven["mode"]=="whole" and seven["whole"]["text"]==scene["speech_text"]
  ev=seven["whole"]["word_boundaries"];source="original_whole"
 assert ev
 prev=-1
 for j,x in enumerate(ev,1):
  off=int(x["offset"]);length=int(x["duration"])
  assert off>=0 and length>0 and off>=prev;prev=off
  start=rg["start_sample"]+round(off*48000/10000000);end=start+round(length*48000/10000000)
  if start<rg["start_sample"] or end>rg["end_sample"]+2400:issues.append(dict(scene=i,event=j,issue="boundary_outside_scene_plus_50ms",overflow_samples=end-rg["end_sample"]))
  rows.append(dict(scene=i,event=j,text=x["text"],start_seconds=round(start/48000,6),end_seconds=round(end/48000,6),source=source))
result=dict(status="WORDBOUNDARY_CONTENT_TIMELINE_DIAGNOSTIC_NOT_ACOUSTIC_SYNC_PASS",scene_count=7,event_count=len(rows),source_exact=True,word_boundaries=rows,issues=issues,final_pcm_seconds=pcm["duration_seconds"],wordboundary_is_service_metadata_not_independent_audio_alignment=True,punctuation_and_numeral_coverage_not_certified=True,scene06_join_offsets_estimated=True,publication_authorized=False,subtitle_sync_certified=False,media_proof=False)
out.write_text(json.dumps(result,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
print(json.dumps(dict(status=result["status"],event_count=len(rows),issues=len(issues),publication_authorized=False),ensure_ascii=False))
if issues:raise RuntimeError("WORDBOUNDARY_SCENE_RANGE_ISSUES_NO_PROMOTION")
