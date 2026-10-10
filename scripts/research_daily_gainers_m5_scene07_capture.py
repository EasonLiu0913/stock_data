#!/usr/bin/env python3
"""Bounded original-text scene07 research capture. Never modifies wording or publishes."""
import asyncio,hashlib,json,re,shutil,subprocess,sys
from pathlib import Path
import edge_tts
from daily_gainers_spoken_text import normalize_spoken_text
p=json.loads(Path(sys.argv[1]).read_text(encoding="utf-8"));out=Path(sys.argv[2]);out.mkdir(parents=True,exist_ok=True)
assert p["schema_version"]==2 and p["target_date"]=="20261008" and p["publication_authorized"] is False and len(p["scenes"])==7
s=p["scenes"][6];assert s["id"]==7 and s["speech_text"]==normalize_spoken_text(s["speech_text"])
source=s["speech_text"];parts=re.findall(r"[^，、；。！？]+[，、；。！？]?",source);assert "".join(parts)==source
def measure(f):
 v=subprocess.run(["ffprobe","-v","error","-show_entries","format=duration","-of","default=noprint_wrappers=1:nokey=1",str(f)],capture_output=True,text=True,check=True);return float(v.stdout.strip())
async def capture(value,f):
 b=bytearray();w=[]
 async for x in edge_tts.Communicate(text=value,voice="zh-TW-YunJheNeural",rate="+15%",boundary="WordBoundary").stream():
  if x["type"]=="audio":b.extend(x["data"])
  elif x["type"]=="WordBoundary":w.append({k:x[k] for k in ("text","offset","duration")})
 if len(b)<1000 or not w:raise RuntimeError("NO_VALID_AUDIO_OR_WORDBOUNDARY")
 f.write_bytes(b);assert measure(f)>0
 return dict(text=value,sha256=hashlib.sha256(value.encode()).hexdigest(),file=f.name,audio_sha256=hashlib.sha256(b).hexdigest(),duration_seconds=measure(f),word_boundaries=w)
async def retry(v,f,n):
 errors=[]
 for i in range(1,n+1):
  f.unlink(missing_ok=True)
  try:
   x=await capture(v,f);x["attempts"]=i;x["errors"]=errors;return x
  except Exception as exc:
   errors.append(type(exc).__name__+":"+str(exc)[:120])
   if i<n:await asyncio.sleep(i*2)
 return dict(text=v,attempts=n,errors=errors,success=False)
async def main():
 for binary in ("ffmpeg","ffprobe"):
  if shutil.which(binary) is None:raise RuntimeError("M5_MISSING_"+binary.upper())
 whole=await retry(source,out/"scene07-whole.mp3",2)
 proof=dict(research_only=True,publication_authorized=False,not_m5_media_proof=True,source_sha256=hashlib.sha256(source.encode()).hexdigest(),voice="zh-TW-YunJheNeural",rate="+15%",whole=whole,mode="whole" if "word_boundaries" in whole else "chunk_feasibility",source_exact_join=True)
 if "word_boundaries" not in whole:
  chunks=[]
  for i,v in enumerate(parts,1):
   x=await retry(v,out/f"chunk-{i:02d}.mp3",2);x["index"]=i;chunks.append(x)
  proof["chunks"]=chunks
  if all("word_boundaries" in x for x in chunks):
   concat=out/"concat.txt";concat.write_text("".join(f"file '{x['file']}'\n" for x in chunks),encoding="utf-8")
   joined=out/"scene07-research.mp3"
   subprocess.run(["ffmpeg","-hide_banner","-loglevel","error","-y","-f","concat","-safe","0","-i",str(concat),"-c:a","libmp3lame","-q:a","3",str(joined)],check=True)
   proof["stitched"]=dict(file=joined.name,sha256=hashlib.sha256(joined.read_bytes()).hexdigest(),duration_seconds=measure(joined),subtitle_sync_certified=False)
  else:proof["status"]="INCOMPLETE_NO_PROMOTION"
 else:proof["status"]="WHOLE_ORIGINAL_SCENE07_RESEARCH_CAPTURE_NOT_MEDIA_PASS"
 (out/"scene07-research-proof.json").write_text(json.dumps(proof,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
 print(json.dumps(dict(status=proof["status"] if "status" in proof else "CHUNK_RESEARCH_FEASIBILITY_NOT_MEDIA_PASS",mode=proof["mode"],source_exact_join=True,whole_success="word_boundaries" in whole,parts=len(parts),publication_authorized=False),ensure_ascii=False))
asyncio.run(main())
