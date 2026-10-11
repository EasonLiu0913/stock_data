#!/usr/bin/env python3
"""M8 preregistration-only static contract verification; no network or video."""
import json,pathlib
root=pathlib.Path(__file__).resolve().parents[1]
p=root/'data_research/m5/m8-featured-stock-contract.json'
x=json.loads(p.read_text())
assert x['schema']=='M8-FEATURED-STOCK-RESEARCH-CONTRACT-v1' and x['mode']=='preregistration_only'
assert x['target_date']=='20261008' and x['m7_baseline']['run_id']==38156510901
assert x['m7_baseline']['opening_source_seconds']==79.416 and x['m7_baseline']['immutable'] is True
assert len(x['inputs'])==4 and {i['role'] for i in x['inputs']}=={'universe','facts','news','ai'}
assert all(i['required'] and i['path'].startswith('data_daily_gain_over_5/') and i['join']=='code' for i in x['inputs'])
assert len(x['cards'])==4 and len(x['scene_plan'])==3
assert x['featured_selection']['subset_allowed'] and not x['featured_selection']['do_not_force_35_stocks'] is False
assert all(v is False for v in x['locks'].values())
for phrase in ('null/no_record','source disagreement','verbatim narration','SRT timing estimated'):
 assert any(phrase in s for s in x['guardrails']),phrase
print('M8_CONTRACT_PREREGISTRATION_PASS inputs=4 cards=4 visual_scenes=3 publication=BLOCKED')
