#!/usr/bin/env python3
"""Construct a seven-scene, source-exact PRIVATE research preview from three retained Artifacts; no TTS."""
import hashlib,json,shutil,subprocess,sys
from pathlib import Path
plan=json.loads(Path(sys.argv[1]).read_text(encoding="utf-8")); roots=list(map(Path,sys.argv[2:5]));out=Path(sys.argv[5]);out.mkdir(parents=True,exist_ok=True)
assert plan["target_date"]=="20261008" and plan["publication_authorized"] is False and len(plan["scenes"])==7
def one(root,name):
 a=list(root.rglob(name));assert len(a)==1,(name,len(a));return a[0]
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def duration(p):
 z=subprocess.run(["ffprobe","-v","error","-show_entries","format=duration","-of","default=noprint_wrappers=1:nokey=1",str(p)],capture_output=True,text=True,check=True)
 v=float(z.stdout.strip());assert v>0;return v
m=json.loads(one(roots[0],"tts-manifest.json").read_text(encoding="utf-8"))
assert m["voice"]=="zh-TW-YunJheNeural" and m["rate"]=="+15%" and m["engine"]=="edge-tts" and len(m["scenes"])==5
six=json.loads(one(roots[1],"scene06-research-proof.json").read_text(encoding="utf-8"))
seven=json.loads(one(roots[2],"scene07-research-proof.json").read_text(encoding="utf-8"))
assert six["research_only"] and six["not_m5_media_proof"] and six["publication_authorized"] is False
assert seven["research_only"] and seven["not_m5_media_proof"] and seven["publication_authorized"] is False and seven["mode"]=="whole" and "word_boundaries" in seven["whole"]
files=[];events=[]
for i in range(1,8):
 text=plan["scenes"][i-1]["speech_text"]
 if i<=5:
  rec=m["scenes"][i-1];src=one(roots[0],f"{i:02}.mp3")
  assert rec["id"]==i and rec["spoken_text"]==text and rec["engine"]=="edge-tts" and rec["word_boundaries"]
  wb=rec["word_boundaries"];origin=38062405623
 elif i==6:
  src=one(roots[1],"scene06-research.mp3")
  assert six["source_sha256"]==hashlib.sha256(text.encode()).hexdigest() and "".join(r["text"] for r in six["records"])==text and sha(src)==six["scene06_sha256"]
  wb=six["mapped_word_boundaries"];origin=38076491234
 else:
  rec=seven["whole"];src=one(roots[2],"scene07-whole.mp3")
  assert seven["source_sha256"]==hashlib.sha256(text.encode()).hexdigest() and rec["text"]==text and sha(src)==rec["audio_sha256"]
  wb=rec["word_boundaries"];origin=38078900356
 assert wb
 dst=out/f"{i:02}.mp3";shutil.copyfile(src,dst)
 files.append(dict(id=i,source_run=origin,original_sha256=sha(src),copy_sha256=sha(dst),duration_seconds=duration(dst),source_exact=True,word_events=len(wb)))
 assert files[-1]["original_sha256"]==files[-1]["copy_sha256"]
total=sum(x["duration_seconds"] for x in files);assert 60<=total<=90
def stamp(sec):
 v=round(sec*1000);h,v=divmod(v,3600000);mi,v=divmod(v,60000);s,ms=divmod(v,1000);return f"{h:02}:{mi:02}:{s:02},{ms:03}"
cursor=0;blocks=[]
for i,r in enumerate(files,1):
 start=cursor;cursor+=r["duration_seconds"]
 blocks.append(f"{i}\n{stamp(start)} --> {stamp(cursor)}\n{plan['scenes'][i-1]['speech_text']}\n")
(out/"seven-scenes-research.zh-TW.srt").write_text("\n".join(blocks)+"\n",encoding="utf-8")
result=dict(status="SEVEN_SCENE_REVIEW_PACKAGE_NOT_SYNC_OR_MEDIA_PASS",scene_count=7,measured_audio_sum_seconds=round(total,6),duration_target_met=True,voice=m["voice"],rate=m["rate"],scene_files=files,srt_basis="seven cumulative ffprobe scene durations; not independent word/audio alignment",caption_full_source_exact=True,publication_authorized=False,subtitle_sync_certified=False,rendered_video_duration_verified=False,media_proof=False)
(out/"seven-scenes-review-proof.json").write_text(json.dumps(result,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
(out/"REVIEW.md").write_text("# PRIVATE seven-scene source review\n\nThe seven genuine saved MP3 files correspond to frozen M4 script and separate original research runs. The whole-scene SRT has exact narration text with estimated cumulative scene timing; it is NOT a word-aligned or independently certified subtitle file. Inspect spoken source and scene06 seams, align subtitles, then render and measure video separately. No YouTube/publication authorized.\n",encoding="utf-8")
print(json.dumps(dict(status=result["status"],scene_count=7,duration_seconds=result["measured_audio_sum_seconds"],publication_authorized=False),ensure_ascii=False))
