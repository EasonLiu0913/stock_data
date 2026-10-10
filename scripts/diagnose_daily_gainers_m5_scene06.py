#!/usr/bin/env python3
"""Research-only bounded M5 scene-06 original-voice diagnostics; not reusable media proof."""
import asyncio,hashlib,json,sys
from pathlib import Path
import edge_tts
from daily_gainers_spoken_text import normalize_spoken_text
plan=json.loads(Path(sys.argv[1]).read_text(encoding="utf-8"))
assert plan["schema_version"]==2 and plan["target_date"]=="20261008" and plan["publication_authorized"] is False and len(plan["scenes"])==7
scene=plan["scenes"][5]
assert scene["id"]==6 and scene["title"]=="institutions"
raw=scene["speech_text"]
text=normalize_spoken_text(raw)
# Split only on existing punctuation, preserving every character and the canonical text.
anchor="；"
assert text.count(anchor)==1
left,right=text.split(anchor)
parts=[left+anchor,right]
assert "".join(parts)==text
async def run(label,payload):
 size=0;boundaries=0
 try:
  request=edge_tts.Communicate(text=payload,voice="zh-TW-YunJheNeural",rate="+15%",boundary="WordBoundary")
  async for chunk in request.stream():
   if chunk["type"]=="audio":size+=len(chunk["data"])
   if chunk["type"]=="WordBoundary":boundaries+=1
  return {"label":label,"text_sha256":hashlib.sha256(payload.encode()).hexdigest(),"audio_bytes":size,"word_events":boundaries,"success":size>1000 and boundaries>0}
 except Exception as e:
  return {"label":label,"text_sha256":hashlib.sha256(payload.encode()).hexdigest(),"audio_bytes":size,"word_events":boundaries,"success":False,"error_type":type(e).__name__,"error_message":str(e)[:200]}
async def main():
 result=[await run("full_original_scene06",text)]
 for i,piece in enumerate(parts,1):result.append(await run(f"unchanged_clause_{i}",piece))
 print(json.dumps({"research_only":True,"publication_authorized":False,"source_date":"20261008","voice":"zh-TW-YunJheNeural","rate":"+15%","edge_tts_version":getattr(edge_tts,"__version__","unknown"),"source_text_sha256":hashlib.sha256(text.encode()).hexdigest(),"split_reconstructs_exact_source":True,"probes":result},ensure_ascii=False,indent=2),flush=True)
 # Diagnostic success is a completed comparison, not a M5 voice/media PASS.
asyncio.run(main())
