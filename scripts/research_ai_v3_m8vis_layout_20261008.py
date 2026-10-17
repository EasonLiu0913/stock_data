#!/usr/bin/env python3
"""Fail-closed research-only M8VIS visual layout contract; never certifies editorial claims."""
import json,pathlib,sys,hashlib
root=pathlib.Path(sys.argv[1])
source=json.loads((root/"source.json").read_text())
handoff=json.loads((root/"m8vis-timing-handoff.json").read_text())
original=json.loads(pathlib.Path(sys.argv[2]).read_text())
assert source["publication_authorized"] is False and source["render_authorized"] is False
assert original["editorial_complete"] is False and original["publication_authorized"] is False
assert original["research_master_sha256"]==source["research_master_sha256"]==handoff["research_master_sha256"]
assert [x["id"] for x in handoff["scenes"]]==[x["id"] for x in source["media_input"]]
claims={c["id"]:c for c in original["claims"]}
assert len(claims)==len(original["claims"])
cards=[]
for scene,part in zip(handoff["scenes"],source["media_input"]):
 assert scene["claim_ids"]==part["claim_ids"]==scene["card_claim_ids"]==part["card_claim_ids"]
 assert all(cid in claims for cid in scene["claim_ids"])
 assert len(scene["claim_ids"])==len(set(scene["claim_ids"])),("DUPLICATE_CARD_CLAIM",scene["id"])
 assert all(isinstance(cid,str) and cid for cid in scene["claim_ids"]),("INVALID_CARD_CLAIM",scene["id"])
 cards.append({"scene":scene["id"],"start_seconds":scene["start_seconds"],"end_seconds":scene["end_seconds"],"claim_ids":scene["claim_ids"],"claim_statuses":{cid:claims[cid]["epistemic_status"] for cid in scene["claim_ids"]},"editorial_certified":False,"watermark":"研究預覽｜財經內容尚未完成編輯驗證"})
# Explicit safe zones in 1920x1080; reserved bottom subtitle and progress bar and lower-right presenter.
zones={"canvas":[0,0,1920,1080],"title":[110,80,1540,160],"card_area":[110,270,1400,550],"presenter_reserved":[1510,350,360,490],"subtitle_reserved":[190,830,1320,130],"progress_reserved":[90,975,1740,75]}
def overlap(a,b):return a[0]<b[0]+b[2] and b[0]<a[0]+a[2] and a[1]<b[1]+b[3] and b[1]<a[1]+a[3]
for key in ("title","card_area"):
 assert not any(overlap(zones[key],zones[reserved]) for reserved in ("presenter_reserved","subtitle_reserved","progress_reserved")),(key,"ZONE_COLLISION")
assert not overlap(zones["subtitle_reserved"],zones["presenter_reserved"])
assert not overlap(zones["subtitle_reserved"],zones["progress_reserved"])
manifest={"contract":"V3_M8VIS_RESEARCH_LAYOUT_ONLY","target_date":"20261008","research_master_sha256":source["research_master_sha256"],"zones":zones,"cards":cards,"scene_count":6,"claim_count":len(claims),"editorial_complete":False,"visual_asset_rendered":False,"subtitle_burned_in":False,"vtuber_integrated":False,"publication_authorized":False}
(root/"m8vis-research-layout.json").write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+"\n")
print("V3_M8VIS_LAYOUT_PASS scenes=6 zones_no_collision=true editorial_certified=false visual_render=false no_publish=true")
