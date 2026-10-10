#!/usr/bin/env python3
"""Three same-invocation source-locked YunJhe probes; diagnostic only."""
import asyncio,hashlib,json,sys
from pathlib import Path
import edge_tts
from daily_gainers_spoken_text import normalize_spoken_text
plan=json.loads(Path(sys.argv[1]).read_text(encoding="utf-8"))
assert plan["schema_version"]==2 and plan["target_date"]=="20261008" and plan["publication_authorized"] is False and len(plan["scenes"])==7
assert plan["scenes"][0]["id"]==1 and plan["scenes"][5]["id"]==6 and plan["scenes"][5]["title"]=="institutions"
control=normalize_spoken_text(plan["scenes"][0]["speech_text"])
target=normalize_spoken_text(plan["scenes"][5]["speech_text"])
assert control=="大家好，歡迎來到 TAIWAN STOCK！"
assert "三大法人" in target
async def probe(label,text):
 count=0;words=0
 try:
  req=edge_tts.Communicate(text=text,voice="zh-TW-YunJheNeural",rate="+15%",boundary="WordBoundary")
  async for item in req.stream():
   if item["type"]=="audio":count+=len(item["data"])
   if item["type"]=="WordBoundary":words+=1
  return dict(label=label,text_sha256=hashlib.sha256(text.encode()).hexdigest(),audio_bytes=count,word_events=words,success=count>1000 and words>0)
 except Exception as e:
  return dict(label=label,text_sha256=hashlib.sha256(text.encode()).hexdigest(),audio_bytes=count,word_events=words,success=False,error_type=type(e).__name__,error_message=str(e)[:200])
async def main():
 result=[]
 for label,text in [("control_before",control),("exact_scene06",target),("control_after",control)]:
  result.append(await probe(label,text))
 print(json.dumps(dict(research_only=True,publication_authorized=False,source_date="20261008",voice="zh-TW-YunJheNeural",rate="+15%",edge_tts_version=getattr(edge_tts,"__version__","unknown"),same_invocation=True,probes=result),ensure_ascii=False,indent=2),flush=True)
asyncio.run(main())
