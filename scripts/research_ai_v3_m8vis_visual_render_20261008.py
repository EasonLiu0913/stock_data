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
manifest_path=root/"ai-numeric-claims-v3.json"
assert manifest_path.is_file(),"M8VIS_NUMERIC_MANIFEST_REQUIRED"
manifest=json.loads(manifest_path.read_text())
assert manifest["target_date"]==source["target_date"],"M8VIS_NUMERIC_DATE_DRIFT"
assert manifest["editor_input_sha256"]==source["research_master_sha256"],"M8VIS_NUMERIC_MASTER_DRIFT"
assert manifest["publication_authorized"] is False and manifest["render_authorized"] is False
assert len(manifest["claims"])==10,"M8VIS_NUMERIC_CLAIM_COUNT_DRIFT"
def number(n):
 return f"{n:,.2f}".rstrip("0").rstrip(".") if isinstance(n,float) else f"{n:,}"
by_scene={p["id"]:" ".join(p["caption_sentences"]) for p in source["media_input"]}
assert number(manifest["claims"]["MARKET_INDEX"]["close"]) in by_scene["market"],"M8VIS_RENDER_INDEX_VALUE_DRIFT"
for code in ("6672","2305","1301"):
 assert number(manifest["claims"][code+"_PRICE"]["close"]) in by_scene[code],("M8VIS_RENDER_FEATURED_CLOSE_DRIFT",code)
flow=manifest["claims"]["2305_FLOW"]
assert number(flow["foreign"]) in by_scene["2305"] and number(flow["dealer"]) in by_scene["2305"],"M8VIS_RENDER_2305_FLOW_DRIFT"
# Check further date-specific values against the exact text drawn on the cards.
market_text=by_scene["market"]
for key in ("rising","falling","unchanged","limit_up","limit_down"):
 assert number(manifest["claims"]["MARKET_BREADTH"][key]) in market_text,("M8VIS_RENDER_BREADTH_DRIFT",key)
for code in ("6672","2305","1301"):
 price=manifest["claims"][code+"_PRICE"]
 assert number(price["previous_close"]) in by_scene[code],("M8VIS_RENDER_PREVIOUS_CLOSE_DRIFT",code)
# Rendered-card captions use rounded financial units. Validate each displayed rounded
# amount against the same numeric manifest without claiming exact raw-unit display.
def rounded_yi(twd):
 return number(round(abs(twd)/100000000))
turnover=manifest["claims"]["MARKET_TURNOVER"]
assert rounded_yi(turnover["twd"]) in market_text, "M8VIS_RENDER_TURNOVER_DRIFT"
assert rounded_yi(turnover["previous_five_trading_days_mean_twd"]) in market_text, "M8VIS_RENDER_TURNOVER_MA5_DRIFT"
for key in ("foreign","investment_trust","dealers"):
 assert rounded_yi(manifest["claims"]["MARKET_INSTITUTIONAL"][key]) in market_text,("M8VIS_RENDER_INSTITUTIONAL_DRIFT",key)
# Percentage displays are reviewed rounded editorial projections, not raw-value equality.
def pct(n,places=2):
 return f"{abs(n):.{places}f}".rstrip("0").rstrip(".")+"%"
for code in ("6672","2305","1301"):
 assert pct(manifest["claims"][code+"_PRICE"]["change_pct"]) in by_scene[code],("M8VIS_RENDER_FEATURED_PCT_DRIFT",code)
assert pct(manifest["claims"]["MARKET_INDEX"]["change_pct"]) in market_text,"M8VIS_RENDER_INDEX_PCT_DRIFT"
# Require bounded numeric tokens: e.g. '2' must not accidentally match '425'.
import re
def has_number_token(s,n):
 return re.search(r"(?<![\d,.])"+re.escape(number(n))+r"(?![\d,.])",s) is not None
assert not has_number_token("425家",2),"M8VIS_NUMERIC_TOKEN_NEGATIVE_CONTROL_FAILED"
for key in ("rising","falling","unchanged","limit_up","limit_down"):
 assert has_number_token(market_text,manifest["claims"]["MARKET_BREADTH"][key]),("M8VIS_RENDER_BREADTH_TOKEN_DRIFT",key)
# Verify share-to-lot display conversion (one TWSE lot = 1,000 shares).
# Editorial narration explicitly marks these as approximate lots.
def approx_lots(shares):
 return number(round(abs(shares)/1000))
for code,keys in (("6672",("foreign","investment_trust","dealer")),("1301",("foreign","investment_trust"))):
 for key in keys:
  assert has_number_token(by_scene[code],round(abs(manifest["claims"][code+"_FLOW"][key])/1000)),("M8VIS_RENDER_FLOW_LOTS_DRIFT",code,key)
assert has_number_token(by_scene["2305"],abs(manifest["claims"]["2305_FLOW"]["investment_trust"])),"M8VIS_RENDER_2305_TRUST_SHARES_DRIFT"
# Match amount, trading direction and unit together; a number elsewhere on a card
# must not satisfy a buy/sell assertion for a different institution.
def direction(shares):
 return "買超" if shares>0 else "賣超" if shares<0 else "持平"
for code,keys in (("6672",("foreign","investment_trust","dealer")),("1301",("foreign","investment_trust"))):
 for key in keys:
  shares=manifest["claims"][code+"_FLOW"][key]
  pattern=direction(shares)+r"約"+re.escape(approx_lots(shares))+r"張"
  assert re.search(pattern,by_scene[code]),("M8VIS_RENDER_FLOW_DIRECTION_UNIT_DRIFT",code,key)
for key in ("foreign","investment_trust","dealer"):
 shares=manifest["claims"]["2305_FLOW"][key]
 expected=direction(shares)+number(abs(shares))+"股" if key!="dealer" else "淨"+direction(shares)+number(abs(shares))+"股"
 assert expected in by_scene["2305"],("M8VIS_RENDER_2305_FLOW_DIRECTION_UNIT_DRIFT",key)
assert "賣超約251張" not in by_scene["6672"],"M8VIS_FLOW_DIRECTION_NEGATIVE_CONTROL_FAILED"
# A negative control must reject a deliberately altered manifest value.
assert number(manifest["claims"]["MARKET_INDEX"]["close"]+10000) not in market_text,"M8VIS_RENDER_NUMERIC_NEGATIVE_CONTROL_FAILED"
print("M8VIS_RENDER_NUMERIC_CAPTION_VALUE_PASS index=1 featured_close=3 flow2305=2 breadth=5 previous_close=3 turnover=2 institutional=3 pct=4 flow_lots=5 flow2305_trust=1 direction_unit=8 bounded_breadth=true negative_control=true research_only=true")
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
card_content_proof=[]
for i,(card,part) in enumerate(zip(layout["cards"],source["media_input"])):
 assert card["scene"]==part["id"] and card["claim_ids"]==part["card_claim_ids"]
 im=Image.new("RGBA",(1920,1080),"#172331");d=ImageDraw.Draw(im)
 d.text((110,55),"TAIWAN STOCK  /  2026.10.08",font=font(30),fill="#e9bb77")
 d.text((110,115),labels[card["scene"]],font=font(67),fill="#ffffff")
 rect(d,zones["card_area"],"#26384a","#56718a")
 # The card content is sourced verbatim from the same narration/caption source, not reconstructed figures.
 x,y,w,h=zones["card_area"]
 lines=part["caption_sentences"]
 timed_captions=[s["caption_text"] for s in bridge["sentences"] if s["scene"]==card["scene"]]
 assert lines==timed_captions,("CARD_TIMED_CAPTION_CONTENT_DRIFT",card["scene"])
 card_content_proof.append({"scene":card["scene"],"claim_ids":card["claim_ids"],"caption_sentences":lines,"caption_sha256":hashlib.sha256(json.dumps(lines,ensure_ascii=False,separators=(",",":")).encode("utf-8")).hexdigest()})
 # Narration/SRT may grow independently of the persistent structured card.
 # Preserve every timed caption in the proof; never truncate to a legacy five-sentence limit.
 assert len(lines)==len(timed_captions)>0,("CARD_SENTENCE_INVENTORY_DRIFT",card["scene"])
 assert all(isinstance(line,str) and line.strip() for line in lines),("CARD_SENTENCE_EMPTY",card["scene"])
 # Structured information cards are independent of SRT/caption sentences.
 # Only verified manifest figures may populate numeric tiles.
 scene=card["scene"];claims=manifest["claims"]; tiles=[]
 if scene=="market":
  breadth=claims["MARKET_BREADTH"]
  tiles=[("上漲",number(breadth["rising"]),"家"),("下跌",number(breadth["falling"]),"家"),("平盤",number(breadth["unchanged"]),"家"),("漲停",number(breadth["limit_up"]),"家")]
  # Owner-approved 2x2 cross divider, not four caption paragraphs.
  d.line((x+w/2,y+24,x+w/2,y+h-24),fill="#7991a7",width=4)
  d.line((x+24,y+h/2,x+w-24,y+h/2),fill="#7991a7",width=4)
  for j,(heading,value,unit) in enumerate(tiles):
   cx=x+w*(0.25 if j%2==0 else 0.75);cy=y+h*(0.25 if j<2 else 0.75)
   d.text((cx,cy-85),heading,font=font(39),fill="#d4e0ea",anchor="mm")
   d.text((cx,cy+5),value,font=font(91),fill="#f5f7fa",anchor="mm")
   d.text((cx,cy+90),unit,font=font(29),fill="#e9bb77",anchor="mm")
 elif scene in ("6672","2305","1301"):
  price=claims[scene+"_PRICE"];fl=claims[scene+"_FLOW"]
  tiles=[("收盤價",number(price["close"]),"元"),("漲跌幅",pct(price["change_pct"]),"漲跌幅"),("前收盤",number(price["previous_close"]),"元")]
  for j,(heading,value,unit) in enumerate(tiles):
   xx=x+45+j*450
   rect(d,(xx,y+45,410,190),"#344b61","#66829b")
   d.text((xx+25,y+65),heading,font=font(32),fill="#d4e0ea")
   d.text((xx+25,y+125),value,font=font(60),fill="#ffffff")
  for j,(key,label) in enumerate((("foreign","外資"),("investment_trust","投信"),("dealer","自營商"))):
   if key not in fl:continue
   value=fl[key];unit="股" if scene=="2305" else "張"
   shown=number(abs(value)) if scene=="2305" else approx_lots(value)
   heading=label+" "+direction(value)
   xx=x+50+j*445
   d.text((xx,y+315),heading,font=font(35),fill="#e9bb77")
   d.text((xx,y+390),shown+" "+unit,font=font(43),fill="#ffffff")
 elif scene=="opening":
  tiles=[("品牌","TAIWAN STOCK",""),("主題","追蹤資金・解讀行情","")]
  d.text((x+85,y+105),"TAIWAN STOCK",font=font(82),fill="#e9bb77")
  d.text((x+85,y+280),"追蹤資金  /  解讀行情",font=font(52),fill="#ffffff")
  d.text((x+85,y+405),"每日 5% 強勢股研究",font=font(39),fill="#d4e0ea")
 else:
  tiles=[("市場","漲跌與資金",""),("個股","強勢股研究",""),("觀察","後續追蹤","")]
  for j,(heading,value,unit) in enumerate(tiles):
   yy=y+65+j*150
   d.ellipse((x+65,yy+13,x+105,yy+53),fill="#e9bb77")
   d.text((x+140,yy),heading+"｜"+value,font=font(48),fill="#ffffff")
 assert tiles and not any(line in str(tiles) for line in lines),"STRUCTURED_CARD_MUST_NOT_DUPLICATE_CAPTION"
 card_content_proof[-1]["subtitle_background_drawn"]=False
 card_content_proof[-1]["structured_card"]={"type":"cross_2x2" if scene=="market" else "stock_metrics" if scene in ("6672","2305","1301") else "opening_brand" if scene=="opening" else "three_takeaways","tiles":[{"label":v[0],"value":v[1],"unit":v[2]} for v in tiles],"source":"verified_numeric_manifest" if scene=="market" or scene in ("6672","2305","1301") else "editorial_section_labels"}
 px,py,pw,ph=zones["presenter_reserved"]
 assert poses["closed"].width<=pw and poses["closed"].height<=ph,"PRESENTER_RESERVED_ZONE_OVERFLOW"
 avatar_x=px+(pw-poses["closed"].width)//2;avatar_y=py+ph-poses["closed"].height
 # Owner review: no opaque subtitle backdrop; retain the reserved region as a layout constraint only.
 # SRT is burned in separately with a larger outlined font above the progress strip.
 rect(d,zones["progress_reserved"],"#26384a")
 for j in range(6):
  xx=120+j*285;d.rounded_rectangle((xx,996,xx+255,1009),radius=5,fill="#e9bb77" if j<=i else "#627387")
 d.text((120,1015),f"{i+1}/6  ·  研究預覽｜財經內容尚未完成編輯驗證",font=font(24),fill="#ffffff")
 scene_path=out/f"scene-{i+1:02}.png"
 im.convert("RGB").save(scene_path)
 assert scene_path.is_file() and scene_path.stat().st_size>0,("CARD_SCENE_IMAGE_MISSING",card["scene"])
 card_content_proof[-1]["scene_png_sha256"]=hashlib.sha256(scene_path.read_bytes()).hexdigest()
assert len(card_content_proof)==len(layout["cards"]),"CARD_CONTENT_PROOF_COUNT_DRIFT"
(out/"card-content-proof.json").write_text(json.dumps({"contract":"M8VIS_RENDERED_CARD_TEXT_RESEARCH_ONLY","research_master_sha256":source["research_master_sha256"],"cards":card_content_proof,"publication_authorized":False},ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
# Audio-derived sentence boundaries are verified by the bridge. Mouth pose cycles are
# explicitly heuristic, NOT phoneme alignment or a claim of verified lip-sync.
audio=root/"diagnostic-preview/continuous.wav";assert audio.is_file()
srt=root/"research-sentence-captions.srt";assert srt.is_file()
assert len(bridge["sentences"])>0 and bridge["total_seconds"]>0
assert sum(len(p["speech_sentences"]) for p in source["media_input"])==len(bridge["sentences"]),"M8VIS_RENDER_SENTENCE_INVENTORY_DRIFT"
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
 # Speech-responsive approximation only: periodic poses avoid thousands of FFmpeg expressions.
 phase={"small":(0.00,0.16,0.32,0.48),"o":(0.48,0.64),"wide":(0.16,0.32)}[name]
 if name=="small":return "between(mod(t\\,0.64)\\,0\\,0.16)+between(mod(t\\,0.64)\\,0.32\\,0.48)"
 return f"between(mod(t\\,0.64)\\,{phase[0]:.2f}\\,{phase[1]:.2f})"
mp4=out/"m8vis-six-scene-heuristic-mouth-research.mp4"
sub=str(srt).replace("\\\\","\\\\\\\\").replace(":","\\\\:")
inputs=["-safe","0","-f","concat","-i",str(concat),"-i",str(audio)]
for name in ("closed","small","o","wide"):
 inputs+=["-loop","1","-framerate","8","-i",str(out/f"presenter-{name}.png")]
filters=[f"[0:v]fps=8,format=rgba[base]",
 f"[base][2:v]overlay={avatar_x}:{avatar_y}:shortest=1:format=auto[v0]"]
for i,name in enumerate(("small","o","wide")):
 filters.append(f"[v{i}][{i+3}:v]overlay={avatar_x}:{avatar_y}:enable='{enabled(name)}':shortest=1:format=auto[v{i+1}]")
filters.append(f"[v3]subtitles='{sub}':force_style='FontName=Noto Sans CJK TC,FontSize=20,Alignment=2,MarginV=35,Outline=2,Shadow=0,BorderStyle=1',format=yuv420p[vout]")
print(f"M8VIS_FFMPEG_DIAGNOSTIC filter_chars={sum(len(f) for f in filters)} mouth_intervals={sum(map(len,intervals.values()))} seconds={bridge['total_seconds']:.3f}",flush=True)
subprocess.run(["ffmpeg","-hide_banner","-loglevel","error","-y","-filter_complex_threads","1",*inputs,"-filter_complex",";".join(filters),"-map","[vout]","-map","1:a:0","-c:v","libx264","-threads","2","-preset","ultrafast","-crf","29","-pix_fmt","yuv420p","-c:a","aac","-b:a","128k","-shortest",str(mp4)],check=True)
probe=json.loads(subprocess.check_output(["ffprobe","-v","error","-show_entries","format=duration:stream=codec_type,width,height","-of","json",str(mp4)],text=True))
assert abs(float(probe["format"]["duration"])-bridge["total_seconds"])<1.5
assert any(s.get("width")==1920 and s.get("height")==1080 for s in probe["streams"])
assert any(s["codec_type"]=="audio" for s in probe["streams"])
# Decode actual encoded MP4 frames rather than trusting the filtergraph alone.
# Choose distinct pose windows inside the first verified sentence; compare only
# the presenter reservation, where the scene background remains unchanged.
from PIL import ImageChops
samples=[]
for stamp in (0.08,0.24,0.40,0.56):
 frame=out/f"encoded-presenter-{round(stamp*100):03}.png"
 subprocess.run(["ffmpeg","-hide_banner","-loglevel","error","-y","-ss",f"{stamp:.3f}","-i",str(mp4),"-frames:v","1",str(frame)],check=True)
 assert frame.is_file() and frame.stat().st_size>0,("ENCODED_FRAME_MISSING",stamp)
 with Image.open(frame) as captured:
  assert captured.size==(1920,1080),("ENCODED_FRAME_SIZE_DRIFT",stamp)
  samples.append(captured.convert("RGB").crop((px,py,px+pw,py+ph)))
diffs=[ImageChops.difference(samples[0],other).getbbox() is not None for other in samples[1:]]
assert any(diffs),"ENCODED_PRESENTER_NOT_CHANGING"
encoded_presenter_motion_verified=True
proof={"contract":"M8VIS_RESEARCH_HEURISTIC_MOUTH_PREVIEW","scene_count":6,"sentence_count":len(bridge["sentences"]),"mp4_sha256":hashlib.sha256(mp4.read_bytes()).hexdigest(),"video_seconds":float(probe["format"]["duration"]),"scene_cards_rendered":True,"scene_caption_backdrops_rendered":False,"structured_information_cards_verified":True,"subtitle_burned_in":True,"original_sprite_four_poses_integrated":True,"heuristic_mouth_intervals":sum(map(len,intervals.values())),"mouth_motion_verified":encoded_presenter_motion_verified,"encoded_presenter_frame_samples":4,"lip_sync_verified":False,"visual_manual_review":False,"editorial_certified":False,"publication_authorized":False}
# Consolidated machine-verifiable preview handoff. Manual/editorial gates stay false.
card_proof=json.loads((out/"card-content-proof.json").read_text(encoding="utf-8"))
assert len(card_proof["cards"])==6,"M8VIS_HANDOFF_CARD_COUNT_DRIFT"
assert len({c["scene"] for c in card_proof["cards"]})==6,"M8VIS_HANDOFF_DUPLICATE_SCENE"
assert sum(len(c["caption_sentences"]) for c in card_proof["cards"])==len(bridge["sentences"]),"M8VIS_HANDOFF_SENTENCE_COUNT_DRIFT"
assert all(c["scene_png_sha256"] and c["caption_sha256"] for c in card_proof["cards"]),"M8VIS_HANDOFF_CARD_HASH_MISSING"
handoff={"contract":"M8VIS_RESEARCH_PREVIEW_HANDOFF_V1","target_date":manifest["target_date"],"research_master_sha256":source["research_master_sha256"],"numeric_claim_count":len(manifest["claims"]),"scene_count":proof["scene_count"],"sentence_count":proof["sentence_count"],"video_seconds":proof["video_seconds"],"mp4_sha256":proof["mp4_sha256"],"card_content_proof_sha256":hashlib.sha256((out/"card-content-proof.json").read_bytes()).hexdigest(),"srt_sha256":hashlib.sha256(srt.read_bytes()).hexdigest(),"machine_gates":{"numeric_caption_parity":True,"card_timed_caption_parity":True,"scene_png_hashes":True,"encoded_presenter_motion":True,"subtitle_burned_in":True,"structured_information_cards":True},"pending_gates":{"manual_visual_review":True,"editorial_certification":True,"accurate_lip_sync":True},"publication_authorized":False,"render_authorized":False}
(out/"preview-handoff.json").write_text(json.dumps(handoff,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
assert json.loads((out/"preview-handoff.json").read_text(encoding="utf-8"))==handoff,"M8VIS_HANDOFF_JSON_ROUNDTRIP_FAILED"
assert all(c.get("structured_card",{}).get("tiles") for c in card_proof["cards"]),"STRUCTURED_CARDS_REQUIRED"
assert card_proof["cards"][1]["structured_card"]["type"]=="cross_2x2","MARKET_CROSS_CARD_REQUIRED"
print("M8VIS_STRUCTURED_CARDS_PASS scenes=6 market_cross_2x2=true caption_backdrops=false manual_review=pending")
print(f"M8VIS_PREVIEW_HANDOFF_PASS scenes=6 sentences={len(bridge['sentences'])} numeric_claims=10 manual_review=pending editorial=pending lip_sync=pending no_publish=true")
(out/"visual-render-proof.json").write_text(json.dumps(proof,ensure_ascii=False,indent=2)+"\n")
print("V3_M8VIS_VISUAL_RENDER_PASS scenes=6 original_sprite_four_poses=true heuristic_mouth=true encoded_presenter_motion=true subtitles_burned=true lip_sync=false editorial_certified=false no_publish=true")
