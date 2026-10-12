#!/usr/bin/env python3
"""M9 isolated research static verification; no execution or media actions."""
import copy,json
from pathlib import Path
R=Path(__file__).resolve().parents[1]
def load(p): return json.loads((R/p).read_text(encoding="utf8"))
base="data_research/m5/"
p=load(base+"m9/M9-CONTROLLED-PRIVATE-PREVIEW-PAIR-v1.json")
c=load(base+"m9/M9-FUTURE-EXECUTION-ORDER-AND-ACCEPTANCE-v1.json")
m=load(base+"m8data/20261008-1301-research-manifest.json")
g=load(base+"m8data/M7-READONLY-FRAME-GEOMETRY-v1.json")
def check(x):
 assert x["mode"]=="NON_EXECUTABLE_RESEARCH_PLAN"
 seq=x["sequence"]; assert len(seq)==7
 assert [s["order"] for s in seq]==list(range(7))
 assert [s["stage"] for s in seq]==["freeze_and_authorize","M8_script_audio_and_caption","local_MP4_composition","real_CC_on_off_visual_review","real_VTuber_audio_frame_review","dry_run_retry_validation","optional_YT_private_upload"]
 assert all(s["prerequisites"] and s["pass"] and s["fail_closed"] for s in seq)
 assert "distinct explicit owner approval" in " ".join(seq[0]["prerequisites"])
 assert "separate real-audio/TTS authorization" in seq[1]["prerequisites"]
 assert "stage 1 PASS" in seq[2]["prerequisites"] and "separate render authorization" in seq[2]["prerequisites"]
 assert "stage 2 actual MP4/SRT" in seq[3]["prerequisites"]
 assert "actual rendered MP4 and voiced audio from stage 2" in seq[4]["prerequisites"]
 assert "valid stage 1-4 hashes and stage checkpoints" in seq[5]["prerequisites"]
 assert "no network publication" in seq[5]["prerequisites"]
 assert "separate explicit YouTube Private approval not inherited from M9 static or stage 0-5" in seq[6]["prerequisites"]
 assert "BLOCKED_NOT_AUTHORIZED" in seq[6]["fail_closed"]
 n=x["nonnegotiable"]; b=p["baseline"]
 assert n["m7_archive_sha256"]==b["m7_archive_sha256"]==g["artifact"]["zip_sha256"]
 assert n["m7_candidate_srt_sha256"]==b["m7_srt_sha256"]
 assert n["m7_audio_seconds"]==b["m7_audio_seconds"]==79.416
 assert b["m7_audio_original_count"]==7 and b["m7_srt_cues"]==14
 assert n["m7_srt_status"]=="TIMING_ESTIMATED_NOT_SYNC_VERIFIED"
 assert n["m8_scenes"]==[s["id"] for s in m["scenes"]]
 shown=[z for s in m["scenes"] for z in s["keys"]]
 assert len(shown)==n["m8_claim_count"]==9 and len(set(shown))==9
 assert len(m["display_scope"]["excluded_pending_verification"])==n["excluded_count"]==6
 assert not set(shown)&set(m["display_scope"]["excluded_pending_verification"])
 assert n["m8_durations"]=="UNKNOWN_UNTIL_REAL_AUTHORIZED_AUDIO"
 assert "CC OFF and ON" in seq[3]["pass"] and "mobile viewport" in seq[3]["pass"]
 assert "silence" in seq[4]["pass"] and "decoded real frames" in seq[4]["pass"]
 assert "reuses SHA-verified MP4/SRT/thumbnail" in seq[5]["pass"]
 assert "existing remote video ID stops duplicate upload" in seq[5]["pass"]
 assert "Never rerender valid media solely for upload failure" in x["retry_manifest"]["rule"]
 assert x["retry_manifest"]["per_stage"]["reusable"]=="only complete + hash verified"
 assert x["evidence_limits"]==dict(actual_M8_audio="NOT_GENERATED",actual_MP4="NOT_RENDERED",CC_collision="NOT_TESTED",VTuber_lipsync="NOT_TESTED",retry_runtime="NOT_TESTED",YouTube_Private="NOT_AUTHORIZED")
 assert all(value is False for value in x["locks"].values())
 return True
assert p["prompt_a"]["status"]=="ACTIVE_RESEARCH_PREREGISTRATION_ONLY"
assert p["prompt_b"]["status"]=="FROZEN_NOT_AUTHORIZED_NOT_EXECUTED"
assert all(v is False for v in p["governance"].values())
assert check(c)
neg=[]
def reject(label,fn):
 t=copy.deepcopy(c);fn(t)
 try: check(t)
 except (AssertionError,KeyError,ValueError,TypeError):neg.append(label);return
 raise AssertionError("negative not rejected: "+label)
reject("stage_removed",lambda t:t["sequence"].pop(2))
reject("stage_reorder",lambda t:t["sequence"].reverse())
reject("audio_without_permission",lambda t:t["sequence"][1]["prerequisites"].clear())
reject("render_without_audio",lambda t:t["sequence"][2]["prerequisites"].remove("stage 1 PASS"))
reject("cc_without_mp4",lambda t:t["sequence"][3]["prerequisites"].clear())
reject("lipsync_without_frames",lambda t:t["sequence"][4]["prerequisites"].clear())
reject("retry_with_network",lambda t:t["sequence"][5]["prerequisites"].remove("no network publication"))
reject("upload_implicit_auth",lambda t:t["sequence"][6]["prerequisites"].clear())
reject("m7_hash_changed",lambda t:t["nonnegotiable"].__setitem__("m7_archive_sha256","0"*64))
reject("srt_hash_changed",lambda t:t["nonnegotiable"].__setitem__("m7_candidate_srt_sha256","0"*64))
reject("claims_dropped",lambda t:t["nonnegotiable"].__setitem__("m8_claim_count",8))
reject("excluded_dropped",lambda t:t["nonnegotiable"].__setitem__("excluded_count",5))
reject("fabricated_duration",lambda t:t["nonnegotiable"].__setitem__("m8_durations",30))
reject("cc_false_pass",lambda t:t["evidence_limits"].__setitem__("CC_collision","PASS"))
reject("lipsync_false_pass",lambda t:t["evidence_limits"].__setitem__("VTuber_lipsync","PASS"))
reject("retry_rerenders",lambda t:t["retry_manifest"].__setitem__("rule","always rerender"))
reject("retry_unverified",lambda t:t["retry_manifest"]["per_stage"].__setitem__("reusable","always"))
reject("duplicate_upload",lambda t:t["sequence"][5].__setitem__("pass","duplicate upload permitted"))
reject("youtube_unlock",lambda t:t["locks"].__setitem__("youtube_authorized",True))
reject("render_unlock",lambda t:t["locks"].__setitem__("render_authorized",True))
assert len(neg)==20
print("M9_STATIC_PASS stages=7 ordered=true M7=PINNED M8_claims=9 excluded=6 M8_duration=UNKNOWN CC=NOT_TESTED lipsync=NOT_TESTED retry=SPEC_ONLY negatives=20 locks=FALSE no_media=true B=FROZEN")
