#!/usr/bin/env python3
"""Offline 1080p private seven-scene render from verified saved audio; no external publication."""
import hashlib,json,subprocess,sys
from pathlib import Path
root=Path(sys.argv[1]);out=Path(sys.argv[2]);out.mkdir(parents=True,exist_ok=True)
proof=json.loads((root/"seven-scenes-review-proof.json").read_text(encoding="utf-8"))
assert proof["status"]=="SEVEN_SCENE_REVIEW_PACKAGE_NOT_SYNC_OR_MEDIA_PASS" and proof["publication_authorized"] is False and proof["scene_count"]==7 and proof["subtitle_sync_certified"] is False
def run(cmd):return subprocess.run(cmd,capture_output=True,text=True,check=True)
def probe(f):
 return json.loads(run(["ffprobe","-v","error","-show_entries","format=duration:stream=codec_name,width,height,sample_rate","-of","json",str(f)]).stdout)
for rec in proof["scene_files"]:
 f=root/f"{rec['id']:02}.mp3";assert f.is_file() and hashlib.sha256(f.read_bytes()).hexdigest()==rec["copy_sha256"]
 assert abs(float(probe(f)["format"]["duration"])-rec["duration_seconds"])<.02
# Continuous decoded audio samples into WAV prevent accidental scene gaps from MP3 packet timestamp concatenation.
inputs=[]
for i in range(1,8):inputs+=["-i",str(root/f"{i:02}.mp3")]
labels="".join(f"[{i}:a:0]" for i in range(7))
wav=out/"seven-scenes.wav"
run(["ffmpeg","-hide_banner","-loglevel","error","-y",*inputs,"-filter_complex",labels+"concat=n=7:v=0:a=1,aresample=48000[a]","-map","[a]","-c:a","pcm_s16le",str(wav)])
audio_seconds=float(probe(wav)["format"]["duration"]);assert 60<=audio_seconds<=90
mp4=out/"seven-scenes-private-1080p.mp4"
# Neutral private research slate only; keep captions as separate review SRT (no false visual sync claims).
run(["ffmpeg","-hide_banner","-loglevel","error","-y","-f","lavfi","-i","color=c=0x18232e:s=1920x1080:r=30","-i",str(wav),"-map","0:v:0","-map","1:a:0","-vf","format=yuv420p","-c:v","libx264","-preset","veryfast","-crf","29","-c:a","aac","-b:a","160k","-shortest","-movflags","+faststart",str(mp4)])
p=probe(mp4);streams=p["streams"];assert any(x.get("codec_name")=="h264" and x.get("width")==1920 and x.get("height")==1080 for x in streams) and any(x.get("codec_name")=="aac" for x in streams)
vseconds=float(p["format"]["duration"]);assert 60<=vseconds<=90 and abs(vseconds-audio_seconds)<.15
result=dict(status="PRIVATE_1080P_RENDER_MEASURED_NOT_CAPTION_SYNC_OR_MEDIA_PASS",scene_count=7,source_audio_seconds=proof["measured_audio_sum_seconds"],decoded_concat_seconds=audio_seconds,rendered_video_seconds=vseconds,width=1920,height=1080,audio_codec="aac",video_codec="h264",video_sha256=hashlib.sha256(mp4.read_bytes()).hexdigest(),publication_authorized=False,subtitle_sync_certified=False,human_listening_certified=False,media_proof=False)
(out/"private-render-proof.json").write_text(json.dumps(result,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
(out/"REVIEW.md").write_text("# PRIVATE 1080p M5 render\n\nNeutral slate video with genuine seven saved scene MP3 files, continuous decoded audio. The review SRT remains separate and is NOT independently audio-word synchronized. No publication authorization, no YouTube.\n",encoding="utf-8")
print(json.dumps(result,ensure_ascii=False))
