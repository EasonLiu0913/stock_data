#!/usr/bin/env python3
"""Offline ONLY M9 Stage1 diagnosis: never imports edge_tts, accesses network or generates media."""
import json
from pathlib import Path
R=Path(__file__).resolve().parents[1]
p=json.loads((R/"data_research/m5/m9/stage1/M9-STAGE1-TTS-403-ISOLATED-DIAGNOSTIC-v1.json").read_text())
script=(R/"scripts/research_m9_stage1_audio.py").read_text()
workflow=(R/".github/workflows/research-m9-stage1-audio.yml").read_text()
assert p["mode"]=="RESEARCH_ONLY_NO_NETWORK_TTS_NO_MEDIA"
assert p["decision"]=="DIAGNOSIS_COMPLETE_CAUSE_UNDETERMINED_STAGE1_BLOCKED"
assert [z["run"] for z in p["original_evidence"]]==[38209098478,38209767664]
assert all(z["conclusion"]=="failure" and "403" in z["symptom"] for z in p["original_evidence"])
assert "edge-tts==7.2.7" in workflow and 'VOICE="zh-TW-YunJheNeural"; RATE="+15%"' in script
assert "audio.unlink(missing_ok=True)" in script
assert 'stage1-failure.json' in script
assert "upload-artifact@v4" in workflow and "permissions:\n  contents: read" in workflow
assert all(z is False for z in p["locks"].values())
assert "no dependency auto-upgrade" in p["proposal"]["fail_closed"].lower()
print("M9_TTS_403_OFFLINE_DIAGNOSTIC_PASS original_runs=2 upstream_403=true cause=UNDETERMINED no_network=true no_audio=true locks=FALSE")
