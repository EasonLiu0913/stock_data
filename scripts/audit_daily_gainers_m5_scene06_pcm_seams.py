#!/usr/bin/env python3
"""Research-only PCM equivalence and seam metrics for retained scene06; never certifies audible quality."""
import hashlib,json,math,struct,subprocess,sys
from pathlib import Path
p=json.loads(Path(sys.argv[1]).read_text(encoding="utf-8")); root=Path(sys.argv[2]); e=json.loads((root/"scene06-research-proof.json").read_text(encoding="utf-8"))
assert p["target_date"]=="20261008" and p["publication_authorized"] is False and len(p["scenes"])==7 and e["research_only"] and e["not_m5_media_proof"] and e["publication_authorized"] is False
assert e["source_sha256"]==hashlib.sha256(p["scenes"][5]["speech_text"].encode()).hexdigest() and "".join(x["text"] for x in e["records"])==p["scenes"][5]["speech_text"]
RATE=24000
def pcm(file):
 q=subprocess.run(["ffmpeg","-hide_banner","-loglevel","error","-i",str(file),"-map","0:a:0","-f","s16le","-acodec","pcm_s16le","-ac","1","-ar",str(RATE),"-"],capture_output=True,check=True).stdout
 assert q and len(q)%2==0
 return struct.unpack("<"+str(len(q)//2)+"h",q)
chunks=[]
for i,r in enumerate(e["records"],1):
 f=root/f"chunk-{i:02d}.mp3";assert r["index"]==i and r["file"]==f.name and hashlib.sha256(f.read_bytes()).hexdigest()==r["audio_sha256"]
 chunks.append(pcm(f))
f=root/"scene06-research.mp3";assert hashlib.sha256(f.read_bytes()).hexdigest()==e["scene06_sha256"]
joined=pcm(f);source=[v for chunk in chunks for v in chunk]
assert len(source)==len(joined)==394560
diff=[a-b for a,b in zip(source,joined)]
mae=sum(abs(v) for v in diff)/len(diff)
rmse=math.sqrt(sum(v*v for v in diff)/len(diff))
boundaries=[];cursor=0;W=round(RATE*.02)
for i,chunk in enumerate(chunks[:-1],1):
 cursor+=len(chunk)
 a=source[cursor-1]; b=source[cursor]; j0=joined[cursor-1];j1=joined[cursor]
 boundaries.append(dict(after_chunk=i,sample=cursor,source_discontinuity=abs(b-a),joined_discontinuity=abs(j1-j0),source_left_right_20ms_rms=[round(math.sqrt(sum(x*x for x in source[cursor-W:cursor])/W),3),round(math.sqrt(sum(x*x for x in source[cursor:cursor+W])/W),3)]))
out=dict(status="PCM_SEAM_DIAGNOSTIC_NOT_AUDIBLE_OR_SYNC_PASS",source_run=38076491234,source_artifact=11679321432,sample_rate=RATE,source_samples=len(source),joined_samples=len(joined),absolute_pcm_equal=source==list(joined),difference_mae=round(mae,5),difference_rmse=round(rmse,5),seams=boundaries,publication_authorized=False,perceptual_seam_certified=False,speech_text_listening_certified=False,subtitle_sync_certified=False,media_proof=False)
print(json.dumps(out,ensure_ascii=False,indent=2))
