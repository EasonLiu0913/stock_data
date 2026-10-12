#!/usr/bin/env python3
"""Offline-only JSON research contract audit; no network modules."""
import copy,json
from pathlib import Path
p=Path(__file__).resolve().parents[1]/"data_research/m5/m9/stage1/M9-STAGE1-CONTROLLED-RESOLVER-EGRESS-PREREG-v1.json"
d=json.loads(p.read_text(encoding="utf-8"))
def check(x):
 assert (x["schema"],x["mode"],x["decision"])==("M9-STAGE1-CONTROLLED-RESOLVER-EGRESS-PREREG-v1","OFFLINE_NONEXECUTABLE","BLOCKED_PENDING_ENFORCEABLE_DNS_PROOF")
 assert x["basis"]=={"run":38227024162,"job":114736943899,"negative_cases":33}
 assert "default-deny client-egress" in x["architecture"]
 b=x["boundary"];assert b["count"]=="CLIENT_EGRESS_OBSERVED_DNS_TRANSMISSIONS" and b["not_count"].startswith("Remote recursive") and b["equivalent"] is False and b["quantitative_budget"]=="UNSET_UNTIL_ENFORCEMENT_PROVEN"
 assert "Separately" in b["resolver_calls"] and "Separately" in b["dns_questions"] and "Separately" in b["network_packets"]
 c=x["cases"];assert c=={"A":"Explicit QTYPE approval required","AAAA":"Independent QTYPE budget; no implicit parallel query","CNAME":"Each follow-up question separately budgeted; unexpected chain stops","cache":"Cache hit recorded distinctly, never equated with proved zero egress","retry":"Zero permitted","implicit_getaddrinfo":"Reject or prove intercepted; otherwise BLOCKED","redirect":"Zero permitted","overflow":"DENY_BEFORE_NEXT_EGRESS_AND_TERMINATE","unobservable_egress":"BLOCKED_NO_EXECUTION","fallback_resolver":"PROHIBITED"}
 e=x["environment"];assert "exact image identity" in e["runner"] and e["python"]=="3.12" and e["utc_window"]=="UNAPPROVED"
 h=x["https"];assert (h["get_max"],h["overall_seconds"],h["connect_seconds"],h["request_seconds"],h["authorized"])==(1,30,10,20,False) and h["on_403"]=="IMMEDIATE_STOP_NO_RETRY"
 z=x["privacy"];assert z=={"allowlist_only":True,"raw_packet_capture":False,"raw_addresses_or_tokens":False,"redaction_failure":"ABORT_NO_ARTIFACT"}
 assert len(x["independent_static_acceptance"])==6 and len(x["locks"])==11 and all(v is False for v in x["locks"].values())
check(d)
passed=[]
def reject(name,path,value):
 y=copy.deepcopy(d);z=y
 for k in path[:-1]:z=z[k]
 z[path[-1]]=value
 try:check(y)
 except (AssertionError,KeyError,TypeError,ValueError):passed.append(name);return
 raise AssertionError("unsafe mutation accepted "+name)
cases=[
("execute",["mode"],"EXECUTE"),("unblock",["decision"],"AUTHORIZED"),("run",["basis","run"],0),
("architecture",["architecture"],"resolver only"),("count",["boundary","count"],"RESOLVER_CALLS"),("remote",["boundary","not_count"],"all recursive packets"),("equal",["boundary","equivalent"],True),("budget",["boundary","quantitative_budget"],1),
("calls",["boundary","resolver_calls"],"unobserved"),("questions",["boundary","dns_questions"],"unobserved"),("packets",["boundary","network_packets"],"unobserved"),
("A",["cases","A"],"implicit"),("AAAA",["cases","AAAA"],"auto"),("CNAME",["cases","CNAME"],"ignore"),("cache",["cases","cache"],"zero traffic proved"),("retry",["cases","retry"],"one"),("implicit",["cases","implicit_getaddrinfo"],"allow"),("redirect",["cases","redirect"],"one"),("overflow",["cases","overflow"],"permit and log"),("unobserved",["cases","unobservable_egress"],"ALLOW"),("fallback",["cases","fallback_resolver"],"ALLOW"),
("runner",["environment","runner"],"ubuntu-latest is pinned"),("python",["environment","python"],"3.13"),("window",["environment","utc_window"],"ANYTIME"),
("get",["https","get_max"],2),("time",["https","overall_seconds"],60),("https_authorized",["https","authorized"],True),("403",["https","on_403"],"RETRY"),
("redaction",["privacy","allowlist_only"],False),("packet",["privacy","raw_packet_capture"],True),("secrets",["privacy","raw_addresses_or_tokens"],True),("artifact",["privacy","redaction_failure"],"SAVE"),
("dns_lock",["locks","dns"],True),("https_lock",["locks","https"],True),("stage2",["locks","stage2"],True),("youtube",["locks","youtube"],True)]
for args in cases:reject(*args)
assert len(passed)==36
print("M9_RESOLVER_EGRESS_STATIC_PASS negatives=36 boundary=CLIENT_EGRESS budget=UNPROVEN_BLOCKED A_AAAA_CNAME=SEPARATE cache=NOT_PROOF retries=0 implicit=BLOCKED overflow=DENY_BEFORE_EGRESS no_network=true no_media=true locks=FALSE")
