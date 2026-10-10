#!/usr/bin/env python3
"""Manual source-derived original voice length/span diagnostic; NO media promotion."""
import asyncio,hashlib,json,sys
from pathlib import Path
import edge_tts
from daily_gainers_spoken_text import normalize_spoken_text
p=json.loads(Path(sys.argv[1]).read_text(encoding="utf-8"))
assert (p["schema_version"],p["target_date"],p["publication_authorized"],len(p["scenes"]))==(2,"20261008",False,7)
s=p["scenes"];assert [x["id"] for x in s]==list(range(1,8)) and s[5]["title"]=="institutions"
norm=lambda n:normalize_spoken_text(s[n-1]["speech_text"])
control=norm(1);long_control=norm(4);target=norm(6)
assert control=="大家好，歡迎來到 TAIWAN STOCK！"
assert target==s[5]["speech_text"] and len(long_control)>=len(target)
# Only contiguous verbatim fragments of scene 06, not replacement narration.
k=min(12,len(target)//4)
variants=[("control_before",control),("long_scene04",long_control),
 ("scene06_prefix_short",target[:k]),("scene06_suffix_short",target[-k:]),
 ("scene06_prefix_half",target[:len(target)//2]),("scene06_suffix_half",target[len(target)//2:]),
 ("scene06_exact",target),("control_after",control)]
async def probe(label,t):
 audio=0;words=0
 try:
  c=edge_tts.Communicate(text=t,voice="zh-TW-YunJheNeural",rate="+15%",boundary="WordBoundary")
  async for item in c.stream():
   if item["type"]=="audio":audio+=len(item["data"])
   elif item["type"]=="WordBoundary":words+=1
  return dict(label=label,characters=len(t),sha256=hashlib.sha256(t.encode()).hexdigest(),audio_bytes=audio,word_events=words,success=audio>1000 and words>0)
 except Exception as e:return dict(label=label,characters=len(t),sha256=hashlib.sha256(t.encode()).hexdigest(),audio_bytes=audio,word_events=words,success=False,error_type=type(e).__name__,error=str(e)[:160])
async def main():
 results=[await probe(label,t) for label,t in variants]
 print(json.dumps(dict(research_only=True,publication_authorized=False,source_date="20261008",voice="zh-TW-YunJheNeural",rate="+15%",edge_tts_version=getattr(edge_tts,"__version__","unknown"),original_equals_normalized=True,fragment_media_not_approved=True,probes=results),ensure_ascii=False,indent=2),flush=True)
asyncio.run(main())
