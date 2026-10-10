#!/usr/bin/env python3
"""Research only: repeat three previously failing exact source chunks with controls."""
import asyncio,json,re,sys,hashlib
from pathlib import Path
import edge_tts
from daily_gainers_spoken_text import normalize_spoken_text
p=json.loads(Path(sys.argv[1]).read_text(encoding="utf-8"));s=p["scenes"]
assert p["schema_version"]==2 and p["target_date"]=="20261008" and p["publication_authorized"] is False and len(s)==7
t=s[5]["speech_text"];assert s[5]["id"]==6 and normalize_spoken_text(t)==t
chunks=re.findall(r"[^，、；。！？]+[，、；。！？]?",t)
assert len(chunks)==7 and "".join(chunks)==t
control=normalize_spoken_text(s[0]["speech_text"])
assert control=="大家好，歡迎來到 TAIWAN STOCK！"
async def probe(label,value,cycle):
 audio=words=0;error=None
 try:
  req=edge_tts.Communicate(text=value,voice="zh-TW-YunJheNeural",rate="+15%",boundary="WordBoundary")
  async for x in req.stream():
   if x["type"]=="audio":audio+=len(x["data"])
   elif x["type"]=="WordBoundary":words+=1
 except Exception as e:error=type(e).__name__+": "+str(e)[:140]
 return dict(cycle=cycle,label=label,sha256=hashlib.sha256(value.encode()).hexdigest(),audio_bytes=audio,word_events=words,success=error is None and audio>1000 and words>0,error=error)
async def main():
 result=[]
 for cycle in (1,2):
  result.append(await probe("greeting_control",control,cycle))
  for index in (2,3,5):result.append(await probe(f"chunk_{index:02d}",chunks[index-1],cycle))
 result.append(await probe("greeting_final",control,3))
 print(json.dumps(dict(research_only=True,publication_authorized=False,exact_join=True,voice="zh-TW-YunJheNeural",rate="+15%",max_requests=9,prior_failed_chunks=[2,3,5],no_audio_saved=True,not_media_proof=True,probes=result),ensure_ascii=False,indent=2))
asyncio.run(main())
