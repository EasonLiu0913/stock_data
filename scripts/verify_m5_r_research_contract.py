#!/usr/bin/env python3
"""M5-R preregistration invariants. No audio, inference, model downloads or alignments."""
import json,pathlib,re
p=pathlib.Path("data_research/m5/m5-r-model-inventory.json")
v=json.loads(p.read_text())
assert v["contract"]=="M5-R-SOURCE-INVENTORY-v1"
for k in ("publication_authorized","acoustic_sentence_boundary_verified","forced_alignment_executed","pronunciation_approved","model_inference_authorized"):assert v[k] is False,k
assert v["original_audio_zip_sha256"]=="b29ab56784279c000a73e5174736c9d3d4eea7f2b330ce7d69f1919cdaee7a2a"
assert v["scene01_mp3_sha256"]=="a84daf97cb8036d78d942d734fb0b9b4d0b0e7c45164d48d5bdb57e50c6f26aa"
want={"modelscope/FunASR","SYSTRAN/faster-whisper","QwenLM/Qwen3-ASR","snakers4/silero-vad"}
assert {x["repo"] for x in v["models"]}==want and len(v["models"])==4
for x in v["models"]:
 assert re.fullmatch("[0-9a-f]{40}",x["commit"])
 assert x["repo_license"] in {"MIT","Apache-2.0"}
 assert x["model_id"] is None and x["model_revision"] is None and x["weights_sha256"] is None
 for k in ("weights_license_reviewed","resource_profile_reviewed","mixed_language_tested"):assert x[k] is False
print("M5_R_PREREGISTRATION_ONLY repositories=4 model_inference=false acoustic_boundaries=0/15 publication=false")
