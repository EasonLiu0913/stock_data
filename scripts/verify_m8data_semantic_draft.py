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
    if len(ids)>1:
        assert not same_claims(ids,list(reversed(ids)))
assert d["policy"]["no_unsupported_article_causality"]
assert d["safe_zone_contract"]["status"]=="SPEC_ONLY_COORDINATES_NOT_INDEPENDENTLY_MEASURED"
assert "不能直接證明" in d["scenes"][2]["speech"]
assert "不能直接證明" in d["scenes"][2]["caption"]
assert "news_theme" in d["scenes"][2]["claim_ids"]
all_claims=[key for scene in d["scenes"] for key in scene["claim_ids"]]
assert not set(d["excluded_pending_verification"]).intersection(all_claims)
# Fixed-sample exact prose checks; do NOT imply generic language equivalence.
assert d["scenes"][0]["caption"]=="台塑（1301），收盤 81.3 元，當日上漲 7.82%。"
assert d["scenes"][0]["speech"]=="台塑，股票代號一三零一，收盤八十一點三元，當日上漲百分之七點八二。"
assert d["scenes"][1]["caption"]=="法人方面，來源記錄外資買超 14,225 張，投信買超 13,940 張，自營商賣超 567 張。"
assert d["scenes"][1]["speech"]=="法人方面，來源記錄外資買超一萬四千二百二十五張，投信買超一萬三千九百四十張，自營商賣超五百六十七張。"
assert d["scenes"][2]["caption"]=="當日有媒體討論第 4 季石化旺季預期；這是題材線索，不能直接證明當日股價上漲原因。"
assert d["scenes"][2]["speech"]=="當日有媒體討論第四季石化旺季預期；這是題材線索，不能直接證明當日股價上漲原因。"
m=json.loads((p.parent/"20261008-1301-research-manifest.json").read_text(encoding="utf-8"))
assert d["excluded_pending_verification"]==m["display_scope"]["excluded_pending_verification"]
source_ledger={item["key"]:item for item in m["claims"]}
shown=[key for scene in d["scenes"] for key in scene["claim_ids"]]
mapped=d["claim_coverage"]
assert [entry["key"] for entry in mapped]==shown
assert len(mapped)==9 and len(set(shown))==9
for entry in mapped:
    key=entry["key"]
    index=entry["scene_index"]
    assert key in source_ledger and key in d["scenes"][index]["claim_ids"]
    assert source_ledger[key]["pointer"].startswith("/")
    scene=d["scenes"][index]
    for surface in ("display","speech","caption"):
        fragment=entry["fragments"][surface]
        assert fragment and fragment in scene[surface],(key,surface)
def accepts_coverage(rows):
    return [r["key"] for r in rows]==shown and all(
        all(r["fragments"][surface] in d["scenes"][r["scene_index"]][surface]
            for surface in ("display","speech","caption")) for r in rows)
assert accepts_coverage(mapped)
assert not accepts_coverage(mapped[:-1])
mutated=json.loads(json.dumps(mapped,ensure_ascii=False))
mutated[0]["fragments"]["caption"]="不存在的字幕片段"
assert not accepts_coverage(mutated)
assert d["safe_zone_contract"]["m7_opening_immutable"] is True
assert d["safe_zone_contract"]["m8_three_scenes_data_only"] is True
assert len(d["safe_zone_contract"]["data_only_guards"])==3
assert d["safe_zone_contract"]["status"]=="SPEC_ONLY_COORDINATES_NOT_INDEPENDENTLY_MEASURED"
print("M8DATA_SEMANTIC_DRAFT_STATIC_PASS claim_mapping=9 exclusion_parity=6 fragment_coverage=PASS mapping_negative=PASS negative_omission=PASS ordering=PASS full_linguistic_parity=NOT_ESTABLISHED no_media=true")
