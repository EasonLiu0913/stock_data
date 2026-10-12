#!/usr/bin/env python3
"""Offline static-only final owner authorization audit; no network/voice imports."""
import copy,json
from pathlib import Path
root=Path(__file__).resolve().parents[1]/"data_research/m5/m9/stage1"
d=json.loads((root/"M9-STAGE1-SINGLE-GET-FINAL-AUTHORIZATION-REVIEW-v1.json").read_text())
a=json.loads((root/"M9-STAGE1-SINGLE-GET-OFFLINE-INDEPENDENT-ACCEPTANCE-v1.json").read_text())
def check(x):
 assert (x["schema"],x["mode"],x["decision"])==("M9-STAGE1-SINGLE-GET-FINAL-AUTHORIZATION-REVIEW-v1","DOCUMENT_ONLY_NO_EXECUTION","READY_FOR_OWNER_REVIEW_NOT_AUTHORIZED")
 e=x["evidence"];assert (e["accepted_run"],e["accepted_job"],e["accepted_sha"],e["negative_cases"],e["accepted_decision"])==(a["basis"]["run"],a["basis"]["job"],a["basis"]["head_sha"],39,a["decision"])
 assert e["stage1_audio"]=="BLOCKED_UPSTREAM_403" and e["cause"]=="UNDETERMINED"
 s=x["scope"];assert (s["protocol"],s["exact_hostname"],s["exact_path"])==("HTTPS GET","speech.platform.bing.com","/consumer/speech/synthesize/readaloud/voices/list")
 assert s["query_keys_names_only"]==["trustedclienttoken","Sec-MS-GEC","Sec-MS-GEC-Version"]
 assert s["do_not_persist_full_url"] is True and "not unmodified edge_tts.list_voices()" in s["method"]
 assert (s["https_get_limit"],s["redirect_follow_limit"],s["hidden_retry_limit"],s["clock_skew_recall_limit"],s["auto_retry_limit"])==(1,0,0,0,0)
 dns=s["dns"];assert dns["authorized_now"] is False and dns["independent_owner_approval_required"] is True and "NO_IMPLICIT_LOOKUP" in dns["operation_budget"] and "remain BLOCKED" in dns["note"]
 t=s["time"];assert t["authorized_now"] is False and (t["proposed_wall_clock_limit_seconds"],t["proposed_connect_timeout_seconds"],t["proposed_total_request_timeout_seconds"])==(30,10,20) and "separate owner approval" in t["runner_and_window"]
 assert s["fixed"]=={"dependency":"edge-tts==7.2.7","python":"3.12","voice":"zh-TW-YunJheNeural","rate":"+15%"}
 p=x["privacy"];assert set(p["allowlisted_artifact_fields"])=={"timestamp_utc","runner_os","python_version","pinned_version","approved_hostname","protocol_class","sanitized_status_class","sanitized_error_category","elapsed_ms","attempt_count","decision","source_contract_sha256"}
 assert {"full request URL/query or signed parameter values","trustedclienttoken value","Sec-MS-GEC and Sec-MS-GEC-Version values","Cookie or MUID","request/response headers","raw traceback/packet capture","voice-list body","speech text and audio"}.issubset(set(p["never_capture"]))
 assert "redaction failure => no artifact" in p["policy"]
 assert x["stop_conditions"]=={"first_403":"BLOCKED_UPSTREAM_403_IMMEDIATE_STOP_NO_SECOND_GET","redirect":"BLOCKED_REDIRECT_STOP_NO_FOLLOW","timeout":"BLOCKED_TIMEOUT_NO_RETRY","unexpected_status":"BLOCKED_UNEXPECTED_STOP","hidden_retry_detected":"ABORT_AND_FAIL_REVIEW","dns_scope_unknown":"BLOCKED_BEFORE_REQUEST","approval_missing":"BLOCKED_BEFORE_REQUEST","redaction_failed":"ABORT_WITHOUT_ARTIFACT"}
 f=x["proposed_evidence_artifact"];assert f["filename"]=="m9-stage1-voice-list-sanitized-diagnostic.json" and "NOT_CREATED_BY_THIS_REVIEW" in f["creation"] and f["audio_files"]==0 and f["success_verdict"]=="VOICE_LIST_METADATA_REACHABLE_ONLY_NOT_WSS_AUDIO_PASS"
 assert len(x["prohibitions"])==6 and all("No " in line for line in x["prohibitions"])
 assert len(x["owner_authorization_checklist"])==5 and all(item["approved"] is False for item in x["owner_authorization_checklist"])
 assert len(x["current_locks"])==13 and all(v is False for v in x["current_locks"].values())
check(d)
passed=[]
def negative(name,path,value):
 q=copy.deepcopy(d);r=q
 for k in path[:-1]:r=r[k]
 r[path[-1]]=value
 try:check(q)
 except (AssertionError,KeyError,TypeError,ValueError):passed.append(name);return
 raise AssertionError("unsafe mutation accepted: "+name)
cases=[
("execute",["mode"],"EXECUTE"),("approve",["decision"],"AUTHORIZED"),("prior_run",["evidence","accepted_run"],0),
("prior_negatives",["evidence","negative_cases"],0),("403_cause",["evidence","cause"],"PROVEN"),
("protocol",["scope","protocol"],"WSS"),("host",["scope","exact_hostname"],"alternate"),("path",["scope","exact_path"],"/health"),
("querykeys",["scope","query_keys_names_only"],[]),("url_logging",["scope","do_not_persist_full_url"],False),
("get_twice",["scope","https_get_limit"],2),("redirect",["scope","redirect_follow_limit"],1),
("hidden_retry",["scope","hidden_retry_limit"],1),("clock_retry",["scope","clock_skew_recall_limit"],1),
("auto_retry",["scope","auto_retry_limit"],1),("dns_now",["scope","dns","authorized_now"],True),
("dns_implicit",["scope","dns","independent_owner_approval_required"],False),("dns_budget",["scope","dns","operation_budget"],"implicit"),
("time_auth",["scope","time","authorized_now"],True),("wallclock",["scope","time","proposed_wall_clock_limit_seconds"],60),
("connect",["scope","time","proposed_connect_timeout_seconds"],60),("request_timeout",["scope","time","proposed_total_request_timeout_seconds"],60),
("version",["scope","fixed","dependency"],"edge-tts==7.2.8"),("voice",["scope","fixed","voice"],"other"),("rate",["scope","fixed","rate"],"+0%"),
("allow_raw",["privacy","allowlisted_artifact_fields"],["full_url"]),("erase_forbids",["privacy","never_capture"],[]),
("privacy_policy",["privacy","policy"],"save unredacted"),
("403_second_get",["stop_conditions","first_403"],"RETRY"),("redirect_follow",["stop_conditions","redirect"],"FOLLOW"),
("timeout_retry",["stop_conditions","timeout"],"RETRY"),("missing_auth_continue",["stop_conditions","approval_missing"],"CONTINUE"),
("redaction_continue",["stop_conditions","redaction_failed"],"SAVE"),
("artifact_name",["proposed_evidence_artifact","filename"],"audio.mp3"),
("artifact_now",["proposed_evidence_artifact","creation"],"CREATED_NOW"),("audio",["proposed_evidence_artifact","audio_files"],1),
("claim_audio_success",["proposed_evidence_artifact","success_verdict"],"AUDIO_PASS"),
("owner_approved",["owner_authorization_checklist",0,"approved"],True),
("dns_lock",["current_locks","dns_authorized"],True),("https_lock",["current_locks","https_authorized"],True),
("stage2_lock",["current_locks","stage2_authorized"],True),("youtube_lock",["current_locks","youtube_authorized"],True),
("publication_lock",["current_locks","publication_authorized"],True)]
for c in cases:negative(*c)
assert len(passed)==43
print("M9_FINAL_AUTH_REVIEW_OFFLINE_PASS negatives=43 one_GET=true dns=SEPARATE time_max=30s redaction=ALLOWLIST first403=STOP artifact=FUTURE_ONLY owner_approvals=FALSE network=false media=false locks=FALSE")
