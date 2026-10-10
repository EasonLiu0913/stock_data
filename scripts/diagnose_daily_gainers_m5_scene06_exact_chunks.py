#!/usr/bin/env python3
"""Research-only exact-text chunk feasibility; never promote diagnostic media."""
import asyncio,json,re,sys,hashlib
from pathlib import Path
import edge_tts
from daily_gainers_spoken_text import normalize_spoken_text
p=json.loads(Path(sys.argv[1]).read_text(encoding="utf-8"))
assert p["schema_version"]==2 and p["target_date"]=="20261008" and p["publication_authorized"] is False and len(p["scenes"])==7
scene=p["scenes"][5];assert scene["id"]==6 and scene["title"]=="institutions"
original=scene["speech_text"];assert normalize_spoken_text(original)==original
control=normalize_spoken_text(p["scenes"][0]["speech_text"]);assert control=="大家好，歡迎來到 TAIWAN STOCK！"
# Punctuation remains attached to preceding source segment, no injected/suppressed characters.
chunks=re.findall(r"[^，、；。！？]+[，、；。！？]?",original)
assert len(chunks)>=4 and all(chunks) and "".join(chunks)==original
async def probe(label,t):
 audio=words=0;error=None;first=None;last=None
 try:
  c=edge_tts.Communicate(text=t,voice="zh-TW-YunJheNeural",rate="+15%",boundary="WordBoundary")
  async for v in c.stream():
   if v["type"]=="audio":audio+=len(v["data"])
   elif v["type"]=="WordBoundary":
    words+=1;first=v["offset"] if first is None else first;last=v["offset"]+v["duration"]
 except Exception as e:error=type(e).__name__+": "+str(e)[:140]
 return dict(label=label,text=t,text_sha256=hashlib.sha256(t.encode()).hexdigest(),audio_bytes=audio,word_events=words,first_offset=first,last_end=last,success=error is None and audio>1000 and words>0,error=error)
async def main():
 requests=[("control_before",control)]+[(f"chunk_{i:02d}",t) for i,t in enumerate(chunks,1)]+[("control_after",control)]
 result=[await probe(name,t) for name,t in requests]
 print(json.dumps(dict(research_only=True,publication_authorized=False,voice="zh-TW-YunJheNeural",rate="+15%",source_sha256=hashlib.sha256(original.encode()).hexdigest(),exact_join_verified=True,chunk_count=len(chunks),all_chunks_success=all(v["success"] for v in result[1:-1]),no_audio_saved=True,not_a_media_or_timing_proof=True,probes=result),ensure_ascii=False,indent=2))
asyncio.run(main())
