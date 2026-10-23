#!/usr/bin/env python3
"""Isolated one-request Edge TTS compatibility probe; never stores audio or URLs."""
import asyncio, importlib.metadata, json, os, re
from datetime import datetime, timezone
from pathlib import Path
import edge_tts

async def main():
    evidence={"schema":"edge-tts-replay-probe-v1","package_version":importlib.metadata.version("edge-tts"),"utc":datetime.now(timezone.utc).isoformat(),"voice":"zh-TW-YunJheNeural","rate":"+15%","audio_bytes":0,"word_boundaries":0,"status":"BLOCKED"}
    try:
        t=edge_tts.Communicate(text="大家好，歡迎來到 TAIWAN STOCK！",voice=evidence["voice"],rate=evidence["rate"],boundary="WordBoundary")
        async for chunk in t.stream():
            if chunk["type"]=="audio":evidence["audio_bytes"]+=len(chunk["data"])
            elif chunk["type"]=="WordBoundary":evidence["word_boundaries"]+=1
        if evidence["audio_bytes"]>=1000 and evidence["word_boundaries"]>0:evidence["status"]="PASS"
        else:evidence["failure"]="MISSING_AUDIO_OR_WORDBOUNDARY"
    except Exception as e:
        evidence["failure_type"]=type(e).__name__
        evidence["failure"]="HTTP_403" if "403" in str(e) else "OTHER_STREAM_ERROR"
    out=Path("output/research-edge-tts-20261008")
    out.mkdir(parents=True,exist_ok=True)
    (out/"probe.json").write_text(json.dumps(evidence,ensure_ascii=False,indent=2)+"\n",encoding="utf8")
    print(json.dumps(evidence,ensure_ascii=False))
    if evidence["status"]!="PASS":raise SystemExit(2)
asyncio.run(main())
