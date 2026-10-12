#!/usr/bin/env python3
"""Offline document-only mutation audit; no runtime or external operations."""
import json,copy
from pathlib import Path
p=Path(__file__).resolve().parents[1]/"data_research/m5/m9/stage1/M9-STAGE1-CONTROLLED-RUNNER-MINIMUM-SECURITY-PREREG-v1.json"
d=json.loads(p.read_text())
def check(x):
 assert (x["schema"],x["mode"],x["decision"])==("M9-STAGE1-CONTROLLED-RUNNER-MINIMUM-SECURITY-PREREG-v1","OFFLINE_NONEXECUTABLE","BLOCKED_PENDING_CONTROLLED_RUNNER_PROOF")
 assert x["basis"]=={"run":38230918375,"job":114749888454,"negative_cases":70}
 a=x["architecture"]
 for k,v in {"image":"digest","permissions":"least-privilege","egress":"default-deny","dns":"Separately","quota":"before next","privacy":"allowlist-only","evidence":"independently reviewed"}.items():assert v in a[k]
 assert len(x["acceptance"])==11 and all(v is False for v in x["acceptance"].values())
 f=x["future_scope"];assert f=={"https_get_max":1,"wall_clock_seconds":30,"first_403":"STOP_NO_RETRY","runner_provisioning_authorized":False,"network_diagnostic_authorized":False,"stage1_audio":"BLOCKED_UPSTREAM_403"}
 assert len(x["locks"])==11 and all(v is False for v in x["locks"].values())
check(d)
cases=[("mode",["mode"],"EXECUTE"),("decision",["decision"],"PASS"),("baseline",["basis","run"],0)]
for k in d["architecture"]:cases.append((k,["architecture",k],"unsafe"))
for k in d["acceptance"]:cases.append((k,["acceptance",k],True))
for k in d["locks"]:cases.append((k,["locks",k],True))
for k in d["future_scope"]:cases.append((k,["future_scope",k],"OVERRIDE"))
passed=0
for name,path,value in cases:
 y=copy.deepcopy(d);z=y
 for key in path[:-1]:z=z[key]
 z[path[-1]]=value
 try:check(y)
 except (AssertionError,KeyError,TypeError,ValueError):passed+=1
 else:raise AssertionError("mutation accepted "+name)
assert passed==38
print("M9_CONTROLLED_RUNNER_OFFLINE_PASS negatives=38 image=PINNED_REQUIRED permissions=ISOLATED egress=DEFAULT_DENY dns=SEPARATE quota=PRE_EGRESS privacy=ALLOWLIST owner_approvals=FALSE no_network=true no_media=true locks=FALSE")
