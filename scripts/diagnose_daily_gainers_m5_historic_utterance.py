#!/usr/bin/env python3
"""Research-only matched-voice comparison; no substitute output is published."""
import asyncio,hashlib,json,edge_tts
from pathlib import Path
HISTORIC_TEXT="歡迎來到 TAIWANSTOCK。今天是十月八日，我們整理了台股當天漲幅超過百分之五的三十五檔強勢股。先說結論，今天不是所有熱門題材一起發動，而是防疫相關、生技醫療、部分塑化、被動元件，以及個別營收亮眼的公司交錯表現。市場表面上熱鬧，但能找到直接或交叉公開催化佐證的只有十三檔，約占三成七。因此我們不只看漲幅，還要問資金從哪裡來、新聞是否有實質支撐、隔天是否仍有延續條件。這集會先看族群，再看有具體數據的代表個股，最後整理風險與隔日驗證清單。"
M5_TEXT="大家好，歡迎來到 TAIWAN STOCK！"
async def probe(label,phrase):
 n=0;words=0
 try:
  request=edge_tts.Communicate(text=phrase,voice="zh-TW-YunJheNeural",rate="+15%",boundary="WordBoundary")
  async for chunk in request.stream():
   if chunk["type"]=="audio":n+=len(chunk["data"])
   elif chunk["type"]=="WordBoundary":words+=1
  return dict(label=label,sha256=hashlib.sha256(phrase.encode()).hexdigest(),audio_bytes=n,word_events=words,success=n>1000 and words>0)
 except Exception as e:return dict(label=label,sha256=hashlib.sha256(phrase.encode()).hexdigest(),success=False,error_type=type(e).__name__,error_message=str(e)[:200])
async def main():
 results=[await probe("historic_successful_scene_01",HISTORIC_TEXT),await probe("m5_immutable_brand_scene_01",M5_TEXT)]
 report=dict(date="20261008",research_only=True,publication_authorized=False,voice="zh-TW-YunJheNeural",rate="+15%",edge_tts_version=getattr(edge_tts,"__version__","unknown"),historical_source_run=37871900664,probes=results)
 print(json.dumps(report,ensure_ascii=False,indent=2),flush=True)
 if not all(x["success"] for x in results):raise SystemExit("M5 same-voice comparison not fully verified")
asyncio.run(main())
