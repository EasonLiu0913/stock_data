#!/usr/bin/env python3
"""Manual M5 scene-six contiguous fragment diagnostic; never promote results to media."""
import asyncio, json, sys
from pathlib import Path
import edge_tts
from daily_gainers_spoken_text import normalize_spoken_text

plan=json.loads(Path(sys.argv[1]).read_text(encoding="utf-8"))
assert plan["schema_version"] == 2 and plan["target_date"] == "20261008"
assert plan["publication_authorized"] is False and len(plan["scenes"]) == 7
source=plan["scenes"][5]
assert source["id"] == 6 and source["title"] == "institutions"
text=normalize_spoken_text(source["speech_text"])
assert text == source["speech_text"]
control=normalize_spoken_text(plan["scenes"][0]["speech_text"])
lengths=(3,6,9,12,18)
samples=[("control_before",control),("prefix12",text[:12])]
samples.extend((f"suffix{n}",text[-n:]) for n in lengths)
samples.extend([("last12_first6",text[-12:-6]),("last12_last6",text[-6:]),("prefix24",text[:24]),("control_after",control)])

async def check(name,phrase):
    audio=events=0
    error=None
    try:
        request=edge_tts.Communicate(text=phrase,voice="zh-TW-YunJheNeural",rate="+15%",boundary="WordBoundary")
        async for item in request.stream():
            if item["type"]=="audio": audio+=len(item["data"])
            elif item["type"]=="WordBoundary": events+=1
    except Exception as exc:
        error=type(exc).__name__+": "+str(exc)[:150]
    return dict(label=name,text=phrase,characters=len(phrase),audio_bytes=audio,word_events=events,success=error is None and audio>1000 and events>0,error=error)

async def main():
    results=[]
    for name,phrase in samples:
        results.append(await check(name,phrase))
    print(json.dumps(dict(research_only=True,publication_authorized=False,voice="zh-TW-YunJheNeural",rate="+15%",partial_audio_is_not_accepted_scene06=True,probes=results),ensure_ascii=False,indent=2))
asyncio.run(main())
