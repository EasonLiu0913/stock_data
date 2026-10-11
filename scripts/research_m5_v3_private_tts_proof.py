#!/usr/bin/env python3
"""Bounded private 20261008 audio evidence only. Never uploads or publishes."""
import hashlib, json, pathlib, subprocess, sys, time
p=pathlib.Path(sys.argv[1]);out=pathlib.Path(sys.argv[2]);out.mkdir(parents=True,exist_ok=True)
s=json.loads(p.read_text()); assert s["target_date"]=="20261008" and len(s["scenes"])==7
assert all(s[k] is False for k in ("publication_authorized","tts_authorized","video_authorized","private_media_proof_complete"))
entries=[]; total=0.
partial=out/"partial-audio-proof.json"
for scene in s["scenes"]:
 i=scene["scene"]; t=scene["speech_text"]
 assert scene["caption_text"]==t==scene["display_text"] and t
 media=out/f"{i:02d}.mp3"
 attempts=[]
 for attempt in range(1,4):
  if media.exists():media.unlink()
  p=subprocess.run(["edge-tts","--voice","zh-TW-YunJheNeural","--rate=+15%","--text",t,"--write-media",str(media)],capture_output=True,text=True,timeout=45)
  if p.returncode==0 and media.exists() and media.stat().st_size>100:
   probe=subprocess.run(["ffprobe","-v","error","-show_entries","format=duration","-of","default=noprint_wrappers=1:nokey=1",str(media)],capture_output=True,text=True,timeout=15)
   if probe.returncode==0:
    try:duration=float(probe.stdout.strip())
    except ValueError:duration=0
    if 0.1<duration<120:break
  attempts.append({"attempt":attempt,"exit_code":p.returncode,"error_kind":"NoAudioReceived" if "NoAudioReceived" in p.stderr else "unusable_audio"})
  if attempt<3:time.sleep(attempt*2)
 else:
  if media.exists():media.unlink()
  partial.write_text(json.dumps({"completed_scenes":entries,"failed_scene":i,"failed_attempts":attempts,"publication_authorized":False},ensure_ascii=False,indent=2)+"\\n")
  raise RuntimeError(f"PRIVATE_TTS_SCENE_{i:02d}_FAILED_AFTER_3_ATTEMPTS")
 total+=duration;entries.append({"scene":i,"spoken_text":t,"duration_seconds":duration,"mp3_sha256":hashlib.sha256(media.read_bytes()).hexdigest(),"filename":media.name,"failed_attempts_before_success":attempts})
 partial.write_text(json.dumps({"completed_scenes":entries,"measured_completed_seconds":total,"publication_authorized":False,"complete":False},ensure_ascii=False,indent=2)+"\\n")
e={"contract":"M5-V3-PRIVATE-ACTUAL-TTS-PROOF-v1","target_date":s["target_date"],"source_sha256":s["source_sha256"],"voice":"zh-TW-YunJheNeural","rate":"+15%","scenes":entries,"measured_total_audio_seconds":total,"target_60_to_90_seconds_pass":60<=total<=90,"real_tts_generated":True,"timed_srt_generated":False,"mp4_generated":False,"private_media_proof_complete":False,"publication_authorized":False}
(out/"audio-proof.json").write_text(json.dumps(e,ensure_ascii=False,indent=2)+"\n")
if not e["target_60_to_90_seconds_pass"]:raise RuntimeError(f"ACTUAL_TTS_DURATION_OUT_OF_RANGE {total:.3f}s")
