#!/usr/bin/env python3
"""V3 six-scene diagnostic video: real audio, sentence captions, claim-linked scene slates.
NOT a completed M8VIS card/VTuber or publication render.
"""
import hashlib,json,pathlib,subprocess,sys
root=pathlib.Path(sys.argv[1]); out=root/"diagnostic-preview";out.mkdir(exist_ok=True)
bridge=json.loads((root/"media-bridge.json").read_text())
handoff=json.loads((root/"m8vis-timing-handoff.json").read_text())
caption=json.loads((root/"research-caption-proof.json").read_text())
assert bridge["publication_authorized"] is False and handoff["render_authorized"] is False
assert bridge["total_seconds"]==handoff["total_seconds"]==caption["total_seconds"]
sentence_count=len(bridge["sentences"])
assert sentence_count>0 and sentence_count==caption["sentence_count"] and len(handoff["scenes"])==6
assert hashlib.sha256((root/"research-sentence-captions.srt").read_bytes()).hexdigest()==caption["srt_sha256"]
def run(args): subprocess.run(args,check=True)
inputs=[]
for row in bridge["sentences"]:
 p=root/"audio"/row["audio_file"]
 assert p.is_file() and hashlib.sha256(p.read_bytes()).hexdigest()==row["audio_sha256"]
 inputs+=["-i",str(p)]
filters="".join(f"[{i}:a:0]" for i in range(sentence_count))+f"concat=n={sentence_count}:v=0:a=1,aresample=48000[a]"
wav=out/"continuous.wav"
run(["ffmpeg","-hide_banner","-loglevel","error","-y",*inputs,"-filter_complex",filters,"-map","[a]","-c:a","pcm_s16le",str(wav)])
def duration(p):
 d=subprocess.check_output(["ffprobe","-v","error","-show_entries","format=duration","-of","default=noprint_wrappers=1:nokey=1",str(p)],text=True)
 return float(d.strip())
actual=duration(wav)
assert abs(actual-bridge["total_seconds"])<1.5,("AUDIO_TIMELINE_DRIFT",actual,bridge["total_seconds"])
# Diagnostic only: neutral slate, scene names and external verified SRT; no claim of M8VIS asset integration.
mp4=out/"v3-six-scene-diagnostic-1080p.mp4"
run(["ffmpeg","-hide_banner","-loglevel","error","-y","-f","lavfi","-i","color=c=0x18232e:s=1920x1080:r=30","-i",str(wav),"-map","0:v:0","-map","1:a:0","-vf","format=yuv420p","-c:v","libx264","-preset","ultrafast","-crf","32","-c:a","aac","-b:a","128k","-shortest",str(mp4)])
video=duration(mp4);assert abs(video-actual)<.2
result={"contract":"AI_V3_DIAGNOSTIC_RENDER_NOT_M8VIS_PASS","target_date":"20261008","scene_count":6,"sentence_count":sentence_count,"timeline_seconds":bridge["total_seconds"],"decoded_audio_seconds":actual,"video_seconds":video,"video_sha256":hashlib.sha256(mp4.read_bytes()).hexdigest(),"subtitle_file":"research-sentence-captions.srt","subtitle_burned_in":False,"m8vis_cards_integrated":False,"vtuber_integrated":False,"occlusion_verified":False,"publication_authorized":False}
(out/"diagnostic-render-proof.json").write_text(json.dumps(result,ensure_ascii=False,indent=2)+"\n")
print(f"V3_DIAGNOSTIC_RENDER_PASS scenes=6 sentences={sentence_count} video_seconds="+str(round(video,3))+" m8vis_certified=false no_publish=true")
