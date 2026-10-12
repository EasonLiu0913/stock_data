#!/usr/bin/env python3
"""Static local JSON only; no networking, packet capture or rule installation."""
import copy,json
from pathlib import Path
p=Path(__file__).resolve().parents[1]/"data_research/m5/m9/stage1/M9-STAGE1-RUNNER-EGRESS-MINIMUM-ACCEPTANCE-MATRIX-v1.json"
d=json.loads(p.read_text())
IDS=["rule_installable","enforcement","packet_observability","ipv4","ipv6","udp","tcp","os_resolver","proxy","overflow","runner_image"]
def check(x):
 assert x["schema"]=="M9-STAGE1-RUNNER-EGRESS-MINIMUM-ACCEPTANCE-MATRIX-v1"
 assert x["mode"]=="OFFLINE_NONEXECUTABLE" and x["decision"]=="BLOCKED_UNVERIFIED_ENFORCEABLE_EGRESS"
 assert x["basis"]=={"run":38228524914,"job":114741930513,"negative_cases":36}
 assert x["evidence_states"]==["UNVERIFIED","STATIC_CONTRACT_ONLY","RUNTIME_PROVEN_AFTER_SEPARATE_APPROVAL"]
 assert [r["id"] for r in x["matrix"]]==IDS
 assert all(r["state"]=="STATIC_CONTRACT_ONLY" and r["runtime_proof"] is False and r["unknown_means"]=="BLOCKED_NO_DIAGNOSTIC" and len(r["criterion"])>15 for r in x["matrix"])
 q=x["scope"]
 assert q=={"budget":"UNPROVEN_BLOCKED","client_egress_boundary":"DEFINED_NOT_ENFORCED","https_get_max_future":1,"overall_seconds_future":30,"utc_window":"UNAPPROVED","redaction":"ALLOWLIST_ONLY","first_403":"STOP_NO_RETRY","audio":"BLOCKED_UPSTREAM_403"}
 assert x["no_install_or_capture"] is True and x["no_execution"] is True
 assert len(x["locks"])==11 and all(v is False for v in x["locks"].values())
check(d)
passed=[]
def reject(name,path,value):
 y=copy.deepcopy(d);z=y
 for key in path[:-1]:z=z[key]
 z[path[-1]]=value
 try:check(y)
 except (AssertionError,KeyError,TypeError,ValueError):passed.append(name);return
 raise AssertionError("mutation accepted: "+name)
cases=[("mode",["mode"],"EXECUTE"),("decision",["decision"],"READY"),("run",["basis","run"],0),("states",["evidence_states"],[]),("matrix",["matrix"],[]),("budget",["scope","budget"],1),("boundary",["scope","client_egress_boundary"],"ENFORCED"),("get",["scope","https_get_max_future"],2),("clock",["scope","overall_seconds_future"],60),("window",["scope","utc_window"],"ANY"),("redaction",["scope","redaction"],"RAW"),("403",["scope","first_403"],"RETRY"),("audio",["scope","audio"],"PASS"),("install",["no_install_or_capture"],False),("execution",["no_execution"],False)]
for i in range(11):
 cases.extend([(IDS[i]+"_missing",["matrix",i,"id"],"other"),(IDS[i]+"_runtime",["matrix",i,"runtime_proof"],True),(IDS[i]+"_state",["matrix",i,"state"],"RUNTIME_PROVEN_AFTER_SEPARATE_APPROVAL"),(IDS[i]+"_unknown",["matrix",i,"unknown_means"],"CONTINUE")])
for key in d["locks"]:cases.append((key+"_unlock",["locks",key],True))
for case in cases:reject(*case)
assert len(passed)==70
print("M9_RUNNER_EGRESS_MATRIX_OFFLINE_PASS negatives=70 gates=11 observation!=enforcement ipv4_ipv6_udp_tcp=SEPARATE unknown=BLOCKED budget=UNPROVEN no_network=true no_media=true locks=FALSE")
