#!/usr/bin/env python3
"""Independent offline render-only assertions; no upload and no OCR."""
import hashlib,json,re,subprocess,sys
from io import BytesIO
from pathlib import Path
from PIL import Image

date=sys.argv[1]
root=Path("output/daily-gainers-video")/date
plan=json.loads((root/"plan.json").read_text())
timing=json.loads((root/"render-timings.json").read_text())
qa=json.loads((root/"qa.json").read_text())
proof=json.loads((root/"burned-caption-proof.json").read_text())
srt=(root/f"daily-gainers-{date}.zh-TW.srt").read_text()
video=root/f"daily-gainers-{date}.mp4"
pre=root/f"daily-gainers-{date}.pre-burn.mp4"
assert plan["target_date"]==date and qa["target_date"]==date
scenes=plan["scenes"]
assert len(scenes)==qa["scene_count"]==len(timing["scenes"])
assert scenes[0]["scene_type"]=="market_opening"
assert scenes[-1]["scene_type"] in ("summary","closing_summary")
stockscenes=[s for s in scenes if s["scene_type"]=="stock_list"]
codes=[str(c) for s in stockscenes for c in s["stock_codes"]]
raw=json.loads((Path("data_daily_gain_over_5")/f"{date}.json").read_text())
assert raw["target_date"]==date
assert len(codes)==len(set(codes))==raw["stock_count"]
assert not scenes[0]["stock_codes"] and not scenes[-1]["stock_codes"]
assert 30<=timing["scenes"][0]["duration_seconds"]<=90
assert proof["status"]=="BURN_EXECUTED_VISUAL_QA_PENDING"
assert video.exists() and pre.exists()
assert hashlib.sha256(video.read_bytes()).hexdigest()==proof["mp4_sha256"]
assert hashlib.sha256((root/f"daily-gainers-{date}.zh-TW.srt").read_bytes()).hexdigest()==proof["srt_sha256"]
assert "大家好，歡迎來到 TAIWAN STOCK" in scenes[0]["narration"]
assert "追蹤資金，解讀行情" in scenes[0]["narration"]
assert "錢在哪，我們就在哪" in scenes[0]["narration"]
assert "那麼我們開始囉" in scenes[0]["narration"]
times=[]
for block in re.split(r"\n\s*\n",srt.strip()):
 m=re.search(r"(\d\d):(\d\d):(\d\d),(\d\d\d)\s*-->\s*(\d\d):(\d\d):(\d\d),(\d\d\d)",block)
 if m:
  v=[int(x) for x in m.groups()]
  times.append((v[0]*3600+v[1]*60+v[2]+v[3]/1000,v[4]*3600+v[5]*60+v[6]+v[7]/1000))
assert times and times[-1][1]<=qa["duration_seconds"]+0.6
def frame(fp,sec):
 p=subprocess.run(["ffmpeg","-v","error","-ss",str(sec),"-i",str(fp),"-vf","crop=1200:190:130:840","-frames:v","1","-f","image2pipe","-vcodec","png","-"],capture_output=True,check=True)
 return Image.open(BytesIO(p.stdout)).convert("RGB")
samples=[("opening",times[0]),("closing",times[-1])]
evidence=[]
for scene_name,(start,end) in samples:
 sec=(start+end)/2
 a=frame(pre,sec)
 b=frame(video,sec)
 p1=a.load();p2=b.load()
 # Detect material painted glyphs, excluding small re-encoding noise.
 changed=0
 for y in range(0,a.height,2):
  for x in range(0,a.width,2):
   if sum(abs(u-v) for u,v in zip(p1[x,y],p2[x,y]))>=120:
    changed+=1
 ratio=changed/((a.width//2)*(a.height//2))
 evidence.append({"scene":scene_name,"second":round(sec,2),"changed_pixels_fraction":round(ratio,5)})
 if ratio<0.001:
  raise AssertionError(f"No convincing burned-caption pixel difference in {scene_name}: {ratio}")
 # Compare the *whole* frame against the original pre-burn frame.
 # The timeline ends at y=928. Captions must be confined below that line;
 # mere detection of burned pixels in a lower crop is not visual QA.
 def full_frame(fp):
  cmd=["ffmpeg","-v","error","-ss",str(sec),"-i",str(fp),"-frames:v","1",
       "-f","image2pipe","-vcodec","png","-"]
  p=subprocess.run(cmd,capture_output=True,check=True)
  return Image.open(BytesIO(p.stdout)).convert("RGB")
 full_before=full_frame(pre)
 full_after=full_frame(video)
 px1,px2=full_before.load(),full_after.load()
 unsafe=0
 glyph_x=[]
 glyph_y=[]
 for yy in range(565,1060,3):
  for xx in range(190,1500,3):
   if sum(abs(u-v) for u,v in zip(px1[xx,yy],px2[xx,yy]))>=170:
    glyph_x.append(xx)
    glyph_y.append(yy)
    if yy<930:
     unsafe+=1
 if not glyph_y:
  raise AssertionError(f"No caption glyphs independently detected for {scene_name}")
 if unsafe>250:
  raise AssertionError(f"Burned subtitles overlap dashboard/timeline in {scene_name}: {unsafe} high-contrast pixels above safe baseline")
 caption_center=(min(glyph_x)+max(glyph_x))/2
 if abs(caption_center-960)>150:
  raise AssertionError(f"Burned caption horizontal centering failed in {scene_name}: {caption_center}")
 evidence[-1].update({"unsafe_pixels_above_y930":unsafe,
                     "caption_bbox":[min(glyph_x),min(glyph_y),max(glyph_x),max(glyph_y)],
                     "caption_center_x":caption_center})
 report=root/"render-only-visual-check.json"
report.write_text(json.dumps({"target_date":date,"status":"PASS_STATIC_AND_PIXEL_DELTA_VISUAL_REVIEW_PENDING","samples":evidence,"publication_authorized":False},ensure_ascii=False,indent=2)+"\n")
print(report.read_text())
