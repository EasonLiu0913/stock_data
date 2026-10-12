#!/usr/bin/env python3
"""M8PREVIEW research-only static fail-closed validator. NO media or external actions."""
import copy,json
from pathlib import Path
R=Path(__file__).resolve().parents[1]
def load(p): return json.loads((R/p).read_text(encoding="utf8"))
root="data_research/m5/"
p=load(root+"m8preview/M8PREVIEW-ISOLATED-PREREGISTRATION-v1.json")
c=load(root+"m8preview/M8PREVIEW-INTEGRATION-ACCEPTANCE-CONTRACT-v1.json")
m=load(root+"m8data/20261008-1301-research-manifest.json")
s=load(root+"m8data/20261008-1301-semantic-draft.json")
v=load(root+"m8vis/M8VIS-THREE-SCENE-STATIC-VISUAL-SPEC-v1.json")
g=load(root+"m8data/M7-READONLY-FRAME-GEOMETRY-v1.json")
def overlap(a,b): return a[0]<b[2] and b[0]<a[2] and a[1]<b[3] and b[1]<a[3]
def check(x):
 assert x["mode"]=="PRE_REGISTERED_NON_EXECUTABLE"
 o=x["timeline"]["opening"]; baseline=p["baseline"]
 assert o["asset"]=="ORIGINAL_M7_ONLY" and o["source_audio_seconds"]==baseline["m7_original_audio_seconds"]==79.416
 assert o["mp3_count"]==baseline["m7_original_mp3_count"]==7
 assert o["srt_cues"]==baseline["m7_candidate_srt_blocks"]==14 and o["srt_sha256"]==baseline["m7_candidate_srt_sha256"]
 assert baseline["m7_archive_sha256"]==g["artifact"]["zip_sha256"]
 assert o["srt_alignment"]==baseline["m7_srt_status"]=="TIMING_ESTIMATED_NOT_SYNC_VERIFIED"
 assert x["timeline"]["final_total"]=="UNKNOWN_UNTIL_AUTHORIZED_REAL_ASSETS"
 assert x["timeline"]["closing"]=="ORIGINAL_M7_ENDING_IF_VERIFIED; NO_SYNTHETIC_NEW_ENDING"
 scenes=x["timeline"]["stock_scenes"]
 assert [(z["id"],z["claim_ids"]) for z in scenes]==[(z["id"],z["keys"]) for z in m["scenes"]]
 assert [(z["id"],z["claim_ids"]) for z in scenes]==[(z["id"],z["claim_ids"]) for z in s["scenes"]]
 assert [z["title"] for z in scenes]==x["progress"]["segments"]==v["progress"]["labels"]
 assert len(scenes)==x["progress"]["total_segments"]==3
 assert all(z["duration"]=="UNKNOWN_UNTIL_AUTHORIZED_REAL_AUDIO" for z in scenes)
 assert x["progress"]["total_time"]==x["progress"]["remaining_time"]=="UNKNOWN_UNTIL_VERIFIED_MEDIA"
 assert x["progress"]["current_index"]=="DERIVE_FROM_ACTUAL_MANIFEST_SCENE"
 keys=[k for z in scenes for k in z["claim_ids"]]; excluded=x["claims"]["excluded"]
 assert len(keys)==x["claims"]["count"]==9 and len(set(keys))==9
 assert len(excluded)==6 and excluded==m["display_scope"]["excluded_pending_verification"] and not set(keys)&set(excluded)
 assert set(keys)|set(excluded)=={z["key"] for z in m["claims"]}
 assert x["claims"]["semantic_source"]==p["scope"]["three_scene_data_manifest"].replace("research-manifest.json","semantic-draft.json")
 assert "oral dates/numerals" in x["claims"]["validation"] and "reject missing" in x["claims"]["validation"]
 assert "estimated timing never labeled acoustic sync" in x["claims"]["time_rule"]
 assert x["vtuber"]["current_status"]=="NOT_TESTED" and "Real voice-to-mouth/frame evidence" in x["vtuber"]["future_measurement"]
 zone=x["safe_zones"]; names={"left_card":"left_content_envelope","presenter":"presenter_protection","footer_progress_cc":"footer_protection","header":"header_protection"}
 assert all(zone[a]==g["conservative_spec_boxes"][z] for a,z in names.items())
 assert all(not overlap(zone["left_card"],zone[k]) for k in ("presenter","footer_progress_cc","header"))
 assert zone["status"]=="CONSERVATIVE_STATIC_PLANNING_NOT_REAL_PLAYER_PROOF" and zone["no_fake_srt_geometry"] is True
 assert "mobile player viewport" in zone["future_cc_on_off"] and "reject any overlap" in zone["future_cc_on_off"]
 retry=x["retry"]
 assert retry["mode"]=="FUTURE_CONTRACT_ONLY_NO_EXECUTION"
 assert retry["artifacts"]["sha256_each_required"] is True and retry["artifacts"]["completed_stage_manifest_required"] is True
 assert "must not regenerate media" in retry["on_failure"] and "do not duplicate private videos" in retry["idempotency"]
 assert "separate explicit permission" in retry["gates"] and "do not recreate MP4" in retry["thumbnail_403"]
 assert len(retry["stages"])==10 and len(x["negative_cases"])==12
 assert x["evidence_boundary"]==dict(static_contract="SPEC_DEFINED",real_audio="NOT_GENERATED",video="NOT_RENDERED",player_cc="NOT_TESTED",actual_lipsync="NOT_TESTED",private_youtube="NOT_AUTHORIZED")
 assert all(val is False for val in x["locks"].values())
 return True
assert p["prompt_a"]["status"]=="ACTIVE" and p["prompt_b"]["status"]=="FROZEN_NOT_AUTHORIZED_NOT_EXECUTED"
assert all(z is False for z in p["governance"].values())
assert check(c)
neg=[]
def reject(name,mutate):
 x=copy.deepcopy(c); mutate(x)
 try: check(x)
 except (AssertionError,KeyError,ValueError,TypeError): neg.append(name); return
 raise AssertionError("Mutation not rejected: "+name)
reject("M7_hash",lambda x:x["timeline"]["opening"].__setitem__("srt_sha256","bad"))
reject("M7_duration",lambda x:x["timeline"]["opening"].__setitem__("source_audio_seconds",80))
reject("missing_claim",lambda x:x["timeline"]["stock_scenes"][1]["claim_ids"].pop())
reject("caption_claim_leak",lambda x:x["claims"]["excluded"].pop())
reject("reordered_claim",lambda x:x["timeline"]["stock_scenes"][0]["claim_ids"].reverse())
reject("oral_transform_disabled",lambda x:x["claims"].__setitem__("validation","no oral conversion"))
reject("estimated_as_acoustic",lambda x:x["claims"].__setitem__("time_rule","estimated is acoustic"))
reject("fabricated_scene_duration",lambda x:x["timeline"]["stock_scenes"][0].__setitem__("duration",12))
reject("invented_total",lambda x:x["progress"].__setitem__("total_time",100))
reject("presenter_collision",lambda x:x["safe_zones"].__setitem__("left_card",[1450,400,1600,600]))
reject("cc_runtime_false_pass",lambda x:x["safe_zones"].__setitem__("status","PLAYER_PASS"))
reject("lip_sync_false_pass",lambda x:x["vtuber"].__setitem__("current_status","PASS"))
reject("unverified_regen_on_upload_failure",lambda x:x["retry"].__setitem__("on_failure","rerender all"))
reject("duplicate_upload",lambda x:x["retry"].__setitem__("idempotency","duplicate allowed"))
reject("private_upload_unlocked",lambda x:x["locks"].__setitem__("youtube_authorized",True))
reject("unknown_to_zero",lambda x:x["progress"].__setitem__("remaining_time",0))
assert len(neg)==16
print("M8PREVIEW_STATIC_PASS m7=PINNED scenes=3 claims=9 excluded=6 semantic=SPEC_ONLY zones=DISJOINT durations=UNKNOWN cc=NOT_TESTED retry=IDEMPOTENT_SPEC negatives=16 locks=FALSE no_media=true A=INCOMPLETE B=FROZEN")
