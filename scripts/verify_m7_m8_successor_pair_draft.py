#!/usr/bin/env python3
"""Read-only successor draft governance preflight; no A/B execution or media."""
import json
from pathlib import Path
p=Path(__file__).resolve().parents[1]/"data_research/m5/change-proposals/M7-M8-SUCCESSOR-PAIR-v1.json"
x=json.loads(p.read_text(encoding="utf-8"))
assert x["schema"]=="M7-M8-PROSPECTIVE-SUCCESSOR-PAIR-v1"
assert x["status"]=="DRAFT_PREREGISTERED_ON_ISOLATED_BRANCH_ONLY"
assert x["historical"]["original_m7_prompt_b_pass"]=="NOT_ESTABLISHED"
assert x["historical"]["retroactive_pass_forbidden"] is True
h=x["historical"]
assert (h["m7_private_visual"]["run_id"],h["m7_private_visual"]["artifact_id"])==(38156510901,11708184782)
assert (h["mp3_count"],h["original_audio_seconds"],h["srt_cues"])==(7,79.416,14)
assert h["subtitle_status"]=="TIMING_ESTIMATED_NOT_SYNC_VERIFIED" and h["acoustic_boundaries_verified"]=="0/15"
assert x["successor"]["mode"]=="research_only_data_manifest_no_media"
a,b=x["successor"]["prompt_a"],x["successor"]["prompt_b"]
assert a["status"]=="PENDING_NOT_EXECUTED" and b["status"]=="FROZEN_NOT_ELIGIBLE_NOT_EXECUTED"
assert len(a["acceptance"])==8 and len(b["acceptance"])==8
assert all(v is False for v in x["locks"].values())
r=x["preregistration"]
assert r["isolated_draft"] and r["requires_new_owner_approval"]
assert not any(r[k] for k in ("main_preregistered","successor_a_executed","successor_b_executed"))
print("SUCCESSOR_DRAFT_STATIC_PASS original_B=NOT_ESTABLISHED main_preregistered=false A=false B=false release=BLOCKED")
