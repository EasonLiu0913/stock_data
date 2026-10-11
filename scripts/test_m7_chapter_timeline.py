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
assert sum(x['end_seconds']-x['start_seconds'] for x in timeline)==79.416
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
print('M7_CHAPTER_TIMELINE_PASS opening_scenes=1,2,3 chapters=5 audio_seconds=79.416 release=BLOCKED')
