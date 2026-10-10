#!/usr/bin/env python3
"""Research only: independently reconcile immutable genuine audio from three M5 runs."""
import hashlib,json,subprocess,sys
from pathlib import Path
plan=json.loads(Path(sys.argv[1]).read_text(encoding="utf-8"));a,b,c=map(Path,sys.argv[2:5]);out=Path(sys.argv[5]);out.parent.mkdir(parents=True,exist_ok=True)
assert plan["target_date"]=="20261008" and plan["publication_authorized"] is False and len(plan["scenes"])==7
def sha(f):return hashlib.sha256(f.read_bytes()).hexdigest()
def duration(f):
 p=subprocess.run(["ffprobe","-v","error","-show_entries","format=duration","-of","default=noprint_wrappers=1:nokey=1",str(f)],capture_output=True,text=True,check=True)
 v=float(p.stdout.strip());assert v>0;return v
def unique(root,name):
 matches=list(root.rglob(name));assert len(matches)==1,(name,[str(x) for x in matches]);return matches[0]
manifest=json.loads(unique(a,"tts-manifest.json").read_text(encoding="utf-8"))
assert manifest["voice"]=="zh-TW-YunJheNeural" and manifest["rate"]=="+15%" and manifest["engine"]=="edge-tts" and len(manifest["scenes"])==5
records=[]
for i in range(1,6):
 m=manifest["scenes"][i-1];f=unique(a,f"{i:02}.mp3")
 assert m["id"]==i and m["spoken_text"]==plan["scenes"][i-1]["speech_text"] and m["engine"]=="edge-tts" and m["word_boundaries"]
 records.append(dict(id=i,source_run=38062405623,source_artifact=11674007334,file=f.name,sha256=sha(f),duration_seconds=duration(f),word_boundaries=len(m["word_boundaries"]),source_exact=True))
e=json.loads(unique(b,"scene06-research-proof.json").read_text(encoding="utf-8"));f=unique(b,"scene06-research.mp3")
assert e["research_only"] and e["not_m5_media_proof"] and e["publication_authorized"] is False
assert e["source_sha256"]==hashlib.sha256(plan["scenes"][5]["speech_text"].encode()).hexdigest() and "".join(x["text"] for x in e["records"])==plan["scenes"][5]["speech_text"] and len(e["records"])==7 and e["scene06_sha256"]==sha(f)
records.append(dict(id=6,source_run=38076491234,source_artifact=11679321432,file=f.name,sha256=sha(f),duration_seconds=duration(f),word_boundaries=len(e["mapped_word_boundaries"]),source_exact=True,chunk_stitch_research=True))
g=json.loads(unique(c,"scene07-research-proof.json").read_text(encoding="utf-8"));f=unique(c,"scene07-whole.mp3")
assert g["research_only"] and g["not_m5_media_proof"] and g["publication_authorized"] is False and g["mode"]=="whole" and g["source_exact_join"] is True and "word_boundaries" in g["whole"]
assert g["source_sha256"]==hashlib.sha256(plan["scenes"][6]["speech_text"].encode()).hexdigest() and g["whole"]["text"]==plan["scenes"][6]["speech_text"] and g["whole"]["audio_sha256"]==sha(f)
records.append(dict(id=7,source_run=38078900356,source_artifact=11680095542,file=f.name,sha256=sha(f),duration_seconds=duration(f),word_boundaries=len(g["whole"]["word_boundaries"]),source_exact=True,whole_original=True))
total=sum(x["duration_seconds"] for x in records)
result=dict(status="SEVEN_SOURCE_RECONCILED_RESEARCH_ONLY",target_date="20261008",source_runs=[38062405623,38076491234,38078900356],voice="zh-TW-YunJheNeural",rate="+15%",scenes=records,scene_count=7,measured_sum_seconds=round(total,6),duration_target_met=60<=total<=90,publication_authorized=False,seven_scene_render_verified=False,subtitle_sync_certified=False,media_proof=False)
out.write_text(json.dumps(result,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
print(json.dumps(dict(status=result["status"],duration_seconds=result["measured_sum_seconds"],duration_target_met=result["duration_target_met"],scene_count=7,publication_authorized=False),ensure_ascii=False))
if not result["duration_target_met"]:raise RuntimeError("M5_REAL_SEVEN_SOURCE_TTS_DURATION_OUTSIDE_60_90_NO_PROMOTION")
