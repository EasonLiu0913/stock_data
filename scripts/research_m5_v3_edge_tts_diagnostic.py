#!/usr/bin/env python3
"""Bounded private service probe; output contains no tokens, URLs, headers or audio transcript."""
import hashlib,json,pathlib,subprocess,sys,time
source=json.loads(pathlib.Path(sys.argv[1]).read_text());out=pathlib.Path(sys.argv[2]);out.mkdir(parents=True,exist_ok=True)
assert source["target_date"]=="20261008" and source["publication_authorized"] is False
assert source["tts_authorized"] is False and source["video_authorized"] is False
phrase=source["scenes"][0]["speech_text"];assert phrase=="大家好，歡迎來到 TAIWAN STOCK！"
e={"contract":"M5-V3-PRIVATE-EDGE-TTS-SERVICE-DIAGNOSTIC-v1","date":"20261008","voice":"zh-TW-YunJheNeural","rate":"+15%","sample_sha256":hashlib.sha256(phrase.encode()).hexdigest(),"probes":[],"publication_authorized":False,"selected_version":None}
for version in ("7.2.7","7.2.8"):
 record={"version":version,"success":False}
 install=subprocess.run([sys.executable,"-m","pip","install","--disable-pip-version-check",f"edge-tts=={version}"],capture_output=True,text=True,timeout=90)
 record["install_ok"]=install.returncode==0
 if record["install_ok"]:
  media=out/f"probe-{version}.mp3"
  try:
   start=time.monotonic()
   p=subprocess.run(["edge-tts","--voice","zh-TW-YunJheNeural","--rate=+15%","--text",phrase,"--write-media",str(media)],capture_output=True,text=True,timeout=35)
   record["elapsed_seconds"]=round(time.monotonic()-start,3)
   record["exit_code"]=p.returncode
   record["error_kind"]=next((v for v in ("NoAudioReceived","WSServerHandshakeError","ClientConnectorError","TimeoutError","WebSocketError") if v in p.stderr), "other" if p.returncode else None)
   record["bytes"]=media.stat().st_size if media.exists() else 0
   if p.returncode==0 and record["bytes"]>100:
    d=subprocess.run(["ffprobe","-v","error","-show_entries","format=duration","-of","default=noprint_wrappers=1:nokey=1",str(media)],capture_output=True,text=True,timeout=15)
    record["duration_seconds"]=float(d.stdout.strip()) if d.returncode==0 else None
    record["success"]=record["duration_seconds"] is not None and record["duration_seconds"]>0
    if record["success"]:record["sha256"]=hashlib.sha256(media.read_bytes()).hexdigest()
  except subprocess.TimeoutExpired:
   record["error_kind"]="timeout"
 e["probes"].append(record)
 (out/"diagnostic.json").write_text(json.dumps(e,ensure_ascii=False,indent=2)+"\n")
 if record["success"]:
  e["selected_version"]=version
  (out/"selected-version.txt").write_text(version+"\n")
  break
(out/"diagnostic.json").write_text(json.dumps(e,ensure_ascii=False,indent=2)+"\n")
if not e["selected_version"]:raise RuntimeError("PRIVATE_EDGE_TTS_PROBES_NO_AUDIO: see retained diagnostic.json")
