#!/usr/bin/env python3
"""Build offline listening UI; scene seek only, phrase timings intentionally unasserted."""
import hashlib,html,json,shutil,sys
from pathlib import Path
src=Path(sys.argv[1]);out=Path(sys.argv[2]);out.mkdir(parents=True,exist_ok=True)
data=json.loads((src/"review.json").read_text(encoding="utf-8"))
assert data["status"]=="PRIVATE_HUMAN_LISTENING_PACK_PREPARED_NOT_REVIEWED"
assert data["publication_authorized"] is False and data["human_listening_pass"] is False
assert len(data["items"])==7 and sum(len(x["phrases"]) for x in data["items"])==31
movie=src/"private-review.mp4"
assert hashlib.sha256(movie.read_bytes()).hexdigest()==data["source_video_sha256"]
assert all("".join(x["phrases"])==x["text"] and x["reviewed"] is False for x in data["items"])
for name in ("private-review.mp4","scene-review.zh-TW.srt","review.json","README.md"):
 shutil.copyfile(src/name,out/name)
sections=[]
for x in data["items"]:
 i=x["scene"];start=x["start_seconds"];end=x["end_seconds"]
 phrases="".join("<li>"+html.escape(t)+"</li>" for t in x["phrases"])
 sections.append('<section><h2>場景 '+str(i)+'</h2><p>'+html.escape(x["text"])+'</p><p>場景 PCM：'+format(start,".3f")+'–'+format(end,".3f")+' 秒</p><button type="button" data-start="'+format(start,".6f")+'">從本場景開始播放</button><ol>'+phrases+'</ol><p>人工檢查：發音、漏字、場景銜接；第六場需聽審拼接處。短句沒有獨立時間戳。</p></section>')
page='''<!doctype html><html lang="zh-Hant"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>M5 私有七場聽審</title><style>body{max-width:900px;margin:0 auto;padding:20px;font:16px/1.65 system-ui;background:#f7f5ef;color:#233}video{width:100%}section{background:white;border:1px solid #ccc;border-radius:12px;padding:16px;margin:16px 0}button{padding:10px}</style><h1>七場私有人工聽審</h1><p>這是原稿比對與場景跳轉介面，並非已通過人工聽感或逐字聲學同步的字幕。勾選或播放不會產生 PASS 憑證。</p><video id="review" controls preload="metadata" src="private-review.mp4"></video>'''+''.join(sections)+'''<script>document.querySelectorAll("button[data-start]").forEach(b=>b.addEventListener("click",()=>{const v=document.getElementById("review");v.currentTime=Number(b.dataset.start);v.play()}));</script></html>'''
(out/"OPEN-PRIVATE-REVIEW.html").write_text(page,encoding="utf-8")
print(json.dumps(dict(status="SEVEN_SCENE_OFFLINE_REVIEW_UI_PREPARED_NOT_REVIEWED",scenes=7,phrases=31,publication_authorized=False)))
