#!/usr/bin/env python3
"""M9 Stage1 isolated-only voice/SRT research. Never modifies original M7 or uploads video."""
import asyncio,hashlib,json,re,sys
from pathlib import Path
from mutagen.mp3 import MP3
import edge_tts
ROOT=Path(__file__).resolve().parents[1]
SRC=ROOT/"data_research/m5/m8data/20261008-1301-semantic-draft.json"
MAN=ROOT/"data_research/m5/m8data/20261008-1301-research-manifest.json"
OUT=Path(sys.argv[1]).resolve()
VOICE="zh-TW-YunJheNeural"; RATE="+15%"
def sha(b):return hashlib.sha256(b).hexdigest()
def ms(x):return f"{int(x)//3600000:02}:{int(x)//60000%60:02}:{int(x)//1000%60:02},{int(x)%1000:03}"
def srt(lines):
 return "\n\n".join(f"{i+1}\n{ms(a)} --> {ms(b)}\n{text}" for i,(a,b,text) in enumerate(lines))+"\n"
async def main():
 d=json.loads(SRC.read_text(encoding="utf8")); m=json.loads(MAN.read_text(encoding="utf8"))
 assert d["date"]==m["date"]=="20261008" and d["stock"]==m["stock"]=="1301"
 assert len(d["scenes"])==3 and [(x["id"],x["claim_ids"]) for x in d["scenes"]]==[(x["id"],x["keys"]) for x in m["scenes"]]
 cov=d["claim_coverage"]; assert len(cov)==9 and len({x["key"] for x in cov})==9
 assert d["excluded_pending_verification"]==m["display_scope"]["excluded_pending_verification"] and len(d["excluded_pending_verification"])==6
 for i,scene in enumerate(d["scenes"]):
  assert all(x["fragments"]["speech"] in scene["speech"] and x["fragments"]["caption"] in scene["caption"] for x in cov if x["scene_index"]==i)
  assert "因果" not in scene["speech"] or "不能直接證明" in scene["speech"]
 OUT.mkdir(parents=True,exist_ok=True); results=[]; combined=[]; offset=0
 for i,scene in enumerate(d["scenes"],1):
  name=f"{i:02d}-{scene['id']}"; audio=OUT/(name+".mp3"); bounds=[]
  stream=edge_tts.Communicate(scene["speech"],VOICE,rate=RATE)
  with audio.open("wb") as w:
   async for chunk in stream.stream():
    if chunk["type"]=="audio": w.write(chunk["data"])
    elif chunk["type"]=="WordBoundary": bounds.append({"offset_100ns":chunk["offset"],"duration_100ns":chunk["duration"],"text":chunk["text"]})
  actual=round(MP3(str(audio)).info.length*1000)
  assert audio.stat().st_size>2000 and actual>1000 and bounds, "TTS/audio/WordBoundary unavailable: fail closed"
  end=max(z["offset_100ns"]+z["duration_100ns"] for z in bounds)/10000
  assert end<=actual+700,"Boundary extends beyond measured MP3"
  # Cue is full frozen scene caption (no text truncation); timing from actual WordBoundary
  # event envelope; this is TTS-engine estimated boundary, NOT acoustic-sync proof.
  cue_end=min(actual,max(1,round(end)))
  combined.append((offset,offset+cue_end,scene["caption"]))
  one=srt([(0,cue_end,scene["caption"])])
  (OUT/(name+".srt")).write_text(one,encoding="utf8")
  results.append({"id":scene["id"],"claims":scene["claim_ids"],"speech":scene["speech"],"caption":scene["caption"],"audio_file":audio.name,"audio_sha256":sha(audio.read_bytes()),"audio_bytes":audio.stat().st_size,"measured_mp3_duration_ms":actual,"tts_wordboundary_count":len(bounds),"tts_wordboundaries":bounds,"srt_file":name+".srt","srt_sha256":sha(one.encode()),"cue_end_ms":cue_end,"timing_grade":"TTS_WORDBOUNDARY_ESTIMATED_NOT_ACOUSTIC_VERIFIED"})
  offset+=actual
 final=srt(combined);(OUT/"m8-stage1-candidate.srt").write_text(final,encoding="utf8")
 report={"schema":"M9-STAGE1-RESEARCH-AUDIO-PROOF-v1","date":"20261008","stock":"1301","voice":VOICE,"rate":RATE,"source_semantic_git_sha":"c8af0e9e77aa49f5f8724579e331a12dea7878f7","status":"RESEARCH_AUDIO_GENERATED_NOT_INDEPENDENTLY_ACCEPTED","scenes":results,"combined_srt_sha256":sha(final.encode()),"combined_cues":len(combined),"actual_mp3_duration_total_ms":offset,"caption_timing_grade":"TTS_WORDBOUNDARY_ESTIMATED_NOT_ACOUSTIC_VERIFIED","original_M7":"IMMUTABLE_UNTOUCHED","release":{"stage2":False,"render":False,"production":False,"cron":False,"pages":False,"youtube":False}}
 (OUT/"stage1-proof.json").write_text(json.dumps(report,ensure_ascii=False,indent=2)+"\n",encoding="utf8")
 assert len(results)==3 and all(z["audio_sha256"] and z["srt_sha256"] for z in results)
 print("M9_STAGE1_AUDIO_RESEARCH_PASS scenes=3 claims=9 excluded=6 mp3=3 srt=3+combined timing=TTS_WORDBOUNDARY_ESTIMATED_NOT_ACOUSTIC_VERIFIED no_m7_write=true no_render=true no_upload=true")
asyncio.run(main())
