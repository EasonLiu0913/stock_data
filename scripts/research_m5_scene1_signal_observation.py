#!/usr/bin/env python3
"""M5 scene-one signal observations ONLY, not a speech recognizer or aligner."""
import argparse,hashlib,json,pathlib,subprocess,struct,zipfile,math
AUDIO_ZIP="b29ab56784279c000a73e5174736c9d3d4eea7f2b330ce7d69f1919cdaee7a2a"
SCENE1="a84daf97cb8036d78d942d734fb0b9b4d0b0e7c45164d48d5bdb57e50c6f26aa"
def sha(b):return hashlib.sha256(b).hexdigest()
def main():
 p=argparse.ArgumentParser();p.add_argument("--audio-zip",required=True);p.add_argument("--output",required=True);a=p.parse_args()
 out=pathlib.Path(a.output);out.parent.mkdir(parents=True,exist_ok=True)
 report={"contract":"M5-SCENE1-SIGNAL-OBSERVATION-v1","publication_authorized":False,"pronunciation_approved":False,"acoustic_sentence_boundary_verified":False,"forced_alignment_executed":False,"english_actual_spoken_reading_verified":False,"auditory_review_performed":False,"word_boundary_claims":[],"observed_spoken_reading":None,"blockers":[]}
 try:
  b=pathlib.Path(a.audio_zip).read_bytes()
  if sha(b)!=AUDIO_ZIP:raise ValueError("immutable audio artifact ZIP SHA mismatch")
  with zipfile.ZipFile(a.audio_zip) as z:
   scene=z.read("audio/01.mp3");source=json.loads(z.read("source.json"))
  if sha(scene)!=SCENE1:raise ValueError("scene 01 original MP3 SHA mismatch")
  if source["scenes"][0]["speech_text"]!="大家好，歡迎來到 TAIWAN STOCK！":raise ValueError("fixed opening mismatch")
  proc=subprocess.run(["ffmpeg","-v","error","-i","pipe:0","-ac","1","-ar","16000","-f","s16le","pipe:1"],input=scene,capture_output=True,check=True)
  pcm=proc.stdout
  if len(pcm)%2:raise ValueError("unaligned PCM")
  n=len(pcm)//2;duration=n/16000
  if abs(duration-2.880)>0.025:raise ValueError("decoded duration differs from source")
  values=struct.unpack("<"+str(n)+"h",pcm)
  windows=[];frame=1600
  for i in range(0,n,frame):
   v=values[i:i+frame];rms=math.sqrt(sum(x*x for x in v)/len(v))/32768
   windows.append({"start_s":round(i/16000,4),"end_s":round((i+len(v))/16000,4),"rms":round(rms,7)})
  report.update({"source_zip_sha256":AUDIO_ZIP,"original_scene01_mp3_sha256":SCENE1,"source_text_exact":source["scenes"][0]["speech_text"],"method":"ffmpeg decode to temporary in-memory mono 16kHz s16le; nonlexical 100ms signal RMS; no audio edits or ASR","ffmpeg_decode_sample_rate_hz":16000,"decoded_duration_s":round(duration,6),"observed_energy_windows":windows,"source_text_english_offsets":[{"token":"TAIWAN","start":9,"end":15},{"token":"STOCK","start":16,"end":21}],"english_acoustic_time_intervals":None,"blockers":["Energy is not word identity or phoneme identification","No independent listening/transcription confirmation of TAIWAN STOCK spoken realization","Do not infer word boundaries from proportional character timings"]})
 except Exception as e:report["blockers"].append("BLOCKED: "+str(e))
 out.write_text(json.dumps(report,ensure_ascii=False,indent=2)+"\n")
 if any(s.startswith("BLOCKED:") for s in report["blockers"]):raise SystemExit(2)
 print("SCENE1_ORIGINAL_SIGNAL_OBSERVED english_reading_unverified alignment=false")
if __name__=="__main__":main()
