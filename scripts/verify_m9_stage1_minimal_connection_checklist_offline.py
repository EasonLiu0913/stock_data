#!/usr/bin/env python3
"""Offline checklist-only verification: Python stdlib; no imports/network/media side effects."""
import copy,json
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
d=json.loads((ROOT/"data_research/m5/m9/stage1/M9-STAGE1-MINIMAL-CONNECTION-AUTHORIZATION-CHECKLIST-v1.json").read_text(encoding="utf8"))
p=json.loads((ROOT/"data_research/m5/m9/stage1/M9-STAGE1-CONTROLLED-CONNECTION-PREREG-v1.json").read_text(encoding="utf8"))
a=json.loads((ROOT/"data_research/m5/m9/stage1/M9-STAGE1-CONTROLLED-CONNECTION-OFFLINE-ACCEPTANCE-v1.json").read_text(encoding="utf8"))
def check(x):
 assert x["schema"]=="M9-STAGE1-MINIMAL-CONNECTION-AUTHORIZATION-CHECKLIST-v1" and x["mode"]=="OFFLINE_PLANNING_ONLY_NOT_EXECUTABLE"
 z=x["baseline"];assert (z["accepted_run"],z["accepted_job"],z["accepted_verdict"])==(a["run"],a["job"],a["decision"])
 assert z["actual_audio_state"]=="BLOCKED_UPSTREAM_403" and z["root_cause"]=="UNDETERMINED"
 now=x["current_allowed"];assert now["outbound_requests"]==0 and all(now[k] is False for k in ["dns","http","https","websocket","tts","media"])
 q=x["proposed_future_scope_not_authorized"]
 assert "separately explicit approval" in q["permission_model"]
 assert q["target_hostname"]=="speech.platform.bing.com" and "not independent endorsement" in q["hostname_grounding"]
 v=q["protocols"];assert [y["kind"] for y in v]==["DNS","HTTPS","WSS_WEBSOCKET_TLS"]
 assert v[0]["planned"]=="OPTIONAL_NOT_AUTHORIZED" and "0 now; at most one future specifically authorized lookup" in v[0]["attempts"]
 assert v[1]["planned"]=="NOT_AUTHORIZED_BY_THIS_CHECKLIST" and v[1]["attempts"]==0
 assert v[2]["planned"]=="SEPARATE_EXPLICIT_AUTHORIZATION_REQUIRED" and "at most one future specifically authorized handshake" in v[2]["attempts"]
 assert "Do not send synthesis content or trigger TTS" in v[2]["rule"]
 assert q["tts_synthesis"]=="NOT_AUTHORIZED" and "Strictly one permitted attempt" in q["request_budget"] and "DNS step plus handshake" in q["request_budget"]
 assert (q["version"],q["runtime"],q["voice"],q["rate"])==("edge-tts==7.2.7","Python 3.12","zh-TW-YunJheNeural","+15%")
 assert q["redaction"]["allowlist_only"] is True and q["redaction"]["rule"]=="Sanitize in memory before writing logs/artifacts; errors logged as class/code only"
 assert set(q["allowed_output_fields"])=={"timestamp_utc","runner_os","python_version","edge_tts_version","approved_endpoint_hostname","protocol_attempted","sanitized_status_class","sanitized_error_category","elapsed_ms"}
 assert {"TrustedClientToken","ConnectionId","Sec-MS-GEC","full URL or querystring","Authorization/Cookie headers","speech payload","raw traceback with URL"}.issubset(set(q["redaction"]["forbid"]))
 stop=q["stop"];assert stop["on_403"]=="BLOCKED_UPSTREAM_403_IMMEDIATE_STOP" and stop["on_timeout"]=="BLOCKED_STOP" and stop["on_unexpected_response"]=="BLOCKED_STOP" and stop["on_sensitive_data_risk"]=="ABORT_WITHOUT_ARTIFACT"
 assert all(stop[k] is False for k in ("automatic_retry","dependency_upgrade","alternative_voice_or_service"))
 assert q["version"]==p["fixed_parameters"]["dependency"] and q["voice"]==p["fixed_parameters"]["voice"] and q["rate"]==p["fixed_parameters"]["rate"]
 assert len(x["locks"])==13 and all(y is False for y in x["locks"].values())
 return True
check(d)
negative=[]
def reject(name,path,value):
 t=copy.deepcopy(d);z=t
 for k in path[:-1]:z=z[k]
 z[path[-1]]=value
 try:check(t)
 except (AssertionError,KeyError,TypeError,ValueError):negative.append(name);return
 raise AssertionError("unsafe mutation accepted: "+name)
for name,path,value in [
 ("mode",["mode"],"EXECUTE"),("run",["baseline","accepted_run"],0),("cause",["baseline","root_cause"],"PROVEN"),
 ("outbound",["current_allowed","outbound_requests"],1),("dns_now",["current_allowed","dns"],True),("https_now",["current_allowed","https"],True),
 ("websocket_now",["current_allowed","websocket"],True),("tts_now",["current_allowed","tts"],True),
 ("protocol_approval",["proposed_future_scope_not_authorized","permission_model"],"approval inherited"),
 ("hostname",["proposed_future_scope_not_authorized","target_hostname"],"alternative.invalid"),
 ("dns_unbounded",["proposed_future_scope_not_authorized","protocols",0,"attempts"],"unlimited"),
 ("https_probe",["proposed_future_scope_not_authorized","protocols",1,"attempts"],1),
 ("ws_implicit",["proposed_future_scope_not_authorized","protocols",2,"planned"],"AUTHORIZED"),
 ("ws_synthesis",["proposed_future_scope_not_authorized","protocols",2,"rule"],"synthesize speech"),
 ("tts_unlock",["proposed_future_scope_not_authorized","tts_synthesis"],"AUTHORIZED"),
 ("budget",["proposed_future_scope_not_authorized","request_budget"],"unlimited"),
 ("dependency",["proposed_future_scope_not_authorized","version"],"edge-tts==7.2.8"),
 ("voice",["proposed_future_scope_not_authorized","voice"],"different"),
 ("rate",["proposed_future_scope_not_authorized","rate"],"+0%"),
 ("outputs",["proposed_future_scope_not_authorized","allowed_output_fields"],["raw_url"]),
 ("redaction",["proposed_future_scope_not_authorized","redaction","allowlist_only"],False),
 ("forbid",["proposed_future_scope_not_authorized","redaction","forbid"],[]),
 ("http403",["proposed_future_scope_not_authorized","stop","on_403"],"RETRY"),
 ("automatic_retry",["proposed_future_scope_not_authorized","stop","automatic_retry"],True),
 ("upgrade",["proposed_future_scope_not_authorized","stop","dependency_upgrade"],True),
 ("network_unlock",["locks","network_diagnostic_authorized"],True),
 ("stage2_unlock",["locks","stage2_authorized"],True),
 ("publication_unlock",["locks","publication_authorized"],True)]:
 reject(name,path,value)
assert len(negative)==28
print("M9_MINIMAL_CONNECTION_CHECKLIST_STATIC_PASS offline=true protocol_gates=DNS_HTTPS_WSS separate_auth=true request_budget=1 no_tts=true redaction=ALLOWLIST stop403=IMMEDIATE negatives=28 network=false media=false locks=FALSE")
