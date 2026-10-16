#!/usr/bin/env python3
"""Isolated AI V3 sentence-level Edge TTS proof; never publishes or renders."""
import hashlib,json,pathlib,subprocess,sys
src=pathlib.Path(sys.argv[1]); out=pathlib.Path(sys.argv[2]); out.mkdir(parents=True,exist_ok=True)
d=json.loads(src.read_text())
assert d["target_date"]=="20261008" and d["media_input_status"]=="V3_SIX_SCENE_SEMANTIC_INPUT_ONLY"
assert [p["id"] for p in d["media_input"]]==["opening","market","6672","2305","1301","conclusion"]
assert [len(p["speech_sentences"]) for p in d["media_input"]]==[4,5,3,3,3,3]
assert all(d[k] is False for k in ("publication_authorized","render_authorized","real_tts_generated","timed_srt_generated","mp4_generated"))
proof={"contract":"AI_V3_SENTENCE_AUDIO_RESEARCH_ONLY","target_date":"20261008","research_master_sha256":d["research_master_sha256"],"voice":"zh-TW-YunJheNeural","rate":"+15%","publication_authorized":False,"timed_srt_generated":False,"mp4_generated":False,"sentences":[]}
try:
 for part in d["media_input"]:
  for index,(spoken,caption) in enumerate(zip(part["speech_sentences"],part["caption_sentences"]),1):
   assert spoken and caption
   path=out/f'{part["scene"]:02d}-{index:02d}.mp3'
   cmd=["edge-tts","--voice",proof["voice"],"--rate",proof["rate"],"--text",spoken,"--write-media",str(path)]
   run=subprocess.run(cmd,capture_output=True,text=True,timeout=75)
   if run.returncode or not path.exists() or path.stat().st_size<100:raise RuntimeError(f'TTS_FAILED {part["id"]} {index}: '+run.stderr[-300:])
   probe=subprocess.run(["ffprobe","-v","error","-show_entries","format=duration","-of","default=noprint_wrappers=1:nokey=1",str(path)],capture_output=True,text=True,timeout=20,check=True)
   duration=float(probe.stdout.strip())
   assert 0.1<duration<120
   proof["sentences"].append({"part":part["id"],"sentence":index,"spoken_text":spoken,"caption_text":caption,"file":path.name,"duration_seconds":duration,"sha256":hashlib.sha256(path.read_bytes()).hexdigest(),"claim_ids":part["claim_ids"],"card_claim_ids":part["card_claim_ids"]})
   (out/"partial-proof.json").write_text(json.dumps(proof,ensure_ascii=False,indent=2)+"\n")
 assert len(proof["sentences"])==21
 opening=sum(s["duration_seconds"] for s in proof["sentences"] if s["part"] in ("opening","market"))
 proof["opening_seconds"]=opening
 proof["opening_30_to_90_seconds_pass"]=30<=opening<=90
 proof["real_tts_generated"]=True
 (out/"audio-proof.json").write_text(json.dumps(proof,ensure_ascii=False,indent=2)+"\n")
 if not proof["opening_30_to_90_seconds_pass"]:raise RuntimeError("OPENING_DURATION_OUT_OF_RANGE")
except Exception as e:
 (out/"failure.json").write_text(json.dumps({"error":str(e),"completed_sentences":len(proof["sentences"]),"publication_authorized":False},ensure_ascii=False,indent=2)+"\n")
 raise
