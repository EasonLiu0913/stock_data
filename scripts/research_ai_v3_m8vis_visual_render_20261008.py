#!/usr/bin/env python3
"""Research-only six-scene visual MP4 with heuristic sentence-timed mouth poses; not verified lip-sync."""
import hashlib,json,pathlib,subprocess,sys
from PIL import Image,ImageDraw,ImageFont
root=pathlib.Path(sys.argv[1]); repo=pathlib.Path(sys.argv[2]); out=root/"m8vis-visual-preview";out.mkdir(exist_ok=True)
layout=json.loads((root/"m8vis-research-layout.json").read_text())
bridge=json.loads((root/"media-bridge.json").read_text())
source=json.loads((root/"source.json").read_text())
assert layout["publication_authorized"] is False and layout["editorial_complete"] is False
assert bridge["publication_authorized"] is False and len(layout["cards"])==6
assert layout["research_master_sha256"]==source["research_master_sha256"]==bridge["research_master_sha256"]
fontpath="/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc"
assert pathlib.Path(fontpath).exists(),"CJK_FONT_REQUIRED"
font=lambda n:ImageFont.truetype(fontpath,n)
# Use verified original sprite, not the corrupt derived presenter WebP.
sprite=repo/"assets/daily-gainers-vtuber-sprite.webp"
assert sprite.is_file(),"ORIGINAL_SPRITE_REQUIRED"
decoded=out/"original-sprite-decoded.png"
attempt=subprocess.run(["ffmpeg","-hide_banner","-loglevel","error","-y","-i",str(sprite),"-frames:v","1",str(decoded)],capture_output=True,text=True)
assert attempt.returncode==0 and decoded.is_file() and decoded.stat().st_size>0,("ORIGINAL_SPRITE_DECODE_FAILED",attempt.stderr[-500:])
full=Image.open(decoded).convert("RGBA")
assert full.size==(4096,1536),("SPRITE_DIMENSION_DRIFT",full.size)
# Original sprite is four FULL-HEIGHT 1024x1536 columns, not a 4x2 grid.
poses={}
for index,name in enumerate(("closed","small","o","wide")):
 pose=full.crop((index*1024,0,(index+1)*1024,1536))
 assert pose.getbbox() is not None,("EMPTY_PRESENTER_POSE",name)
 pose.thumbnail((350,470))
 pose.save(out/f"presenter-{name}.png")
 poses[name]=pose
assert len({p.size for p in poses.values()})==1,"PRESENTER_POSE_SIZE_DRIFT"
labels={"opening":"TAIWAN STOCK","market":"上市市場總覽","6672":"騰輝電子-KY（6672）","2305":"全友（2305）","1301":"台塑（1301）","conclusion":"今日重點整理"}
zones=layout["zones"]
def rect(d,z,fill,outline=None):
 x,y,w,h=z;d.rounded_rectangle((x,y,x+w,y+h),radius=24,fill=fill,outline=outline,width=3)
for i,(card,part) in enumerate(zip(layout["cards"],source["media_input"])):
 assert card["scene"]==part["id"] and card["claim_ids"]==part["card_claim_ids"]
 im=Image.new("RGBA",(1920,1080),"#172331");d=ImageDraw.Draw(im)
 d.text((110,55),"TAIWAN STOCK  /  2026.10.08",font=font(30),fill="#e9bb77")
 d.text((110,115),labels[card["scene"]],font=font(67),fill="#ffffff")
 rect(d,zones["card_area"],"#26384a","#56718a")
 # The card content is sourced verbatim from the same narration/caption source, not reconstructed figures.
 x,y,w,h=zones["card_area"]
 lines=part["caption_sentences"]
 for j,line in enumerate(lines[:5]):
  # Fit into bounded card width, preserve complete text by wrapping into multiple lines.
  size=31 if len(lines)>3 else 37;f=font(size)
  maxw=w-110; chunks=[];cur=""
  for ch in line:
   if d.textbbox((0,0),cur+ch,font=f)[2]>maxw and cur:chunks.append(cur);cur=ch
   else:cur+=ch
  if cur:chunks.append(cur)
  assert len(chunks)<=2,("CARD_TEXT_OVERFLOW",card["scene"],j)
  yy=y+38+j*(90 if len(lines)>3 else 150)
  for k,ch in enumerate(chunks):d.text((x+48,yy+k*size*1.15),ch,font=f,fill="#f2f5f8")
 px,py,pw,ph=zones["presenter_reserved"]
  assert poses["closed"].width<=pw and poses["closed"].height<=ph,"PRESENTER_RESERVED_ZONE_OVERFLOW"
  avatar_x=px+(pw-poses["closed"].width)//2;avatar_y=py+ph-poses["closed"].height
 rect(d,zones["subtitle_reserved"],"#26384a")
 # Keep the SRT burn-in zone empty: placeholder text would overlap real captions.
 rect(d,zones["progress_reserved"],"#26384a")
 for j in range(6):
  xx=120+j*285;d.rounded_rectangle((xx,996,xx+255,1009),radius=5,fill="#e9bb77" if j<=i else "#627387")
 d.text((120,1015),f"{i+1}/6  ·  研究預覽｜財經內容尚未完成編輯驗證",font=font(24),fill="#ffffff")
 im.convert("RGB").save(out/f"scene-{i+1:02}.png")
# Audio-derived sentence boundaries are verified by the bridge. Mouth pose cycles are
# explicitly heuristic, NOT phoneme alignment or a claim of verified lip-sync.
audio=root/"diagnostic-preview/continuous.wav";assert audio.is_file()
srt=root/"research-sentence-captions.srt";assert srt.is_file()
assert len(bridge["sentences"])==21 and bridge["total_seconds"]>0
concat=out/"scenes.ffconcat"
rows=["ffconcat version 1.0"]
for i,c in enumerate(layout["cards"]):
 rows.extend([f"file 'scene-{i+1:02}.png'",f"duration {c['end_seconds']-c['start_seconds']:.3f}"])
rows.append("file 'scene-06.png'");concat.write_text("\n".join(rows)+"\n")
# Keep the closed mouth visible between active intervals; switch whole transparent
# presenter columns on top of it, so the first original sprite column is never lost.
intervals={name:[] for name in ("small","o","wide")}
for sentence in bridge["sentences"]:
 begin=float(sentence["start_seconds"]);end=float(sentence["end_seconds"])
 assert end>begin>=0 and end<=bridge["total_seconds"]+0.01
 text=sentence["spoken_text"]
 assert text.strip()
 t=begin;cycle=("small","wide","small","o")
 while t+0.04<end:
  pose=cycle[int((t-begin)/0.16)%len(cycle)]
  stop=min(t+0.16,end)
  intervals[pose].append((t,stop))
  t=stop
assert all(intervals.values()),"MOUTH_MOTION_INTERVALS_REQUIRED"
def enabled(name):
 # FFmpeg expression commas are escaped inside filtergraph option values.
 return "+".join(f"between(t\\,{a:.3f}\\,{b:.3f})" for a,b in intervals[name])
mp4=out/"m8vis-six-scene-heuristic-mouth-research.mp4"
sub=str(srt).replace("\\\\","\\\\\\\\").replace(":","\\\\:")
inputs=["-safe","0","-f","concat","-i",str(concat),"-i",str(audio)]
for name in ("closed","small","o","wide"):
 inputs+=["-loop","1","-framerate","15","-i",str(out/f"presenter-{name}.png")]
filters=[f"[0:v]fps=15,format=rgba[base]",
 f"[base][2:v]overlay={avatar_x}:{avatar_y}:shortest=1:format=auto[v0]"]
for i,name in enumerate(("small","o","wide")):
 filters.append(f"[v{i}][{i+3}:v]overlay={avatar_x}:{avatar_y}:enable='{enabled(name)}':shortest=1:format=auto[v{i+1}]")
filters.append(f"[v3]subtitles='{sub}':force_style='FontName=Noto Sans CJK TC,FontSize=13,Alignment=2,MarginV=35,Outline=1,Shadow=0',format=yuv420p[vout]")
subprocess.run(["ffmpeg","-hide_banner","-loglevel","error","-y",*inputs,"-filter_complex",";".join(filters),"-map","[vout]","-map","1:a:0","-c:v","libx264","-preset","veryfast","-crf","29","-pix_fmt","yuv420p","-c:a","aac","-b:a","128k","-shortest",str(mp4)],check=True)
probe=json.loads(subprocess.check_output(["ffprobe","-v","error","-show_entries","format=duration:stream=codec_type,width,height","-of","json",str(mp4)],text=True))
assert abs(float(probe["format"]["duration"])-bridge["total_seconds"])<1.5
assert any(s.get("width")==1920 and s.get("height")==1080 for s in probe["streams"])
assert any(s["codec_type"]=="audio" for s in probe["streams"])
proof={"contract":"M8VIS_RESEARCH_HEURISTIC_MOUTH_PREVIEW","scene_count":6,"sentence_count":21,"mp4_sha256":hashlib.sha256(mp4.read_bytes()).hexdigest(),"video_seconds":float(probe["format"]["duration"]),"scene_cards_rendered":True,"subtitle_burned_in":True,"original_sprite_four_poses_integrated":True,"heuristic_mouth_intervals":sum(map(len,intervals.values())),"mouth_motion_verified":False,"lip_sync_verified":False,"visual_manual_review":False,"editorial_certified":False,"publication_authorized":False}
(out/"visual-render-proof.json").write_text(json.dumps(proof,ensure_ascii=False,indent=2)+"\n")
print("V3_M8VIS_VISUAL_RENDER_PASS scenes=6 original_sprite_four_poses=true heuristic_mouth=true subtitles_burned=true lip_sync=false editorial_certified=false no_publish=true")
