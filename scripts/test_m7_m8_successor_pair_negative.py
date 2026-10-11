#!/usr/bin/env python3
"""Isolated negative-case verification of successor draft; no repository mutation."""
import copy
import json
import subprocess
import sys
import tempfile
from pathlib import Path

root = Path(__file__).resolve().parents[1]
source = json.loads((root / "data_research/m5/change-proposals/M7-M8-SUCCESSOR-PAIR-v1.json").read_text(encoding="utf-8"))
verifier = (root / "scripts/verify_m7_m8_successor_pair_draft.py").read_bytes()

def verify(candidate):
    with tempfile.TemporaryDirectory(prefix="successor-negative-") as directory:
        base = Path(directory)
        script = base / "scripts/verify_m7_m8_successor_pair_draft.py"
        pair = base / "data_research/m5/change-proposals/M7-M8-SUCCESSOR-PAIR-v1.json"
        script.parent.mkdir(parents=True)
        pair.parent.mkdir(parents=True)
        script.write_bytes(verifier)
        pair.write_text(json.dumps(candidate, ensure_ascii=False), encoding="utf-8")
        return subprocess.run([sys.executable, str(script)], capture_output=True, text=True, check=False)

baseline = verify(source)
assert baseline.returncode == 0 and "SUCCESSOR_DRAFT_STATIC_PASS" in baseline.stdout, baseline.stderr
cases = {
    "publication_lock": lambda x: x["locks"].__setitem__("publication_authorized", True),
    "youtube_lock": lambda x: x["locks"].__setitem__("youtube_authorized", True),
    "original_m7_retroactive_pass": lambda x: x["historical"].__setitem__("original_m7_prompt_b_pass", "PASS"),
    "original_m7_semantics": lambda x: x["original_charter_roadmap"].__setitem__("private_visual_m7_is_not_original_charter_m7", False),
    "main_preregistration": lambda x: x["preregistration"].__setitem__("main_preregistered", True),
    "successor_a_premature": lambda x: x["successor"]["prompt_a"].__setitem__("status", "COMPLETE"),
    "successor_b_premature": lambda x: x["successor"]["prompt_b"].__setitem__("status", "COMPLETE"),
    "unverified_acoustic": lambda x: x["historical"].__setitem__("acoustic_boundaries_verified", "15/15"),
}
for name, mutation in cases.items():
    candidate = copy.deepcopy(source)
    mutation(candidate)
    result = verify(candidate)
    assert result.returncode != 0, f"{name}: fail-open"
    assert "SUCCESSOR_DRAFT_STATIC_PASS" not in result.stdout, f"{name}: misleading PASS"
    print(f"NEGATIVE_CASE_REJECTED {name}")
print(f"SUCCESSOR_NEGATIVE_STATIC_PASS cases={len(cases)} baseline=PASS release=BLOCKED")
