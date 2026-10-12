#!/usr/bin/env python3
"""Offline static-only M9 Stage1 diagnostic. stdlib only; no imports of audio/network code."""
import copy
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA = "data_research/m5/m9/stage1/M9-STAGE1-TTS-403-ISOLATED-DIAGNOSTIC-v1.json"
diagnostic = json.loads((ROOT / DATA).read_text(encoding="utf8"))
audio_source = (ROOT / "scripts/research_m9_stage1_audio.py").read_text(encoding="utf8")
audio_workflow = (ROOT / ".github/workflows/research-m9-stage1-audio.yml").read_text(encoding="utf8")

def validate(d, source, workflow):
    assert d["schema"] == "M9-STAGE1-TTS-403-ISOLATED-DIAGNOSTIC-v1"
    assert d["mode"] == "RESEARCH_ONLY_NO_NETWORK_TTS_NO_MEDIA"
    assert d["decision"] == "DIAGNOSIS_COMPLETE_CAUSE_UNDETERMINED_STAGE1_BLOCKED"
    evidence = d["original_evidence"]
    assert [(x["run"],x["job"]) for x in evidence] == [
        (38209098478,114679047203),(38209767664,114681096937)]
    assert all(x["conclusion"] == "failure" and "403" in x["symptom"] for x in evidence)
    current = d["current_workflow"]
    assert current["dependency"] == "edge-tts==7.2.7" and current["python"] == "3.12"
    assert current["voice"] == "zh-TW-YunJheNeural" and current["rate"] == "+15%"
    assert current["failure_phase"].startswith("websocket handshake")
    assert current["branch"] == "research/m9-controlled-private-preview-20261012"
    assert "edge-tts==7.2.7" in workflow
    assert "python-version: '3.12'" in workflow
    assert 'VOICE="zh-TW-YunJheNeural"; RATE="+15%"' in source
    assert "audio.unlink(missing_ok=True)" in source and 'stage1-failure.json' in source
    assert "partial_audio_removed" in source and "raise RuntimeError(" in source
    assert "permissions:\n  contents: read" in workflow
    assert "persist-credentials: false" in workflow
    assert "upload-artifact@v4" in workflow
    assert "No dependency auto-upgrade" in d["proposal"]["fail_closed"]
    assert all(value is False for value in d["locks"].values())
    assert set(d["locks"]) == {"stage1_audio_retry","stage2","render","production","cron","pages","youtube","publication"}
    return True

assert validate(diagnostic, audio_source, audio_workflow)
negatives=[]
def reject(name, mutate):
    d,s,w=copy.deepcopy(diagnostic),audio_source,audio_workflow
    d,s,w=mutate(d,s,w)
    try: validate(d,s,w)
    except (AssertionError, KeyError, TypeError, ValueError):
        negatives.append(name); return
    raise AssertionError("negative unexpectedly accepted: "+name)

def field(path,value):
    def change(d,s,w):
        target=d
        for key in path[:-1]: target=target[key]
        target[path[-1]]=value
        return d,s,w
    return change
reject("mode_unlock",field(["mode"],"ALLOW_NETWORK_TTS"))
reject("decision_false_pass",field(["decision"],"STAGE1_PASS"))
reject("original_run_mutated",field(["original_evidence",0,"run"],0))
reject("original_job_mutated",field(["original_evidence",1,"job"],0))
reject("403_erased",field(["original_evidence",0,"symptom"],"success"))
reject("original_failure_overridden",field(["original_evidence",1,"conclusion"],"success"))
reject("dependency_upgrade",field(["current_workflow","dependency"],"edge-tts==7.2.8"))
reject("voice_substitution",field(["current_workflow","voice"],"other"))
reject("rate_modified",field(["current_workflow","rate"],"+0%"))
reject("python_modified",field(["current_workflow","python"],"3.11"))
reject("unverified_cause_certainty",field(["decision"],"ROOT_CAUSE_PROVEN"))
reject("stage1_retry_unlocked",field(["locks","stage1_audio_retry"],True))
reject("stage2_unlocked",field(["locks","stage2"],True))
reject("render_unlocked",field(["locks","render"],True))
reject("youtube_unlocked",field(["locks","youtube"],True))
reject("publication_unlocked",field(["locks","publication"],True))
reject("partial_audio_cleanup_removed",lambda d,s,w:(d,s.replace("audio.unlink(missing_ok=True)","pass"),w))
reject("audio_failure_diagnostic_removed",lambda d,s,w:(d,s.replace("stage1-failure.json","missing.json"),w))
reject("dependency_unpinned",lambda d,s,w:(d,s,w.replace("edge-tts==7.2.7","edge-tts")))
reject("workflow_write_permission",lambda d,s,w:(d,s,w.replace("contents: read","contents: write")))
assert len(negatives)==20
print("M9_TTS_403_OFFLINE_DIAGNOSTIC_PASS original_runs=2 upstream_403=true pinned=edge-tts-7.2.7 voice=zh-TW-YunJheNeural rate=+15% cause=UNDETERMINED negatives=20 no_network=true no_audio=true locks=FALSE")
