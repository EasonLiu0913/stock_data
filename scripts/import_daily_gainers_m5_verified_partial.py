#!/usr/bin/env python3
"""Fail-closed import of one known M5 partial Artifact (not a generic cache)."""
import hashlib,json,subprocess,sys,shutil
from pathlib import Path
from daily_gainers_spoken_text import normalize_spoken_text
EXPECTED={
"plan.json":"91c896cd21e24e04fe7734e89ca1817811bceecb03d476d8a88d126409d4baa2",
"tts-manifest.json":"9d08a4e26888ef8b3da9eff52947e469454e093a210350ebb8e5188b3704100c",
"audio/01.mp3":"382b666246710f94b5f283980da4ce7762565a17ee5d3e82d6c7509878a252c3",
"audio/02.mp3":"66d15b0af5d9e24a24f894d0f296eb1ab8b9c99cfb1cd927423aa76da2b99836",
"audio/03.mp3":"2029a89d82634f89e4c4242915cfcbab462e9b51229cbdb2e45057be89144132",
"audio/04.mp3":"e9c5525622471807a149791396b2f328642ed57f92dbdf3300ddee331f9fddf5",
"audio/05.mp3":"25838ca6fb3681bd9e1e81e1fa42ac2cb37ae1061c35cb0149db31408d75886f"}
def digest(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def main(seed,dest):
 seed=Path(seed);dest=Path(dest)
 if sorted(str(p.relative_to(seed)) for p in seed.rglob("*") if p.is_file())!=sorted(EXPECTED):raise ValueError("SEED_MEMBERS_DRIFT")
 for name,h in EXPECTED.items():
  if digest(seed/name)!=h:raise ValueError("SEED_SHA_DRIFT:"+name)
 if digest(seed/"plan.json")!=digest(dest/"plan.json"):raise ValueError("FROZEN_PLAN_DRIFT")
 plan=json.loads((dest/"plan.json").read_text());m=json.loads((seed/"tts-manifest.json").read_text())
 if plan.get("schema_version")!=2 or plan.get("target_date")!="20261008" or plan.get("publication_authorized") is not False or len(plan["scenes"])!=7:raise ValueError("PLAN_GATE")
 if (m.get("voice"),m.get("rate"),m.get("engine"))!=("zh-TW-YunJheNeural","+15%","edge-tts") or len(m["scenes"])!=5:raise ValueError("VOICE_OR_COUNT_DRIFT")
 for i,r in enumerate(m["scenes"],1):
  if r["id"]!=i or r["engine"]!="edge-tts" or r["spoken_text"]!=normalize_spoken_text(plan["scenes"][i-1]["speech_text"]) or not r.get("word_boundaries"):raise ValueError("SCENE_PARITY_"+str(i))
  if len((seed/f"audio/{i:02}.mp3").read_bytes())<1000:raise ValueError("AUDIO_TOO_SMALL")
  p=subprocess.run(["ffprobe","-v","error","-show_entries","format=duration","-of","default=noprint_wrappers=1:nokey=1",str(seed/f"audio/{i:02}.mp3")],capture_output=True,text=True)
  if p.returncode or float(p.stdout.strip())<=0:raise ValueError("UNREADABLE_AUDIO_"+str(i))
 for i in range(1,6):shutil.copyfile(seed/f"audio/{i:02}.mp3",dest/f"audio/{i:02}.mp3")
 (dest/"tts-manifest.json").write_text(json.dumps(m,ensure_ascii=False,indent=2)+"\n")
 (dest/"m5-verified-resume.json").write_text(json.dumps({"source_run":38062405623,"source_artifact_id":11674007334,"scene_count":5,"files":EXPECTED,"publication_authorized":False},indent=2)+"\n")
 print("VERIFIED_M5_RESUME 5/7 from exact historical partial Artifact",flush=True)
if __name__=="__main__":main(sys.argv[1],sys.argv[2])
