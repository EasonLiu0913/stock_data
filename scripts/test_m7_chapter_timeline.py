#!/usr/bin/env python3
"""M7 locked market opening: one chapter, seven audios, three independent visual scenes."""
import importlib.util,json,pathlib
from copy import deepcopy
root=pathlib.Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('renderer',root/'scripts/m6_m7_private_1080p.py')
mod=importlib.util.module_from_spec(spec);spec.loader.exec_module(mod)
chapters=json.loads((root/'data_research/m5/m7-research-chapters.json').read_text())
visuals=json.loads((root/'data_research/m5/m7-visual-scenes.json').read_text())
audio=[{'scene':i+1,'duration_seconds':v} for i,v in enumerate([2.88,2.76,2.496,16.944,13.2,23.4,17.736])]
timeline=mod.chapter_timeline(audio,chapters)
mapping=mod.visual_plan(visuals)
assert len(timeline)==1 and timeline[0]['scenes']==list(range(1,8))
assert timeline[0]['start_seconds']==0 and timeline[0]['end_seconds']==79.416
assert timeline[0]['title']=='市場開場' and timeline[0]['ordinal']==timeline[0]['total']==1
assert [mapping[i]['id'] for i in range(1,8)]==['brand_opening']*3+['market_cards']*2+['flow_summary']*2
assert visuals['audio_count']==7 and len(visuals['visual_scenes'])==3
for t in [0,2.88,5.64,8.136,25.08,38.28,61.68,79.415,79.416]:
 ch,frac,left=mod.progress_state(t,timeline)
 assert ch['ordinal']==ch['total']==1 and abs(frac-t/79.416)<1e-9
 assert abs(t+left-79.416)<1e-9
for frac in (0,.25,.5,.75,1):
 ch,p,left=mod.progress_state(79.416*frac,timeline)
 assert abs(p-frac)<1e-9
assert 'candidate.srt' not in mod.chapter_timeline.__code__.co_names
for corrupt in ([[1,2,3],[4,5,6,7]],[[1,2,3,4,5,6]]):
 bad=deepcopy(chapters)
 bad['chapters']=[{'id':'market-opening','title':'市場開場','scenes':s} for s in corrupt]
 try:mod.chapter_timeline(audio,bad)
 except AssertionError:pass
 else:raise AssertionError('Invalid chapter partition was accepted')
bad=deepcopy(visuals);bad['visual_scenes'][0]['audio_scenes']=[1,2]
try:mod.visual_plan(bad)
except AssertionError:pass
else:raise AssertionError('Missing third intro audio accepted')
print('M7_OPENING_STRUCTURE_PASS chapters=1 audio_scenes=7 visual_scenes=3 seconds=79.416 release=BLOCKED')
print('M7_PROGRESS_MATH_PASS intrachapter=0,25,50,75,100 chapter_changes=0')
