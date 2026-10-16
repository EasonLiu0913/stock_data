#!/usr/bin/env python3
"""Inspect checked-in VTuber assets independently; preserve evidence and fail closed."""
import hashlib,json,pathlib,subprocess,sys
repo=pathlib.Path(sys.argv[1]);out=pathlib.Path(sys.argv[2]);out.mkdir(parents=True,exist_ok=True)
paths=["assets/video/vtuber/daily-gainers-presenter.webp","assets/daily-gainers-vtuber-sprite.webp","assets/video/vtuber/mouth-o.webp","assets/video/vtuber/mouth-small.webp","assets/video/vtuber/mouth-wide.webp"]
records=[]
for path in paths:
 p=repo/path;row={"path":path,"bytes":p.stat().st_size,"sha256":hashlib.sha256(p.read_bytes()).hexdigest(),"riff_webp":p.read_bytes()[:4]==b"RIFF" and p.read_bytes()[8:12]==b"WEBP"}
 q=subprocess.run(["ffprobe","-v","error","-select_streams","v:0","-show_entries","stream=width,height,codec_name,nb_frames","-of","json",str(p)],capture_output=True,text=True)
 row["probe_exit"]=q.returncode;row["probe"]=json.loads(q.stdout) if q.returncode==0 and q.stdout.strip() else {};row["probe_stderr"]=q.stderr[-700:]
 dest=out/(p.stem+".png")
 x=subprocess.run(["ffmpeg","-hide_banner","-loglevel","error","-y","-i",str(p),"-frames:v","1",str(dest)],capture_output=True,text=True)
 row["decode_exit"]=x.returncode;row["decoded_png"]=dest.exists() and dest.stat().st_size>0;row["decode_stderr"]=x.stderr[-700:]
 if not row["decoded_png"]:dest.unlink(missing_ok=True)
 records.append(row)
(out/"vtuber-asset-probe.json").write_text(json.dumps({"contract":"RESEARCH_VTUBER_ASSET_PROBE","records":records,"publication_authorized":False},indent=2)+"\n")
print("VTUBER_ASSET_PROBE "+json.dumps([{"path":r["path"],"bytes":r["bytes"],"riff_webp":r["riff_webp"],"probe":r["probe"],"decoded_png":r["decoded_png"]} for r in records]))
# This probe is diagnostic and does not authorize using a sprite sheet as a presenter.
