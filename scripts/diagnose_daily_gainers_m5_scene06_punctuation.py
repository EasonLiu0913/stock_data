#!/usr/bin/env python3
"""Source-locked bounded punctuation/phrase differential. Diagnostic is NOT M5 media."""
import asyncio,hashlib,json,sys
from pathlib import Path
import edge_tts
from daily_gainers_spoken_text import normalize_spoken_text
p=json.loads(Path(sys.argv[1]).read_text(encoding="utf-8"))
assert (p["schema_version"],p["target_date"],p["publication_authorized"],len(p["scenes"]))==(2,"20261008",False,7)
assert p["scenes"][5]["id"]==6 and p["scenes"][5]["title"]=="institutions"
raw=p["scenes"][5]["speech_text"]; canonical=normalize_spoken_text(raw)
assert raw==canonical,"Unexpected normalization change: stop rather than test wrong hypothesis"
assert canonical.count("；")==1 and canonical.count("，")>=2
control=normalize_spoken_text(p["scenes"][0]["speech_text"])
assert control=="大家好，歡迎來到 TAIWAN STOCK！"
left,right=canonical.split("；")
variants=[("control_before",control),("scene06_exact",canonical),("semicolon_to_comma",canonical.replace("；","，")),("semicolon_to_period",canonical.replace("；","。")),("first_clause_only",left+"；"),("second_clause_only",right),("control_after",control)]
async def probe(label,t):
 audio=0;words=0
 try:
  c=edge_tts.Communicate(text=t,voice="zh-TW-YunJheNeural",rate="+15%",boundary="WordBoundary")
  async for part in c.stream():
   if part["type"]=="audio":audio+=len(part["data"])
   elif part["type"]=="WordBoundary":words+=1
  return dict(label=label,sha256=hashlib.sha256(t.encode()).hexdigest(),audio_bytes=audio,word_events=words,success=audio>1000 and words>0)
 except Exception as e:return dict(label=label,sha256=hashlib.sha256(t.encode()).hexdigest(),audio_bytes=audio,word_events=words,success=False,error_type=type(e).__name__,error=str(e)[:160])
async def main():
 results=[]
 for label,t in variants:results.append(await probe(label,t))
 print(json.dumps(dict(research_only=True,publication_authorized=False,original_equals_normalized=True,original_sha256=hashlib.sha256(raw.encode()).hexdigest(),voice="zh-TW-YunJheNeural",rate="+15%",edge_tts_version=getattr(edge_tts,"__version__","unknown"),altered_variants_are_diagnostics_not_approved_speech=True,probes=results),ensure_ascii=False,indent=2),flush=True)
asyncio.run(main())
