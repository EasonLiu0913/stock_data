#!/usr/bin/env python3
"""Offline, fail-closed M5-R3 ledger check. No networks, model assets or inference."""
import json,re
from pathlib import Path
v=json.loads(Path("data_research/m5/m5-r3-immutable-evidence-ledger.json").read_text())
hex40=lambda s: isinstance(s,str) and re.fullmatch(r"[0-9a-f]{40}",s) is not None
hex64=lambda s: isinstance(s,str) and re.fullmatch(r"[0-9a-f]{64}",s) is not None
assert v["schema"]=="M5-R3-IMMUTABLE-EVIDENCE-LEDGER-v1"
assert (v["baseline"]["run"],v["baseline"]["metadata_artifact"],v["baseline"]["static_artifact"])==(38148526460,11706240448,11706360265)
assert hex64(v["baseline"]["metadata_json_sha256"])
assert len(v["hf"])==4 and {x["repository"] for x in v["hf"]}=={"Qwen/Qwen3-ASR-0.6B","Qwen/Qwen3-ForcedAligner-0.6B","Systran/faster-whisper-small","funasr/paraformer-zh"}
for x in v["hf"]:
 assert hex40(x["immutable_revision"]) and x["immutable_revision"] in x["pinned_metadata_url"]
 assert x["observed_sibling_count"]>0 and x["tree_independent_completeness_review"] is False
 assert x["complete_tree_vs_siblings_matched"] is False
 assert x["non_lfs_file_sha256_complete"] is False and x["ordinary_git_blob_sha256_complete"] is False
 assert x["full_weight_license_approved"] is False
 w=x["weight"]
 assert hex64(w["upstream_lfs_sha256"]) and w["upstream_size_bytes"]>0
 assert w["locally_verified_sha256"] is False
q=v["silero"]
assert q["repository"]=="snakers4/silero-vad"
assert q["immutable_commit"]=="1e261b036686cd0017d500ee96acd1c4ba572a9d"
assert q["tree_sha"]=="360cf6cd532b60815020f19c4df231639c1663d1"
assert q["tree_sha_kind"]=="git_tree_sha1_from_commit" and q["immutable_commit_kind"]=="git_commit_sha1"
assert q["tree_truncated"] is False and q["tree_entries"]==161 and q["role"]=="NONLEXICAL_VAD_ONLY"
assert len(q["assets"])==2
for a in q["assets"]:
 assert a["size_bytes"]>0 and hex40(a["git_blob_sha1"]) and a["sha256"] is None
 assert a["sha256_evidence_status"]=="PENDING_NO_ASSET_DOWNLOAD"
assert q["selected_asset_approved"] is False and q["license_approved"] is False
assert v["runner"]["model_runtime_measured"] is False and v["runner"]["fit_approved"] is False
assert v["resource_review"]["measured_idle_runner_only"] is True and v["resource_review"]["fit_approved"] is False
assert v["all_full_manifest_sha256_verified"] is False
assert v["release_gate"]=="BLOCKED" and v["acoustic_boundaries"]=="0/15"
assert v["model_downloads"]==0 and v["model_inference"] is False and v["prompt_b_eligible"] is False
print("M5_R3_LEDGER_STATIC_PASS hf=4 silero=1 complete_manifest_sha256=false model_downloads=0 inference=false release=BLOCKED")
