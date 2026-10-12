#!/usr/bin/env python3
"""M9 single GET specification offline-only check. No network/TTS imports or requests."""
import copy,json
from pathlib import Path
root=Path(__file__).resolve().parents[1]
d=json.loads((root/"data_research/m5/m9/stage1/M9-STAGE1-SINGLE-GET-FAIL-FIRST-403-IMPLEMENTATION-PREREG-v1.json").read_text(encoding="utf-8"))
prior=json.loads((root/"data_research/m5/m9/stage1/M9-STAGE1-VOICE-LIST-PREREG-OFFLINE-INDEPENDENT-ACCEPTANCE-v1.json").read_text(encoding="utf-8"))
def check(x):
 assert x["schema"]=="M9-STAGE1-SINGLE-GET-FAIL-FIRST-403-IMPLEMENTATION-PREREG-v1"
 assert (x["mode"],x["status"])==("NON_EXECUTABLE_STATIC_DESIGN_ONLY","PENDING_INDEPENDENT_STATIC_ACCEPTANCE_NO_NETWORK_AUTHORIZATION")
 b=x["basis"];assert (b["run"],b["job"],b["negative_cases"])==(38218494173,114708777268,38)
 assert b["decision"]==prior["decision"] and b["upstream_tag"]=="7.2.7" and b["upstream_commit"]=="b45c019b9948e069c69c6ecb3a341badc970439c" and b["root_cause"]=="UNDETERMINED"
 t=x["target"];assert (t["protocol"],t["hostname"],t["path_only"])==("HTTPS_GET","speech.platform.bing.com","/consumer/speech/synthesize/readaloud/voices/list")
 assert t["no_alternate_endpoint"] is True and t["query_key_names_only"]==["trustedclienttoken","Sec-MS-GEC","Sec-MS-GEC-Version"]
 assert "never log values" in t["request_header_provenance"] and "neither synthesis nor WSS health-check proof" in t["purpose"]
 a=x["authorization"];assert a["current_outbound_operations"]==0
 assert all(a[k] is False for k in ("current_dns","current_https","current_http","current_wss","current_tts"))
 assert all(a[k] is True for k in ("future_https_get_requires_separate_explicit_owner_approval","future_dns_requires_separate_explicit_owner_approval","dns_operation_count_independently_disclosed","no_permission_inherited_from_static_pass"))
 assert "one GET maximum" in a["approval_must_specify"]
 algo=x["proposed_nonexecuting_algorithm"];assert len(algo)==7
 for token in ("do not invoke unmodified edge_tts.list_voices()","disable HTTP client status retries/redirects","never log URL","no second GET","never synthesize","actual stage1 audio BLOCKED"):
  assert any(token in line for line in algo)
 budget=x["request_budget"];assert budget=={"https_get_max":1,"redirect_follow_max":0,"automatic_retry_max":0,"hidden_403_second_get_max":0,"clock_skew_second_get_max":0,"dns":"NOT_AUTHORIZED_NOW_SEPARATE_EXPLICIT_COUNT_IF_FUTURE","current_total":0}
 assert x["outcomes"]=={"http_403":"BLOCKED_UPSTREAM_403_IMMEDIATE_STOP","timeout":"BLOCKED_TIMEOUT_STOP","redirect":"BLOCKED_UNEXPECTED_REDIRECT_STOP","unexpected":"BLOCKED_UNEXPECTED_STOP","redaction_failure":"ABORT_NO_ARTIFACT","success":"VOICE_LIST_METADATA_REACHABLE_ONLY_NOT_WSS_AUDIO_PASS"}
 z=x["redaction"];assert z["allowlist_only"] is True and z["before_artifact"] is True
 assert set(z["allowed_fields"])=={"timestamp_utc","runner_os","python_version","pinned_version","approved_hostname","protocol_class","sanitized_status_class","sanitized_error_category","elapsed_ms","attempt_count"}
 assert {"full_url_and_querystring","trustedclienttoken_value","Sec-MS-GEC_value","MUID_Cookie","all_request_response_headers","raw_traceback","raw_voice_list_body","raw_packets","speech_text"}.issubset(z["forbidden"])
 assert x["fixed"]=={"dependency":"edge-tts==7.2.7","voice":"zh-TW-YunJheNeural","rate":"+15%"}
 assert len(x["acceptance_gates"])==9 and len(x["locks"])==13 and all(v is False for v in x["locks"].values())
check(d)
negative=[]
def reject(label,path,value):
 x=copy.deepcopy(d);target=x
 for key in path[:-1]:target=target[key]
 target[path[-1]]=value
 try:check(x)
 except (AssertionError,KeyError,ValueError,TypeError):negative.append(label);return
 raise AssertionError("unsafe mutation accepted "+label)
cases=[
("execute_mode",["mode"],"EXECUTABLE"),("authorized_status",["status"],"AUTHORIZED"),
("baseline_run",["basis","run"],0),("baseline_negatives",["basis","negative_cases"],0),
("version_upgrade",["basis","upstream_tag"],"7.2.8"),("root_cause_fabricated",["basis","root_cause"],"PROVEN"),
("alternate_host",["target","hostname"],"other"),("alternate_path",["target","path_only"],"/health"),
("alternate_endpoint",["target","no_alternate_endpoint"],False),("query_params",["target","query_key_names_only"],[]),
("dns_now",["authorization","current_dns"],True),("https_now",["authorization","current_https"],True),
("external_ops",["authorization","current_outbound_operations"],1),
("dns_implicit",["authorization","future_dns_requires_separate_explicit_owner_approval"],False),
("https_implicit",["authorization","future_https_get_requires_separate_explicit_owner_approval"],False),
("budget_get",["request_budget","https_get_max"],2),("redirect",["request_budget","redirect_follow_max"],1),
("auto_retry",["request_budget","automatic_retry_max"],1),("hidden_retry",["request_budget","hidden_403_second_get_max"],1),
("clock_retry",["request_budget","clock_skew_second_get_max"],1),
("dns_budget_implicit",["request_budget","dns"],"FREE"),("403_retry",["outcomes","http_403"],"RETRY"),
("timeout_retry",["outcomes","timeout"],"RETRY"),("redirect_follow",["outcomes","redirect"],"FOLLOW"),
("success_overclaim",["outcomes","success"],"AUDIO_PASS"),("redaction_fail_writes",["outcomes","redaction_failure"],"WRITE"),
("no_allowlist",["redaction","allowlist_only"],False),("unsafe_allowed_fields",["redaction","allowed_fields"],["raw_url"]),
("secrets_not_forbidden",["redaction","forbidden"],[]),("artifact_before_redact",["redaction","before_artifact"],False),
("voice_change",["fixed","voice"],"other"),("rate_change",["fixed","rate"],"+0%"),
("upgrade_fixed",["fixed","dependency"],"edge-tts==7.2.8"),("dns_unlock",["locks","dns_authorized"],True),
("https_unlock",["locks","https_authorized"],True),("tts_unlock",["locks","tts_authorized"],True),
("stage2_unlock",["locks","stage2_authorized"],True),("youtube_unlock",["locks","youtube_authorized"],True),
("publication_unlock",["locks","publication_authorized"],True)]
for t in cases:reject(*t)
assert len(negative)==39
print("M9_SINGLE_GET_PREREG_OFFLINE_PASS get_max=1 dns=SEPARATE 403=FIRST_STOP redirects=0 hidden_retry=0 clock_recall=0 redaction=ALLOWLIST negatives=39 no_network=true no_media=true locks=FALSE")
