import copy, json, pathlib, subprocess
p=pathlib.Path("recovery-requests/experiment-10")
load=lambda name:json.loads((p/name).read_text())
sha=lambda path:subprocess.check_output(["git","hash-object",str(path)],text=True).strip()
v=load("candidate-consumer-v2-shadow-design.json")
old=load("candidate-consumer-output.json")
q=load("candidate-consumer-v2-shadow-local-tests.json")
assert sha(pathlib.Path("recovery-requests/experiment-09/diagnostic.json"))=="3cd41732762e71143f40f845155199aabd728dbb"
assert sha(p/"candidate-consumer-output.json")==v["baseline_consumer_sha"]
assert sha(p/"candidate-consumer-v2-shadow-design.json")==q["baseline_sha"]
assert len(old["stocks"])==55 and v["stock_count"]==55
def check(d):
 assert d["target_date"]=="20261012" and len(d["stocks"])==55
 assert [s["code"] for s in d["stocks"]]==[s["code"] for s in old["stocks"]]
 assert sum(len(s["claim_ids"]) for s in d["stocks"])==17
 assert sum(s["shadow_evidence"] is not None for s in d["stocks"])==41
 for a,z in zip(d["stocks"],old["stocks"]):
  assert {k:a[k] for k in ("code","news_state","catalyst_status","claim_ids","assertions")}==z
  e=a["shadow_evidence"]
  if e:
   assert z["news_state"]=="SOURCE_INSUFFICIENT_NOT_NO_NEWS" and e["code"]==a["code"]
   assert e["source_url"].startswith("https://") and not e["causality"]
   assert e["semantic_status"]=="PENDING_INDEPENDENT_ACCEPTANCE"
   assert e["effective_claim"] is False and e["allowed_in_formal_consumer"] is False
 assert d["gates"]==v["gates"]
 assert d["gates"]["production"]=="DENY_ALL" and d["gates"]["publication_authorized"] is False
 assert d["gates"]["r1_independent_41_semantics"]=="NOT_PASS"
 assert d["gates"]["r2_full41_ci"]=="NOT_RUN"
check(v)
mutations={
"duplicate":lambda d:d["stocks"][1].update(code=d["stocks"][0]["code"]),
"wrong_stock":lambda d:d["stocks"][0]["shadow_evidence"].update(code="9999"),
"promotion":lambda d:d["stocks"][0]["shadow_evidence"].update(effective_claim=True),
"extra_claim":lambda d:d["stocks"][0]["claim_ids"].append("FAKE"),
"bad_url":lambda d:d["stocks"][0]["shadow_evidence"].update(source_url=""),
"causality":lambda d:d["stocks"][0]["shadow_evidence"].update(causality=True),
"unlock":lambda d:d["gates"].update(production="ALLOW"),
"publish":lambda d:d["gates"].update(publication_authorized=True),
"fake_r1":lambda d:d["gates"].update(r1_independent_41_semantics="PASS")
}
for name,fn in mutations.items():
 x=copy.deepcopy(v);fn(x)
 try:check(x)
 except (AssertionError,KeyError):pass
 else:raise AssertionError("negative escaped "+name)
assert q["baseline_pass"] and q["all_rejected"] and len(mutations)==9
print("EXP10_V2_SHADOW_INDEPENDENT_PASS 55 stocks 17 existing claims 41 unaccepted shadows 9 negative cases; R1/R2 remain NOT_PASS; production DENY_ALL")
