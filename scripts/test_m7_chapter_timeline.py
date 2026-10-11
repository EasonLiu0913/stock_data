#!/usr/bin/env python3
"""M7 chapter timeline regression: no TTS, network, publication, or model weights."""
import importlib.util,json,pathlib
from copy import deepcopy
root=pathlib.Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('renderer',root/'scripts/m6_m7_private_1080p.py')
mod=importlib.util.module_from_spec(spec);spec.loader.exec_module(mod)
config=json.loads((root/'data_research/m5/m7-research-chapters.json').read_text())
audio=[{'scene':i+1,'duration_seconds':v} for i,v in enumerate([4.,3.,5.,15.,20.,15.,17.416])]
timeline=mod.chapter_timeline(audio,config)
assert len(timeline)==5 and timeline[0]['scenes']==[1,2,3]
assert timeline[0]['start_seconds']==0 and timeline[0]['end_seconds']==12
assert all(timeline[0]['ordinal']==1 for s in (1,2,3))
assert timeline[1]['start_seconds']==12 and timeline[-1]['end_seconds']==79.416
assert all(x['total']==5 for x in timeline)
assert all(a['end_seconds']==b['start_seconds'] for a,b in zip(timeline,timeline[1:]))
assert round(sum(x['end_seconds']-x['start_seconds'] for x in timeline),3)==79.416
assert config['publication_authorized'] is False
bad=deepcopy(config);bad['chapters'][0]['scenes']=[1,2]
try: mod.chapter_timeline(audio,bad)
except AssertionError: pass
else: raise AssertionError('Must reject premature opening chapter transition')
bad=deepcopy(config);bad['chapters'][1]['scenes']=[3,4]
try: mod.chapter_timeline(audio,bad)
except AssertionError: pass
else: raise AssertionError('Must reject duplicated or overlapping scene')
# Subtitles are a separate timing channel; none are consulted by chapter_timeline.
assert 'candidate.srt' not in mod.chapter_timeline.__code__.co_names
# Verify monotonic intrachapter fill, exact boundary reset, and clock conservation.
for chapter in timeline:
 start,end=chapter['start_seconds'],chapter['end_seconds']
 samples=[mod.progress_state(start+(end-start)*p,timeline) for p in (0,.25,.5,.75)]
 assert all(x[0]['id']==chapter['id'] for x in samples)
 assert all(abs(s[1]-p)<1e-9 for s,p in zip(samples,(0,.25,.5,.75)))
 assert all(abs((start+(end-start)*p)+s[2]-79.416)<1e-9 for s,p in zip(samples,(0,.25,.5,.75)))
 if chapter!=timeline[-1]:
  before=mod.progress_state(end-0.001,timeline)
  after=mod.progress_state(end,timeline)
  assert before[0]['ordinal']==chapter['ordinal'] and before[1]>.99
  assert after[0]['ordinal']==chapter['ordinal']+1 and after[1]==0
assert mod.clock(79.416)=='01:19' and mod.clock(0)=='00:00'
print('M7_PROGRESS_MATH_PASS samples=0,25,50,75 boundaries=4 source_seconds=79.416')
print('M7_CHAPTER_TIMELINE_PASS opening_scenes=1,2,3 chapters=5 audio_seconds=79.416 release=BLOCKED')
