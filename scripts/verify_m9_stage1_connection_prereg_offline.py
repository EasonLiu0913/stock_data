#!/usr/bin/env python3
"""M9 contract-only offline verifier; stdlib; no network/audio imports or calls."""
import copy,json
from pathlib import Path
p=Path(__file__).resolve().parents[1]/"data_research/m5/m9/stage1/M9-STAGE1-CONTROLLED-CONNECTION-PREREG-v1.json"
d=json.loads(p.read_text(encoding="utf8"))
def verify(x):
 assert x["schema"]=="M9-STAGE1-EDGE-TTS-CONTROLLED-CONNECTION-PREREG-v1"
 assert x["mode"]=="NON_EXECUTABLE_PREREGISTRATION_ONLY" and x["status"]=="DRAFT_RESEARCH_NO_NETWORK_PERMISSION"
 e=x["evidence"];assert (e["offline_run"],e["offline_job"],e["negative_cases"])==(38212695855,114690238650,20)
 assert e["offline_verdict"]=="PASS_SCOPED_OFFLINE_DIAGNOSTIC_ONLY" and e["failed_audio_runs"]==[38209098478,38209767664]
 assert e["observed_error"]=="WSServerHandshakeError HTTP 403" and e["cause"]=="UNDETERMINED"
 f=x["fixed_parameters"];assert (f["dependency"],f["voice"],f["rate"],f["python"])==("edge-tts==7.2.7","zh-TW-YunJheNeural","+15%","3.12")
 assert f["alternative_voice_or_service"]=="NOT_AUTHORIZED" and f["automatic_upgrade"] is False
 assert len(x["future_optional_checks_requiring_separate_explicit_approval"])==1
 q=x["future_optional_checks_requiring_separate_explicit_approval"][0]
 assert q["stage"]=="metadata_only" and q["max_attempts"]==1
 assert all(word in q["boundaries"] for word in ("specifically approved","allowlisted","no synthesized text","whether handshake itself is permitted must be expressly granted"))
 assert "BLOCKED_UPSTREAM_403" in q["on_403"] and "do not auto-retry or launch TTS" in q["on_403"]
 denied=x["sensitive_redaction"]["prohibit_capture"]
 for key in ("TrustedClientToken","ConnectionId","Sec-MS-GEC","Sec-MS-GEC-Version values","signed or full querystring URL","Authorization and Cookie headers","environment variables or secrets"):
  assert key in denied
 assert "Allowlisted structured fields only" in x["sensitive_redaction"]["logs"]
 assert "do not print traceback URL" in x["sensitive_redaction"]["logs"]
 assert "no raw handshake packet dump" in x["sensitive_redaction"]["storage"]
 fail=x["fail_closed"]
 for rule in ("Default deny for all outbound requests including DNS probes, HTTP and WebSocket","No import/invocation of edge_tts in preregistration or offline tests","Missing explicit narrow user permission => no network check","Unexpected response or 403 => BLOCKED, no automatic retry or dependency upgrade","No MP3/SRT/WordBoundary generation; no Stage2/render/deploy/upload"):
  assert rule in fail
 assert len(x["locks"])==10 and all(v is False for v in x["locks"].values())
 return True
verify(d)
passed=[]
def reject(name, fn):
 x=copy.deepcopy(d);fn(x)
 try:verify(x)
 except (AssertionError,KeyError,TypeError,ValueError):passed.append(name);return
 raise AssertionError("mutation accepted: "+name)
def change(path,val):
 def f(x):
  for k in path[:-1]:x=x[k]
  x[path[-1]]=val
 return f
for name,path,val in [
 ("mode",["mode"],"EXECUTE"),("status",["status"],"AUTHORIZED"),("run",["evidence","offline_run"],0),
 ("job",["evidence","offline_job"],0),("source_negatives",["evidence","negative_cases"],0),
 ("error_erased",["evidence","observed_error"],"OK"),("cause_fabricated",["evidence","cause"],"PROVEN"),
 ("dependency",["fixed_parameters","dependency"],"edge-tts==7.2.8"),
 ("voice",["fixed_parameters","voice"],"other"),("rate",["fixed_parameters","rate"],"+0%"),
 ("upgrade",["fixed_parameters","automatic_upgrade"],True),("alternate",["fixed_parameters","alternative_voice_or_service"],"YES"),
 ("attempts",["future_optional_checks_requiring_separate_explicit_approval",0,"max_attempts"],2),
 ("403_auto_retry",["future_optional_checks_requiring_separate_explicit_approval",0,"on_403"],"retry"),
 ("redaction_removed",["sensitive_redaction","prohibit_capture"],[]),
 ("logging_raw_url",["sensitive_redaction","logs"],"Log raw URL"),
 ("packet_dump",["sensitive_redaction","storage"],"save raw handshake"),
 ("default_deny_removed",["fail_closed"],[]),
 ("network_unlock",["locks","network_diagnostic_authorized"],True),
 ("tts_unlock",["locks","tts_retry_authorized"],True),
 ("stage2_unlock",["locks","stage2_authorized"],True),
 ("youtube_unlock",["locks","youtube_authorized"],True)]:
 reject(name,change(path,val))
assert len(passed)==22
print("M9_CONNECTION_PREREG_STATIC_PASS offline=true default_deny=DNS_HTTP_WEBSOCKET redaction=ALLOWLIST upstream403=BLOCKED voice=zh-TW-YunJheNeural rate=+15% dependency=edge-tts-7.2.7 negatives=22 network=false media=false locks=FALSE")
