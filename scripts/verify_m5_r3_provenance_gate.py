#!/usr/bin/env python3
"""Static M5-R3 provenance contract check; no network, installs, weights, or inference."""
import json
from pathlib import Path
p = json.loads(Path("data_research/m5/m5-r3-provenance-gate.json").read_text(encoding="utf-8"))
assert p["schema"] == "M5-R3-PROVENANCE-GATE-v1"
assert p["status"] == "PENDING" and p["progress"] == "PROGRESS"
assert p["baseline"]["handoff_commit"] == "f90567381f8a2ca2e3aba014b5921af4d2829793"
assert p["baseline"]["static_ci_run"] == 38145356972
assert p["baseline"]["artifact_id"] == 11704134968
assert p["baseline"]["artifact_zip_sha256"] == "2d388551c1ad74e7650474e6d73371b9539a1d812adcf8628bec52cb17bc1c93"
assert len(p["candidates"]) == 5 and len({x["name"] for x in p["candidates"]}) == 5
assert {x["role"] for x in p["candidates"]} == {"ASR", "SEPARATELY_GATED_ALIGNER", "NONLEXICAL_VAD_ONLY"}
for x in p["candidates"]:
    assert x["immutable_revision"] is None and x["official_snapshot_capture_sha256"] is None
    assert x["complete_file_manifest"] == [] and x["manifest_complete"] is False
    assert x["weight_license_evidence_url"] is None and x["weight_license_approved"] is False
    assert x["ci_fit_approved"] is False and x["model_execution_authorized"] is False
    assert all(x[k] is None for k in ("estimated_weight_bytes", "measured_cpu_seconds", "measured_peak_ram_bytes", "measured_disk_bytes"))
assert p["runner"]["fit_approved"] is False
assert all(p["runner"][x] is None for x in ("actual_free_disk_bytes","actual_available_ram_bytes","dependency_lock_sha256"))
o = p["original"]
assert (o["audio_count"],o["duration_seconds"],o["verified_internal_boundaries"],o["total_internal_boundaries"]) == (7,79.416,0,15)
assert o["zip_sha256"] == "b29ab56784279c000a73e5174736c9d3d4eea7f2b330ce7d69f1919cdaee7a2a"
assert o["scene01_sha256"] == "a84daf97cb8036d78d942d734fb0b9b4d0b0e7c45164d48d5bdb57e50c6f26aa"
assert o["fixed_opening"] == "大家好，歡迎來到 TAIWAN STOCK！"
assert len(p["locks"]) == 6 and all(v is False for v in p["locks"].values())
assert p["research_only"] is True and p["automatic_download"] is False and p["automatic_inference"] is False
assert p["release_gate"] == "BLOCKED"
print("M5_R3_STATIC_PREREGISTRATION_PASS candidates=5 snapshots_verified=false weights_verified=false inference=false acoustic_boundaries=0/15 release=BLOCKED")
