#!/usr/bin/env python3
"""Produce inspectable research-only scene06 audio, punctuation SRT, and reviewer notes from saved Artifact."""
import hashlib,json,re,shutil,subprocess,sys
from pathlib import Path
plan=json.loads(Path(sys.argv[1]).read_text(encoding="utf-8")); origin=Path(sys.argv[2]); out=Path(sys.argv[3]);out.mkdir(parents=True,exist_ok=True)
e=json.loads((origin/"scene06-research-proof.json").read_text(encoding="utf-8"))
assert plan["target_date"]=="20261008" and plan["publication_authorized"] is False and len(plan["scenes"])==7
source=plan["scenes"][5]["speech_text"]; r=e["records"]
assert e["research_only"] is True and e["not_m5_media_proof"] is True and e["publication_authorized"] is False
assert e["source_sha256"]==hashlib.sha256(source.encode()).hexdigest() and len(r)==7 and "".join(x["text"] for x in r)==source
assert [x["text"] for x in r]==re.findall(r"[^，、；。！？]+[，、；。！？]?",source)
rate=24000
def pcm_count(f):
 v=subprocess.run(["ffmpeg","-hide_banner","-loglevel","error","-i",str(f),"-map","0:a:0","-f","s16le","-ac","1","-ar",str(rate),"-"],capture_output=True,check=True).stdout
 assert v and len(v)%2==0
 return len(v)//2
samples=[]
for i,x in enumerate(r,1):
 f=origin/f"chunk-{i:02d}.mp3"
 assert x["index"]==i and x["file"]==f.name and hashlib.sha256(f.read_bytes()).hexdigest()==x["audio_sha256"]
 assert x["word_boundaries"]
 samples.append(pcm_count(f))
joined=origin/"scene06-research.mp3"
assert hashlib.sha256(joined.read_bytes()).hexdigest()==e["scene06_sha256"]
assert pcm_count(joined)==sum(samples)
def tc(t):
 ms=round(1000*t/rate);h,ms=divmod(ms,3600000);m,ms=divmod(ms,60000);s,ms=divmod(ms,1000)
 return f"{h:02}:{m:02}:{s:02},{ms:03}"
srt=[];cursor=0;segments=[]
for i,(n,x) in enumerate(zip(samples,r),1):
 srt.append(f"{i}\n{tc(cursor)} --> {tc(cursor+n)}\n{x['text']}\n")
 segments.append(dict(index=i,text=x["text"],start_sample=cursor,end_sample=cursor+n,estimated_timed_caption_only=True))
 cursor+=n
copy=out/"scene06-original-research.mp3";shutil.copyfile(joined,copy)
(out/"scene06-review.zh-TW.srt").write_text("\n".join(srt)+"\n",encoding="utf-8")
review=dict(status="PRIVATE_REVIEW_PACKAGE_NOT_TIMING_OR_MEDIA_PASS",date="20261008",scene_id=6,source_run=38076491234,source_artifact=11679321432,audio_sha256=e["scene06_sha256"],audio_samples=cursor,sample_rate=rate,source_sha256=e["source_sha256"],exact_caption_join="".join(x["text"] for x in segments)==source,segments=segments,caption_timing_basis="decoded 24kHz PCM chunk boundaries, estimated; not independently aligned to audible words",needs_human_listening=True,needs_independent_word_sync=True,publication_authorized=False,media_proof=False)
(out/"scene06-review.json").write_text(json.dumps(review,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
(out/"REVIEW.md").write_text("# Scene 06 — private research review\n\nPlay scene06-original-research.mp3 and inspect scene06-review.zh-TW.srt against the frozen original source. Check all seven phrases and punctuation pauses, six seams, and audio/caption sync. Timings are estimated from PCM chunk boundaries, not independent alignment. Do NOT promote this Artifact as M5 media proof. No YouTube or publication authorization.\n\nSource:\n\n"+source+"\n",encoding="utf-8")
print(json.dumps(dict(status=review["status"],audio_samples=cursor,caption_segments=7,exact_caption_join=True,publication_authorized=False),ensure_ascii=False))
