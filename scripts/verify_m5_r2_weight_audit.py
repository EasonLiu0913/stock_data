#!/usr/bin/env python3
"""M5-R2 static fail-closed contract. No network, package installs, downloads or inference."""
import json, pathlib, re
p=pathlib.Path("data_research/m5/m5-r2-weight-audit.json")
v=json.loads(p.read_text(encoding="utf-8"))
assert v["schema"]=="M5-R2-WEIGHT-AUDIT-v1"
assert v["research_only"] is True and v["automatic_download"] is False and v["automatic_inference"] is False
assert v["release_gate"]=="BLOCKED" and v["status"]=="PENDING"
assert v["original_audio_count"]==7 and v["original_duration_seconds"]==79.416
assert v["fixed_opening"]=="大家好，歡迎來到 TAIWAN STOCK！"
assert v["original_audio_zip_sha256"]=="b29ab56784279c000a73e5174736c9d3d4eea7f2b330ce7d69f1919cdaee7a2a"
assert v["scene01_mp3_sha256"]=="a84daf97cb8036d78d942d734fb0b9b4d0b0e7c45164d48d5bdb57e50c6f26aa"
assert (v["verified_internal_boundaries"],v["total_internal_boundaries"])==(0,15)
assert set(v["locks"])=={"model_inference_authorized","pronunciation_approved","forced_alignment_executed","acoustic_sentence_boundary_verified","publication_authorized","prompt_b_eligible"}
assert all(x is False for x in v["locks"].values())
r=v["runner_reference"]
assert r["standard_linux_disk_gb"]==14 and r["public_ram_gb"]==16 and r["private_ram_gb"]==8
assert r["repo_visibility_verified"] is False and r["runner_fit_approved"] is False
assert all(r[k] is None for k in ("actual_free_disk_bytes","actual_available_ram_bytes","installed_dependency_lock_sha256","peak_rss_measured_bytes","cpu_runtime_measured_seconds"))
c=v["candidates"]
assert len(c)==5 and len({x["id"] or x["toolkit"] for x in c})==5
assert {x["role"] for x in c}=={"ASR","ALIGNER_SEPARATELY_GATED","NONLEXICAL_VAD_ONLY"}
for x in c:
 assert x["revision"] is None and x["revision_is_immutable"] is False
 assert all(x[k] is False for k in ("all_files_enumerated","downloaded_files_verified","license_review_approved","mixed_language_tested"))
 for f in x["candidate_metadata"]:
  assert re.fullmatch("[a-f0-9]{64}",f["upstream_lfs_sha256"])
  assert f["reported_bytes"] is None or f["reported_bytes"]>0
assert {x["id"]:x["candidate_metadata"][0]["upstream_lfs_sha256"] for x in c if x["candidate_metadata"]}=={
 "Qwen/Qwen3-ASR-0.6B":"79d6cbd4c98c7bbffe9db2edac07f56cd6637d0d5944b27f6c2b8353840323ea",
 "Qwen/Qwen3-ForcedAligner-0.6B":"47831d0e82f96b20e9034dba01a075ee06436654719f6a68289e49f1b65ce0e7"}
print("M5_R2_STATIC_CONTRACT_PASS candidates=5 weights_verified=false inference=false acoustic_boundaries=0/15 release=BLOCKED")
