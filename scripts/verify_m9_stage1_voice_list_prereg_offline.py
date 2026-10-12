#!/usr/bin/env python3
"""Offline stdlib-only contract verification; never imports network or TTS modules."""
import copy,json
from pathlib import Path
r=Path(__file__).resolve().parents[1]
c=json.loads((r/"data_research/m5/m9/stage1/M9-STAGE1-VOICE-LIST-HTTPS-NONSYNTHESIS-PREREG-v1.json").read_text())
a=json.loads((r/"data_research/m5/m9/stage1/M9-STAGE1-MINIMAL-CONNECTION-CHECKLIST-OFFLINE-ACCEPTANCE-v1.json").read_text())
def verify(x):
 assert x["schema"]=="M9-STAGE1-VOICE-LIST-HTTPS-NONSYNTHESIS-PREREG-v1"
 assert (x["mode"],x["status"])==("OFFLINE_STATIC_PREREG_ONLY","NOT_AUTHORIZED_NOT_EXECUTABLE")
 b=x["basis"];assert (b["checklist_run"],b["checklist_job"],b["negative_cases"])==(38214871915,114697162036,28)
 assert b["checklist_decision"]==a["decision"] and b["upstream_tag"]=="7.2.7"
 assert b["upstream_commit"]=="b45c019b9948e069c69c6ecb3a341badc970439c"
 u=x["upstream_implementation"]
 assert (u["method"],u["protocol"],u["hostname"],u["path_only"])==("aiohttp.ClientSession.get","HTTPS_GET","speech.platform.bing.com","/consumer/speech/synthesize/readaloud/voices/list")
 assert u["parameters_names_only"]==["trustedclienttoken","Sec-MS-GEC","Sec-MS-GEC-Version"]
 assert u["full_url_or_parameter_values"]=="NEVER_LOG_OR_COPY" and u["tts_synthesis"] is False
 assert "second __list_voices GET" in u["hidden_retry"] and "status 403" in u["hidden_retry"] and u["single_call_safe"] is False
 n=x["current_permission"];assert n["outbound_requests"]==0 and all(n[k] is False for k in ("dns","https","http","websocket","tts","media"))
 f=x["future_proposal_only"]
 assert "never call unmodified list_voices" in f["method"] and "separately explicitly authorize" in f["authorization"]
 assert f["request_budget"]=={"https_get_max":1,"hidden_retry_max":0,"automatic_clock_skew_recall":False,"dns":"Separately count and approve if necessary"}
 assert f["on_403"]=="IMMEDIATE_BLOCKED_UPSTREAM_403_NO_RETRY" and f["on_timeout"]=="IMMEDIATE_BLOCKED_NO_RETRY"
 assert f["on_unexpected"]=="STOP_NO_RETRY" and f["on_missing_redaction"]=="ABORT_BEFORE_ARTIFACT"
 assert all(f[k] is True for k in ("no_synthesis","no_alternative_endpoint","no_upgrade","no_proxy_or_egress_bypass"))
 z=x["redaction"];assert z["allowlist_only"] is True and z["rule"]=="Sanitize in memory prior to log or artifact; on redaction failure write no artifact"
 assert set(z["allowed_output"])=={"timestamp_utc","pinned_version","runner_os","python_version","protocol_class","approved_hostname","sanitized_status_class","sanitized_error_category","elapsed_ms","attempt_count"}
 assert {"full URI and querystring","trustedclienttoken value","Sec-MS-GEC value","MUID Cookie","request or response headers","raw traceback containing URL","voice inventory response body","speech payload"}.issubset(z["never_store"])
 assert x["fixed"]=={"dependency":"edge-tts==7.2.7","python":"3.12","voice":"zh-TW-YunJheNeural","rate":"+15%"}
 assert len(x["scope_limits"])==4 and "Voice-list HTTPS success does not prove WSS synthesis availability" in x["scope_limits"]
 assert len(x["locks"])==13 and all(v is False for v in x["locks"].values())
verify(c)
neg=[]
def reject(name,path,val):
 t=copy.deepcopy(c);z=t
 for key in path[:-1]:z=z[key]
 z[path[-1]]=val
 try:verify(t)
 except (AssertionError,KeyError,TypeError,ValueError):neg.append(name);return
 raise AssertionError("unsafe mutation accepted: "+name)
cases=[
("mode",["mode"],"EXECUTE"),("status",["status"],"AUTHORIZED"),("run",["basis","checklist_run"],0),
("upstream_version",["basis","upstream_tag"],"7.2.8"),("source_commit",["basis","upstream_commit"],"bad"),
("method",["upstream_implementation","method"],"POST"),("host",["upstream_implementation","hostname"],"other"),
("params",["upstream_implementation","parameters_names_only"],[]),("raw_url",["upstream_implementation","full_url_or_parameter_values"],"LOG"),
("synthesis",["upstream_implementation","tts_synthesis"],True),("hidden_retry_erased",["upstream_implementation","hidden_retry"],"one GET"),
("unsafe_list_voices",["upstream_implementation","single_call_safe"],True),
("dns_now",["current_permission","dns"],True),("https_now",["current_permission","https"],True),("outbound_now",["current_permission","outbound_requests"],1),
("implicit_auth",["future_proposal_only","authorization"],"already approved"),
("unmodified_list",["future_proposal_only","method"],"call list_voices"),
("two_gets",["future_proposal_only","request_budget","https_get_max"],2),
("hidden_retry",["future_proposal_only","request_budget","hidden_retry_max"],1),
("clock_recall",["future_proposal_only","request_budget","automatic_clock_skew_recall"],True),
("dns_implicit",["future_proposal_only","request_budget","dns"],"implicit"),
("403_retry",["future_proposal_only","on_403"],"RETRY"),
("timeout_retry",["future_proposal_only","on_timeout"],"RETRY"),
("redaction_abort_missing",["future_proposal_only","on_missing_redaction"],"CONTINUE"),
("synthesis_unlock",["future_proposal_only","no_synthesis"],False),("auto_upgrade",["future_proposal_only","no_upgrade"],False),
("redaction_allowlist",["redaction","allowlist_only"],False),("raw_output",["redaction","allowed_output"],["full URI"]),
("secret_forbid",["redaction","never_store"],[]),("voice",["fixed","voice"],"other"),
("rate",["fixed","rate"],"+0%"),("dependency",["fixed","dependency"],"edge-tts==7.2.8"),
("network_lock",["locks","network_diagnostic_authorized"],True),("dns_lock",["locks","dns_authorized"],True),
("https_lock",["locks","https_authorized"],True),("stage2_lock",["locks","stage2_authorized"],True),
("youtube_lock",["locks","youtube_authorized"],True),("publication_lock",["locks","publication_authorized"],True)]
for args in cases:reject(*args)
assert len(neg)==38
print("M9_VOICE_LIST_PREREG_OFFLINE_PASS upstream=7.2.7 hidden_403_second_GET=REJECTED https_get_max=1 dns_separate=true voice=zh-TW-YunJheNeural rate=+15% redaction=ALLOWLIST negatives=38 no_network=true no_media=true locks=FALSE")
