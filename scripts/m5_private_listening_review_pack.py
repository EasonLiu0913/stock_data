#!/usr/bin/env python3
import hashlib,json,re,shutil,sys
from pathlib import Path
plan=json.loads(Path(sys.argv[1]).read_text());render=Path(sys.argv[2]);pcm=Path(sys.argv[3]);out=Path(sys.argv[4]);out.mkdir(parents=True,exist_ok=True)
proof=json.loads((render/"private-render-proof.json").read_text());timing=json.loads((pcm/"pcm-caption-proof.json").read_text())
assert len(plan["scenes"])==7 and plan["publication_authorized"] is False and proof["publication_authorized"] is False and timing["publication_authorized"] is False
movie=render/"seven-scenes-private-1080p.mp4"
assert hashlib.sha256(movie.read_bytes()).hexdigest()==proof["video_sha256"]
shutil.copyfile(movie,out/"private-review.mp4")
shutil.copyfile(pcm/"seven-scenes-pcm-boundary-review.zh-TW.srt",out/"scene-review.zh-TW.srt")
items=[]
for i,(scene,interval) in enumerate(zip(plan["scenes"],timing["scene_ranges"]),1):
 assert interval["scene"]==i
 original=scene["speech_text"];phrases=re.findall(r"[^，、；。！？]+[，、；。！？]?",original)
 assert "".join(phrases)==original
 items.append(dict(scene=i,text=original,phrases=phrases,start_seconds=interval["start_sample"]/48000,end_seconds=interval["end_sample"]/48000,reviewed=False))
report=dict(status="PRIVATE_HUMAN_LISTENING_PACK_PREPARED_NOT_REVIEWED",items=items,source_video_sha256=proof["video_sha256"],human_listening_pass=False,subtitle_sync_certified=False,publication_authorized=False)
(out/"review.json").write_text(json.dumps(report,ensure_ascii=False,indent=2)+"\n")
(out/"README.md").write_text("# Seven-scene private listening review\n\nPlay private-review.mp4 and compare each scene against review.json and scene-review.zh-TW.srt. The phrases are text-only review units, NOT timed word captions. No automatic listening or subtitle sync pass. No publishing.\n")
print(json.dumps(dict(status=report["status"],scenes=len(items),phrases=sum(len(x["phrases"]) for x in items),publication_authorized=False)))
