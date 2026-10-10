#!/usr/bin/env python3
"""Research-only Edge TTS diagnostics. Never treat a probe as M5 media proof."""
import asyncio,json,edge_tts
from edge_tts.exceptions import NoAudioReceived
TEXT="大家好，歡迎來到 TAIWAN STOCK！"
async def probe(label,voice,rate,boundary):
 audio_bytes=0
 word_events=0
 try:
  c=edge_tts.Communicate(text=TEXT,voice=voice,rate=rate,boundary=boundary)
  async for chunk in c.stream():
   if chunk['type']=='audio': audio_bytes+=len(chunk['data'])
   if chunk['type']=='WordBoundary': word_events+=1
  return dict(label=label,voice=voice,rate=rate,boundary=boundary,audio_bytes=audio_bytes,word_events=word_events,success=audio_bytes>1000 and word_events>0)
 except Exception as error:
  return dict(label=label,voice=voice,rate=rate,boundary=boundary,success=False,error_type=type(error).__name__,error_message=str(error)[:240])
async def main():
 result=[]
 for label,voice,rate in [('original','zh-TW-YunJheNeural','+15%'),('same-voice-neutral-rate','zh-TW-YunJheNeural','+0%'),('alternative-tw-voice','zh-TW-HsiaoChenNeural','+0%')]:
  result.append(await probe(label,voice,rate,'WordBoundary'))
 print(json.dumps(dict(date='20261008',research_only=True,publication_authorized=False,edge_tts_version=getattr(edge_tts,'__version__','unknown'),probes=result),ensure_ascii=False,indent=2))
 if not result[0]['success']: raise SystemExit('Original required voice/rate still not proven; no silent fallback')
asyncio.run(main())
