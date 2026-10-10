#!/usr/bin/env python3
"""Research-only PCM scene-boundary subtitles against retained rendered WAV/MP4; not speech alignment."""
import hashlib,json,subprocess,sys
from pathlib import Path
src=Path(sys.argv[1]);render=Path(sys.argv[2]);out=Path(sys.argv[3]);out.mkdir(parents=True,exist_ok=True)
proof=json.loads((src/"seven-scenes-review-proof.json").read_text(encoding="utf-8"))
video=json.loads((render/"private-render-proof.json").read_text(encoding="utf-8"))
assert proof["scene_count"]==7 and proof["publication_authorized"] is False and video["status"]=="PRIVATE_1080P_RENDER_MEASURED_NOT_CAPTION_SYNC_OR_MEDIA_PASS" and video["publication_authorized"] is False
mp4=render/"seven-scenes-private-1080p.mp4";wav=render/"seven-scenes.wav"
assert hashlib.sha256(mp4.read_bytes()).hexdigest()==video["video_sha256"]
def call(cmd):return subprocess.run(cmd,capture_output=True,check=True).stdout
def pcm(p):
 raw=call(["ffmpeg","-hide_banner","-loglevel","error","-i",str(p),"-map","0:a:0","-f","s16le","-ac","1","-ar","48000","-"])
 assert len(raw)%2==0 and raw
 return len(raw)//2
# Exact original frozen script is also verified by the Node M5 SRT verifier on generated SRT.
import re
srt=(src/"seven-scenes-research.zh-TW.srt").read_text(encoding="utf-8")
blocks=[b.splitlines() for b in re.split(r"\n\s*\n",srt.strip())]
assert len(blocks)==7 and all(int(b[0])==i and len(b)>=3 for i,b in enumerate(blocks,1))
counts=[]
for i,rec in enumerate(proof["scene_files"],1):
 f=src/f"{i:02}.mp3"
 assert hashlib.sha256(f.read_bytes()).hexdigest()==rec["copy_sha256"]
 counts.append(pcm(f))
wav_count=pcm(wav);total=sum(counts)
# FFmpeg's single concat+resample can differ by a handful of samples from seven separate decoding/resampling calls.
assert abs(total-wav_count)<=480,(total,wav_count)
def stamp(samples):
 ms=round(samples*1000/48000);h,ms=divmod(ms,3600000);m,ms=divmod(ms,60000);s,ms=divmod(ms,1000);return f"{h:02}:{m:02}:{s:02},{ms:03}"
# Scale boundaries in a bounded way to reflect the final decoded continuous WAV's actual sample count.
cursor=0;new=[];ranges=[]
for i,(b,n) in enumerate(zip(blocks,counts),1):
 start=round(cursor*wav_count/total);cursor+=n;end=round(cursor*wav_count/total)
 assert end>start
 ranges.append(dict(scene=i,start_sample=start,end_sample=end,source_decoded_samples=n))
 new.append(f"{i}\n{stamp(start)} --> {stamp(end)}\n{''.join(b[2:])}\n")
final=out/"seven-scenes-pcm-boundary-review.zh-TW.srt";final.write_text("\n".join(new)+"\n",encoding="utf-8")
result=dict(status="PCM_SCENE_BOUNDARY_REVIEW_NOT_INDEPENDENT_SPEECH_SYNC",source_date="20261008",scene_count=7,rate=48000,individual_decoded_samples=counts,individual_sum=total,continuous_wav_samples=wav_count,delta_samples=wav_count-total,duration_seconds=wav_count/48000,rendered_video_seconds=video["rendered_video_seconds"],scene_ranges=ranges,source_caption_exact=True,publication_authorized=False,word_alignment_certified=False,subtitle_sync_certified=False,perceptual_listening_certified=False,media_proof=False)
assert 60<=result["duration_seconds"]<=90 and abs(result["duration_seconds"]-video["rendered_video_seconds"])<.15
(out/"pcm-caption-proof.json").write_text(json.dumps(result,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
print(json.dumps(dict(status=result["status"],duration_seconds=result["duration_seconds"],delta_samples=result["delta_samples"],scene_count=7,publication_authorized=False),ensure_ascii=False))
