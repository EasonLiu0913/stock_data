#!/usr/bin/env python3
"""Offline JSON-only audit; no DNS, HTTP, TTS, subprocess or media imports."""
import copy,json
from pathlib import Path
p=Path(__file__).resolve().parents[1]/"data_research/m5/m9/stage1/M9-STAGE1-OPTION-C-DNS-FAILCLOSED-PREREG-v1.json"
d=json.loads(p.read_text(encoding="utf-8"))
def verify(x):
 assert (x["schema"],x["mode"],x["decision"])==("M9-STAGE1-OPTION-C-DNS-FAILCLOSED-PREREG-v1","OFFLINE_STATIC_NONEXECUTABLE","BLOCKED_PENDING_ENFORCEABLE_DNS_PROOF")
 assert x["baseline"]=={"run":38223016609,"negative_cases":43,"previous_decision":"BLOCKED_PENDING_DNS_BUDGET_PROOF"}
 a=x["accounting"]
 assert "not equivalent" in a["resolver_calls"] and "A and AAAA" in a["dns_questions"] and "UDP/TCP/DoH" in a["network_packets"]
 assert a["equivalence_assumed"] is False and a["current_external_operations"]==0 and a["budget_unit"]=="UNDECIDED_REQUIRES_OWNER_APPROVAL"
 assert a["proposed_budget"]=="NO_NUMERIC_BUDGET_UNTIL_AUDITABLE_EGRESS_BOUNDARY_DEMONSTRATED"
 r=x["resolver_boundary"]
 assert r["method"]=="OFFLINE_DESIGN_ONLY" and "UNBOUNDED" in r["implicit_os_getaddrinfo"]
 assert "cache hit does not prove" in r["cache_behavior"] and r["a_aaaa_cname_retry"]=="MUST_ACCOUNT_SEPARATELY"
 assert r["unexpected_resolution"]=="FAIL_CLOSED_BEFORE_HTTPS" and r["excess"]=="STOP_AND_BLOCK_NO_FALLBACK"
 assert r["unobservable_packets"]=="BLOCKED_NO_EXECUTION" and r["proxy_fallback"] is False
 t=x["runner"];assert t["label"]=="ubuntu-latest" and t["immutable"] is False and t["require_exact_image_version_and_digest_evidence"] is True
 assert t["require_python_version"]=="3.12" and t["utc_window"]=="NOT_SPECIFIED_NOT_AUTHORIZED" and t["no_assumption_from_label"] is True
 h=x["https"];assert (h["get_max"],h["redirects"],h["retries"],h["clock_skew_second_get"],h["wall_clock_seconds"],h["connect_seconds"],h["request_seconds"])==(1,0,0,0,30,10,20)
 assert h["currently_authorized"] is False and h["first403"]=="BLOCKED_UPSTREAM_403_IMMEDIATE_STOP"
 z=x["privacy"];assert z["allowlist_only"] is True and z["redaction_failure"]=="ABORT_NO_ARTIFACT" and len(z["never_store"])==8
 assert len(x["acceptance"])==7 and len(x["locks"])==11 and all(v is False for v in x["locks"].values())
verify(d)
passed=[]
def reject(name,path,val):
 y=copy.deepcopy(d);q=y
 for k in path[:-1]:q=q[k]
 q[path[-1]]=val
 try:verify(y)
 except (AssertionError,KeyError,TypeError,ValueError):passed.append(name);return
 raise AssertionError("mutation accepted "+name)
cases=[
("mode",["mode"],"EXECUTE"),("decision",["decision"],"APPROVED"),("prior",["baseline","run"],0),
("one_call_one_packet",["accounting","equivalence_assumed"],True),("resolver_calls",["accounting","resolver_calls"],"One query"),
("questions",["accounting","dns_questions"],"One only"),("packets",["accounting","network_packets"],"One only"),
("budget_unit",["accounting","budget_unit"],"ONE_GET"),("numeric_budget",["accounting","proposed_budget"],1),
("operation",["accounting","current_external_operations"],1),("implicit_dns",["resolver_boundary","implicit_os_getaddrinfo"],"SAFE"),
("cache",["resolver_boundary","cache_behavior"],"cache means no risk"),("chain",["resolver_boundary","a_aaaa_cname_retry"],"IGNORE"),
("unexpected",["resolver_boundary","unexpected_resolution"],"CONTINUE"),("excess",["resolver_boundary","excess"],"RETRY"),
("unobservable",["resolver_boundary","unobservable_packets"],"ALLOW"),("proxy",["resolver_boundary","proxy_fallback"],True),
("immutable",["runner","immutable"],True),("image_proof",["runner","require_exact_image_version_and_digest_evidence"],False),
("window",["runner","utc_window"],"ANYTIME"),("get_twice",["https","get_max"],2),("redirect",["https","redirects"],1),
("retry",["https","retries"],1),("clock_recall",["https","clock_skew_second_get"],1),("time",["https","wall_clock_seconds"],60),
("https_authorized",["https","currently_authorized"],True),("403",["https","first403"],"RETRY"),
("redaction",["privacy","allowlist_only"],False),("leak",["privacy","never_store"],[]),("artifact",["privacy","redaction_failure"],"WRITE"),
("dns_lock",["locks","dns_authorized"],True),("https_lock",["locks","https_authorized"],True),("youtube_lock",["locks","youtube_authorized"],True)]
for c in cases:reject(*c)
assert len(passed)==33
print("M9_DNS_FAILCLOSED_STATIC_PASS negatives=33 resolver_calls!=questions!=packets budget=UNPROVEN_BLOCKED runner=NOT_IMMUTABLE get_max=1 time=30s no_network=true no_media=true locks=FALSE")
