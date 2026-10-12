#!/usr/bin/env python3
"""Research-only M8VIS static fail-closed contract checks; never render media."""
import copy
import json
from pathlib import Path

R = Path(__file__).resolve().parents[1]
load = lambda path: json.loads((R / path).read_text(encoding="utf-8"))
base = "data_research/m5/"
pair = load(base+"m8vis/M8VIS-ISOLATED-SUCCESSOR-PAIR-v1.json")
spec = load(base+"m8vis/M8VIS-THREE-SCENE-STATIC-VISUAL-SPEC-v1.json")
draft = load(base+"m8data/20261008-1301-semantic-draft.json")
manifest = load(base+"m8data/20261008-1301-research-manifest.json")
geometry = load(base+"m8data/M7-READONLY-FRAME-GEOMETRY-v1.json")

def rect_valid(box):
    return len(box)==4 and all(type(x) is int for x in box) and 0<=box[0]<box[2]<=1920 and 0<=box[1]<box[3]<=1080

def intersects(a,b):
    return a[0]<b[2] and b[0]<a[2] and a[1]<b[3] and b[1]<a[3]

def checked(s):
    assert s["canvas"]["width"]==1920 and s["canvas"]["height"]==1080
    expected = [(x["id"],x["claim_ids"]) for x in draft["scenes"]]
    assert [(x["id"],x["claim_ids"]) for x in s["three_scenes"]]==expected
    assert [(x["id"],x["claim_ids"]) for x in s["three_scenes"]]==[(x["id"],x["keys"]) for x in manifest["scenes"]]
    shown=[key for scene in s["three_scenes"] for key in scene["claim_ids"]]
    excluded=s["six_provenance_only"]
    assert len(shown)==9 and len(set(shown))==9 and len(excluded)==6 and len(set(excluded))==6
    assert excluded==manifest["display_scope"]["excluded_pending_verification"]==draft["excluded_pending_verification"]
    assert not set(excluded).intersection(shown)
    assert set(shown)|set(excluded)=={c["key"] for c in manifest["claims"]}
    for zone in s["zones"].values(): assert rect_valid(zone)
    assert s["zones"]["stock_card_left"]==geometry["conservative_spec_boxes"]["left_content_envelope"]
    names={"m7_presenter_protected":"presenter_protection","m7_footer_progress_cc_protected":"footer_protection","m7_header_protected":"header_protection"}
    for key,gkey in names.items():
        assert s["zones"][key]==geometry["conservative_spec_boxes"][gkey]
        assert not intersects(s["zones"]["stock_card_left"],s["zones"][key]),key
    assert s["progress"]["model"]=="segmented"
    assert s["progress"]["labels"]==["個股股價","法人資金","題材與風險"]
    assert s["progress"]["total_segments"]==len(s["three_scenes"])==3
    assert s["progress"]["current_index"]=="scene-index from manifest"
    for key in ("remaining_seconds","total_duration_seconds"):
        assert s["progress"][key]=="UNKNOWN_UNTIL_AUTHORIZED_AUDIO"
    assert s["caption"]["actual_overlay"]=="NOT_TESTED"
    assert s["vtuber"]["original_m7_unchanged"] is True
    assert s["vtuber"]["status"]=="STATIC_PRESERVATION_SPEC_ONLY"
    assert s["evidence_boundaries"]["player_cc_collision"]=="UNKNOWN"
    assert s["evidence_boundaries"]["actual_vtuber_mouth_sync"]=="NOT_TESTED"
    assert s["evidence_boundaries"]["actual_dynamic_motion"]=="NOT_RENDERED"
    assert "fail closed" in s["overflow"]["overlong_claim"]
    assert "never cover presenter/footer" in s["overflow"]["overlong_claim"]
    assert "not insert provenance-only" in s["overflow"]["unknown_claim"]
    assert all(v is False for v in s["locks"].values())
    return True

assert pair["prompt_a"]["status"]=="ACTIVE_RESEARCH_ONLY"
assert pair["prompt_b"]["status"]=="FROZEN_NOT_AUTHORIZED_NOT_EXECUTED"
assert pair["governance"]["main_preregistered"] is False
assert all(v is False for k,v in pair["governance"].items() if k.endswith("_authorized") or k in ("m8_promoted","pages_authorized","youtube_authorized","cron_authorized","production_authorized","tts_authorized","render_authorized","publication_authorized"))
assert checked(spec)
mutations=[]
def negative(label,change):
    s=copy.deepcopy(spec)
    change(s)
    try: checked(s)
    except (AssertionError,KeyError,TypeError,ValueError):
        mutations.append(label)
        return
    raise AssertionError("negative not rejected: "+label)
negative("missing_claim",lambda s:s["three_scenes"][1]["claim_ids"].pop())
negative("reordered_claim",lambda s:s["three_scenes"][0]["claim_ids"].reverse())
negative("excluded_leak",lambda s:s["three_scenes"][0]["claim_ids"].append("broker_top_buy_name"))
negative("exclusion_missing",lambda s:s["six_provenance_only"].pop())
negative("presenter_collision",lambda s:s["zones"].__setitem__("stock_card_left",[1450,400,1600,600]))
negative("footer_collision",lambda s:s["zones"].__setitem__("stock_card_left",[100,910,1040,950]))
negative("header_collision",lambda s:s["zones"].__setitem__("stock_card_left",[100,100,1040,400]))
negative("fabricated_duration",lambda s:s["progress"].__setitem__("total_duration_seconds",79.416))
negative("fabricated_remaining",lambda s:s["progress"].__setitem__("remaining_seconds",30))
negative("segment_count",lambda s:s["progress"].__setitem__("total_segments",4))
negative("runtime_cc_claim",lambda s:s["caption"].__setitem__("actual_overlay","PASS"))
negative("lip_sync_claim",lambda s:s["evidence_boundaries"].__setitem__("actual_vtuber_mouth_sync","PASS"))
negative("release_unlock",lambda s:s["locks"].__setitem__("youtube_authorized",True))
negative("unsafe_overflow",lambda s:s["overflow"].__setitem__("overlong_claim","allow overlay"))
assert len(mutations)==14
print("M8VIS_STATIC_PASS scenes=3 claims=9 excluded=6 zones=DISJOINT progress=3 duration=UNKNOWN cc=NOT_TESTED locks=FALSE negatives=14 no_media=true A=INCOMPLETE B=FROZEN")
