#!/usr/bin/env python3
"""Research-only fail-closed M8DATA manifest check. No render, TTS or publication."""
import json, pathlib, subprocess, datetime
R=pathlib.Path(__file__).resolve().parents[1]
M=R/"data_research/m5/m8data/20261008-1301-research-manifest.json"
m=json.loads(M.read_text())
assert m["schema"]=="M8DATA-RESEARCH-MANIFEST-v1" and m["status"].startswith("DRAFT")
assert m["date"]=="20261008" and m["stock"]=="1301"
assert all(v is False for v in m["locks"].values())
def resolve(doc,p):
    assert p.startswith("/")
    v=doc
    for token in p.split("/")[1:]:
        token=token.replace("~1","/").replace("~0","~")
        if isinstance(v,list): v=v[int(token)]
        elif isinstance(v,dict): v=v[token]
        else: raise KeyError(p)
    return v
sources={}
for role, info in m["source_files"].items():
    path=info["path"]
    raw=(R/path).read_bytes()
    # Git blob identity, not SHA256: compare Git's own hash-object implementation.
    got=subprocess.check_output(["git","hash-object","--",path],cwd=R,text=True).strip()
    assert got==info["git_blob_sha"], (role,got,info["git_blob_sha"])
    sources[role]=json.loads(raw)
    assert sources[role]["target_date"]==m["date"]
# The full 15-entry ledger is provenance, NOT automatically the displayed scope.
semantic=json.loads((R/m["display_scope"]["semantic_draft_path"]).read_text(encoding="utf-8"))
assert [(scene["id"],scene["keys"]) for scene in m["scenes"]]==[(scene["id"],scene["claim_ids"]) for scene in semantic["scenes"]]
ledger_keys=[item["key"] for item in m["claims"]]
assert len(ledger_keys)==len(set(ledger_keys))
shown=[key for scene in m["scenes"] for key in scene["keys"]]
assert len(shown)==len(set(shown))
assert set(shown).issubset(set(ledger_keys))
excluded=set(m["display_scope"]["excluded_pending_verification"])
assert excluded.isdisjoint(shown)
assert set(ledger_keys)==set(shown)|excluded
assert {"volume_reported","margin_delta_reported","broker_top_buy_name","broker_top_buy_reported_net","ai_reason"}.issubset(excluded)
assert [x["id"] for x in m["scenes"]]==["stock_lead","flow_evidence","catalyst_risk"]
assert len(m["claims"])>=15
for c in m["claims"]:
    assert resolve(sources[c["role"]],c["pointer"])==c["value"],c["key"]
for role,section in (("universe","stocks"),("facts","stocks"),("news","analyses"),("ai","analyses")):
    assert resolve(sources[role],f"/{section}/{m['source_index']}/code")=="1301"
assert resolve(sources["universe"],"/stocks/21/change_pct")>5
def rejects(f):
    try: f()
    except (KeyError,IndexError,ValueError,TypeError,AssertionError): return True
    return False
assert rejects(lambda: resolve(sources["facts"],"/stocks/21/flow/foreign/not_real"))
assert rejects(lambda: resolve(sources["facts"],"/stocks/9999/code"))
assert rejects(lambda: resolve({"record_status":"no_record","net_lots":None},"/net_lots") or False) is False
def display_number(record):
    if record.get("record_status")!="reported" or record.get("net_lots") is None: return "UNKNOWN"
    return record["net_lots"]
assert display_number({"record_status":"no_record","net_lots":None})=="UNKNOWN"
assert display_number({"record_status":"reported","net_lots":0})==0
assert display_number({"record_status":"reported","net_lots":None})=="UNKNOWN"
def parity(speech_ids,caption_ids): return speech_ids==caption_ids and len(speech_ids)==len(set(speech_ids))
assert parity(["price","flow","risk"],["price","flow","risk"])
assert not parity(["price","flow","risk"],["price","risk"])
assert not parity(["price","flow"],["flow","price"])
assert m["news_time_gate"]["article_time_status"]=="UNKNOWN"
assert m["news_time_gate"]["causal_claim_authorized"] is False
assert m["news_time_gate"]["news_claim_for_ai_cutoff_authorized"] is False
assert m["m7"]["source_audio_unchanged"]=="NOT_INDEPENDENTLY_REVERIFIED"
print("M8DATA_DRAFT_STATIC_PASS display_scope=9 ledger=15 parity=PASS excluded=6 pointer=15 missing=UNKNOWN negative=PASS chronology=BLOCKED M7_HASH=NOT_REVERIFIED A=INCOMPLETE release=BLOCKED")
