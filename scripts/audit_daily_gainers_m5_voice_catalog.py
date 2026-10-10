#!/usr/bin/env python3
"""Research-only availability audit for the frozen male voice; no synthesis fallback."""
import asyncio,json,edge_tts
TARGET="zh-TW-YunJheNeural"
async def main():
 result={"date":"20261008","research_only":True,"publication_authorized":False,"requested_voice":TARGET,"voice_found":False,"taiwan_voices":[]}
 try:
  voices=await edge_tts.list_voices()
  selected=[{"short_name":v.get("ShortName"),"gender":v.get("Gender"),"locale":v.get("Locale")} for v in voices if v.get("Locale")=="zh-TW"]
  result["taiwan_voices"]=selected
  result["voice_found"]=any(v["short_name"]==TARGET for v in selected)
 except Exception as e:
  result["error_type"]=type(e).__name__
  result["error_message"]=str(e)[:300]
 print(json.dumps(result,ensure_ascii=False,indent=2))
 if not result["voice_found"]:raise SystemExit("M5 original YunJhe not confirmed in current voice catalog")
asyncio.run(main())
