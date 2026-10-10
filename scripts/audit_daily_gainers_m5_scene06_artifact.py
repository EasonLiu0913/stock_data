#!/usr/bin/env python3
"""Independent offline integrity audit of existing M5 scene06 research Artifact; no TTS."""
import hashlib,json,re,subprocess,sys
from pathlib import Path
plan=json.loads(Path(sys.argv[1]).read_text(encoding="utf-8"))
root=Path(sys.argv[2]); proof=json.loads((root/"scene06-research-proof.json").read_text(encoding="utf-8"))
def digest(b):return hashlib.sha256(b).hexdigest()
def dur(p):
 v=subprocess.run(["ffprobe","-v","error","-show_entries","format=duration","-of","default=noprint_wrappers=1:nokey=1",str(p)],capture_output=True,text=True,check=True)
 return float(v.stdout.strip())
assert plan["target_date"]=="20261008" and plan["publication_authorized"] is False and len(plan["scenes"])==7
source=plan["scenes"][5]["speech_text"]; parts=re.findall(r"[^，、；。！？]+[，、；。！？]?",source)
assert len(parts)==7 and proof["research_only"] is True and proof["publication_authorized"] is False and proof["not_m5_media_proof"] is True
assert proof["source_exact_join"] is True and proof["source_sha256"]==digest(source.encode()) and proof["voice"]=="zh-TW-YunJheNeural" and proof["rate"]=="+15%"
assert len(proof["records"])==7 and not (root/"INCOMPLETE_NO_PROMOTION").exists()
counts=0; total=0
for i,(part,r) in enumerate(zip(parts,proof["records"]),1):
 assert r["index"]==i and r["text"]==part and r["text_sha256"]==digest(part.encode())
 assert r["file"]==f"chunk-{i:02d}.mp3" and r["attempts"] in (1,2,3)
 f=root/r["file"];assert f.is_file() and f.stat().st_size>1000 and digest(f.read_bytes())==r["audio_sha256"]
 actual=dur(f);assert actual>0 and abs(actual-r["duration_seconds"])<0.02
 words=r["word_boundaries"];assert len(words)>0
 for e in words:
  assert isinstance(e["text"],str) and e["text"] and isinstance(e["offset"],int) and isinstance(e["duration"],int) and e["offset"]>=0 and e["duration"]>0
 counts+=len(words);total+=actual
assert "".join(r["text"] for r in proof["records"])==source
joined=root/"scene06-research.mp3"
assert proof["scene06_audio"]==joined.name and joined.stat().st_size>1000 and digest(joined.read_bytes())==proof["scene06_sha256"]
actual=dur(joined);assert abs(actual-proof["stitched_duration_seconds"])<0.02 and actual>0
mapped=proof["mapped_word_boundaries"];assert len(mapped)==counts==30
assert all(mapped[i]["offset"]<=mapped[i+1]["offset"] for i in range(len(mapped)-1))
cursor=0;j=0
for r in proof["records"]:
 for e in r["word_boundaries"]:
  m=mapped[j];assert m["chunk"]==r["index"] and m["text"]==e["text"] and m["duration"]==e["duration"] and abs(m["offset"]-(e["offset"]+cursor))<=1
  j+=1
 cursor+=round(r["duration_seconds"]*10000000)
# This checks source, provenance, decode and arithmetic only; not perceptual seam or subtitle synchronization.
summary=dict(status="OFFLINE_INTEGRITY_PASS_NOT_SYNC_OR_MEDIA_PASS",original_run=38076491234,original_artifact=11679321432,source_exact_join=True,chunks=7,word_events=counts,stitched_duration_seconds=actual,sum_chunk_durations_seconds=total,publication_authorized=False,independent_sync_certified=False)
print(json.dumps(summary,ensure_ascii=False,indent=2))
