#!/usr/bin/env python3
"""Bounded same-input M5 TTS reliability diagnostic; never an accepted media artifact."""
import asyncio,hashlib,json,sys
from pathlib import Path
import edge_tts
from daily_gainers_spoken_text import normalize_spoken_text
p=json.loads(Path(sys.argv[1]).read_text(encoding="utf-8"));s=p["scenes"]
assert (p["schema_version"],p["target_date"],p["publication_authorized"],len(s))==(2,"20261008",False,7)
assert s[0]["id"]==1 and s[5]["id"]==6 and s[5]["title"]=="institutions"
control=normalize_spoken_text(s[0]["speech_text"]);target=normalize_spoken_text(s[5]["speech_text"])
assert control=="大家好，歡迎來到 TAIWAN STOCK！" and target==s[5]["speech_text"]
async def probe(label,t,cycle):
 audio=events=0;error=None
 try:
  req=edge_tts.Communicate(text=t,voice="zh-TW-YunJheNeural",rate="+15%",boundary="WordBoundary")
  async for item in req.stream():
   if item["type"]=="audio":audio+=len(item["data"])
   elif item["type"]=="WordBoundary":events+=1
 except Exception as exc:error=type(exc).__name__+": "+str(exc)[:150]
 return dict(cycle=cycle,label=label,text_sha256=hashlib.sha256(t.encode()).hexdigest(),audio_bytes=audio,word_events=events,success=error is None and audio>1000 and events>0,error=error)
async def main():
 result=[]
 for cycle in range(1,4):
  result.append(await probe("control",control,cycle))
  result.append(await probe("scene06_exact",target,cycle))
 result.append(await probe("control_final",control,4))
 summary={name:{"success":sum(x["success"] for x in result if x["label"]==name),"total":sum(x["label"]==name for x in result)} for name in ("control","scene06_exact","control_final")}
 print(json.dumps(dict(research_only=True,publication_authorized=False,voice="zh-TW-YunJheNeural",rate="+15%",edge_tts_version=getattr(edge_tts,"__version__","unknown"),same_exact_inputs=True,maximum_requests=7,summary=summary,probes=result),ensure_ascii=False,indent=2))
asyncio.run(main())
