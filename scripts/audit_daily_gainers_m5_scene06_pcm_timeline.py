#!/usr/bin/env python3
"""Research-only sample-count timeline audit of retained scene06 files; no TTS or media promotion."""
import hashlib,json,re,subprocess,sys
from pathlib import Path
p=json.loads(Path(sys.argv[1]).read_text(encoding="utf-8")); root=Path(sys.argv[2])
e=json.loads((root/"scene06-research-proof.json").read_text(encoding="utf-8"))
assert p["target_date"]=="20261008" and p["publication_authorized"] is False and len(p["scenes"])==7
s=p["scenes"][5]["speech_text"]; r=e["records"]
assert e["research_only"] and e["not_m5_media_proof"] and e["publication_authorized"] is False
assert e["source_sha256"]==hashlib.sha256(s.encode()).hexdigest() and "".join(x["text"] for x in r)==s and len(r)==7
RATE=24000
def decode(file):
 v=subprocess.run(["ffmpeg","-hide_banner","-loglevel","error","-i",str(file),"-map","0:a:0","-f","s16le","-acodec","pcm_s16le","-ac","1","-ar",str(RATE),"-"],stdout=subprocess.PIPE,stderr=subprocess.PIPE,check=True)
 assert len(v.stdout)>0 and len(v.stdout)%2==0
 return v.stdout
counts=[];cursor=0;adjusted=[];drift=[]
for i,x in enumerate(r,1):
 f=root/f"chunk-{i:02d}.mp3"
 assert x["index"]==i and x["file"]==f.name and hashlib.sha256(f.read_bytes()).hexdigest()==x["audio_sha256"]
 pcm=decode(f);n=len(pcm)//2;assert n>0
 counts.append(n)
 for b in x["word_boundaries"]:
  assert b["offset"]>=0 and b["duration"]>0
  sample_start=cursor+round(b["offset"]*RATE/10000000)
  adjusted.append(dict(chunk=i,text=b["text"],sample_start=sample_start,start_seconds=round(sample_start/RATE,6),duration_seconds=round(b["duration"]/10000000,6)))
 cursor+=n
joined=root/"scene06-research.mp3"
assert hashlib.sha256(joined.read_bytes()).hexdigest()==e["scene06_sha256"]
joined_n=len(decode(joined))//2
assert len(adjusted)==len(e["mapped_word_boundaries"])==30
for a,b in zip(adjusted,e["mapped_word_boundaries"]):
 assert a["chunk"]==b["chunk"] and a["text"]==b["text"]
 drift.append(round((a["start_seconds"]-b["offset"]/10000000)*1000,3))
result=dict(status="PCM_SAMPLE_TIMELINE_MEASURED_NOT_SYNC_CERTIFIED",source_run=38076491234,source_artifact=11679321432,sample_rate=RATE,chunk_samples=counts,chunk_sum_samples=sum(counts),joined_samples=joined_n,chunk_sum_seconds=round(sum(counts)/RATE,6),joined_seconds=round(joined_n/RATE,6),joined_minus_chunks_ms=round((joined_n-sum(counts))/RATE*1000,3),boundary_count=len(adjusted),old_ffprobe_offset_vs_pcm_ms=dict(min=min(drift),max=max(drift)),sample_based_boundaries=adjusted,publication_authorized=False,independent_sync_certified=False,media_proof=False)
print(json.dumps(result,ensure_ascii=False,indent=2))
