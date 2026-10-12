#!/usr/bin/env python3
"""Offline research-only checks of three-scene canonical semantic draft."""
import json
from pathlib import Path
p=Path(__file__).resolve().parents[1]/"data_research/m5/m8data/20261008-1301-semantic-draft.json"
d=json.loads(p.read_text(encoding="utf-8"))
assert d["status"]=="RESEARCH_DRAFT_UNVERIFIED"
expected=[["name","code","close_twd","change_pct"],["foreign_net_lots","trust_net_lots","dealer_net_lots"],["news_published_date","news_theme"]]
assert [s["claim_ids"] for s in d["scenes"]]==expected
def same_claims(a,b):
    return a==b and len(a)==len(set(a))
for scene in d["scenes"]:
    ids=scene["claim_ids"]
    assert same_claims(ids,ids[:])
    assert not same_claims(ids,ids[:-1])
    assert not same_claims(ids,list(reversed(ids))) if len(ids)>1 else True
assert d["policy"]["no_unsupported_article_causality"]
assert d["safe_zone_contract"]["status"]=="SPEC_ONLY_COORDINATES_NOT_INDEPENDENTLY_MEASURED"
assert "不能直接證明" in d["scenes"][2]["speech"]
assert "不能直接證明" in d["scenes"][2]["caption"]
print("M8DATA_SEMANTIC_DRAFT_STATIC_PASS negative_omission=PASS ordering=PASS full_linguistic_parity=NOT_ESTABLISHED no_media=true")
