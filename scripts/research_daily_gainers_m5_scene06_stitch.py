#!/usr/bin/env python3
"""M5 research only: same-run exact-source scene06 chunk audio and timing feasibility."""
import asyncio, hashlib, json, re, subprocess, sys, tempfile, shutil
from pathlib import Path
import edge_tts
from daily_gainers_spoken_text import normalize_spoken_text

plan=json.loads(Path(sys.argv[1]).read_text(encoding="utf-8"))
assert plan["schema_version"]==2 and plan["target_date"]=="20261008" and plan["publication_authorized"] is False and len(plan["scenes"])==7
scene=plan["scenes"][5]
assert scene["id"]==6
source=scene["speech_text"]
assert normalize_spoken_text(source)==source
pieces=re.findall(r"[^，、；。！？]+[，、；。！？]?",source)
assert len(pieces)==7 and "".join(pieces)==source
out=Path(sys.argv[2])
out.mkdir(parents=True,exist_ok=True)
def duration(path):
 p=subprocess.run(["ffprobe","-v","error","-show_entries","format=duration","-of","default=noprint_wrappers=1:nokey=1",str(path)],capture_output=True,text=True,check=True)
 value=float(p.stdout.strip())
 assert value>0
 return value
async def synthesize(value,path):
 audio=bytearray(); events=[]
 req=edge_tts.Communicate(text=value,voice="zh-TW-YunJheNeural",rate="+15%",boundary="WordBoundary")
 async for item in req.stream():
  if item["type"]=="audio": audio.extend(item["data"])
  elif item["type"]=="WordBoundary":events.append({k:item[k] for k in ("text","offset","duration")})
 if len(audio)<1000 or not events: raise RuntimeError("NO_AUDIO_OR_WORD_BOUNDARIES")
 path.write_bytes(audio)
 duration(path)
 return events
async def main():
 for required in ('ffmpeg', 'ffprobe'):
  if shutil.which(required) is None: raise RuntimeError(f'M5_RESEARCH_ENV_MISSING_{required.upper()}')
 records=[]
 try:
  for i,value in enumerate(pieces,1):
   path=out/f"chunk-{i:02d}.mp3"
   last=None
   for attempt in range(1,4):
    path.unlink(missing_ok=True)
    try:
     events=await synthesize(value,path);break
    except Exception as exc:
     last=type(exc).__name__+":"+str(exc)[:120]
     if attempt==3:raise RuntimeError(f"CHUNK_{i:02d}_FAILED:{last}") from exc
     await asyncio.sleep(attempt*2)
   records.append(dict(index=i,text=value,text_sha256=hashlib.sha256(value.encode()).hexdigest(),file=path.name,audio_sha256=hashlib.sha256(path.read_bytes()).hexdigest(),duration_seconds=duration(path),word_boundaries=events,attempts=attempt))
  # Concat demuxer with re-encode: never raw byte concatenation of independent MP3 streams.
  concat=out/"concat.txt"
  concat.write_text("".join(f"file '{r['file']}'\n" for r in records),encoding="utf-8")
  joined=out/"scene06-research.mp3"
  subprocess.run(["ffmpeg","-hide_banner","-loglevel","error","-y","-f","concat","-safe","0","-i",str(concat),"-c:a","libmp3lame","-q:a","3",str(joined)],check=True)
  total=duration(joined)
  cursor=0; mapped=[]
  for r in records:
   for e in r["word_boundaries"]:
    mapped.append(dict(text=e["text"],offset=int(e["offset"])+cursor,duration=int(e["duration"]),chunk=r["index"]))
   cursor+=round(r["duration_seconds"]*10000000)
  assert all(mapped[i]["offset"]<=mapped[i+1]["offset"] for i in range(len(mapped)-1))
  # MP3 encoder delay/gaps mean this is a feasibility estimate, NOT certified final subtitle sync.
  evidence=dict(research_only=True,publication_authorized=False,not_m5_media_proof=True,source_exact_join="".join(x["text"] for x in records)==source,source_sha256=hashlib.sha256(source.encode()).hexdigest(),voice="zh-TW-YunJheNeural",rate="+15%",records=records,scene06_audio=joined.name,scene06_sha256=hashlib.sha256(joined.read_bytes()).hexdigest(),stitched_duration_seconds=total,offset_method="cumulative_ffprobe_duration_100ns_estimate_requires_independent_sync_review",mapped_word_boundaries=mapped)
  (out/"scene06-research-proof.json").write_text(json.dumps(evidence,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
  print(json.dumps(dict(status="RESEARCH_FEASIBILITY_NOT_MEDIA_PASS",pieces=len(records),source_exact_join=True,stitched_seconds=total,word_events=len(mapped)),ensure_ascii=False))
 except Exception:
  (out/"INCOMPLETE_NO_PROMOTION").write_text("Research failure. No assembled audio may be promoted.\n",encoding="utf-8")
  raise
asyncio.run(main())
