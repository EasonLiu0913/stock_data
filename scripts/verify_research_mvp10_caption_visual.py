#!/usr/bin/env python3
"""Research-only QA: verify burned captions are VISIBLE in-frame, not just a different MP4 hash."""
import json
import re
import subprocess
import sys
from pathlib import Path

SRT_TIME = re.compile(r'^(\d{2}):(\d{2}):(\d{2}),(\d{3}) --> (\d{2}):(\d{2}):(\d{2}),(\d{3})$')

def timestamp(parts):
    h,m,s,ms=map(int,parts)
    return h*3600+m*60+s+ms/1000

def cues(path):
    data=Path(path).read_text(encoding='utf-8-sig')
    times=[]
    for line in data.splitlines():
        match=SRT_TIME.match(line)
        if match:
            start=timestamp(match.groups()[:4])
            end=timestamp(match.groups()[4:])
            if end>start:
                times.append((start,end))
    if len(times)<7:
        raise ValueError('RESEARCH_SUBTITLE_CUES_INSUFFICIENT')
    return times

def gray_crop(video,secs,region):
    x,y,w,h=region
    args=['ffmpeg','-hide_banner','-loglevel','error','-ss',f'{secs:.3f}','-i',str(video),
          '-vf',f'crop={w}:{h}:{x}:{y},format=gray','-frames:v','1','-f','rawvideo','pipe:1']
    run=subprocess.run(args,stdout=subprocess.PIPE,stderr=subprocess.PIPE)
    if run.returncode or len(run.stdout)!=w*h:
        raise RuntimeError('CAPTION_FRAME_DECODE_FAILED:'+run.stderr.decode(errors='replace')[-300:])
    return run.stdout

def compare(source,burned,secs,region):
    a=gray_crop(source,secs,region)
    b=gray_crop(burned,secs,region)
    return sum(abs(x-y)>35 for x,y in zip(a,b))

def verify(source,burned,srt):
    events=cues(srt)
    duration=float(subprocess.check_output(['ffprobe','-v','error','-show_entries','format=duration',
       '-of','default=noprint_wrappers=1:nokey=1',str(burned)],text=True).strip())
    available=[i for i,(start,end) in enumerate(events) if end<=duration+0.1]
    if not available:
        raise RuntimeError('NO_SUBTITLE_CUE_WITHIN_VIDEO')
    indices=list(dict.fromkeys([available[0],available[len(available)//2],available[-1]]))
    samples=[]
    for index in indices:
        start,end=events[index]
        sec=start+(end-start)*0.45
        in_caption=compare(source,burned,sec,(150,705,1150,104))
        on_progress=compare(source,burned,sec,(150,815,1150,112))
        on_dashboard=compare(source,burned,sec,(150,200,1150,420))
        samples.append({'cue_index':index+1,'time_seconds':round(sec,3),
          'visible_caption_pixels_changed':in_caption,
          'progress_pixels_changed':on_progress,
          'dashboard_pixels_changed':on_dashboard})
        if in_caption<1100 or on_progress>150 or on_dashboard>150:
            raise RuntimeError('CAPTION_NOT_VISIBLE_OR_OVERLAPS_DATA_TIMELINE:'+json.dumps(samples))
    return {'schema_version':1,'research_only':True,'publication_authorized':False,
      'caption_in_frame_visible':True,'progress_bar_unobstructed':True,
      'dashboard_unobstructed':True,'samples':samples}

if __name__=='__main__':
    if len(sys.argv)!=5:
        raise SystemExit('Usage: python verify_research_caption_visual.py SOURCE_MP4 BURNED_MP4 SRT RECEIPT_JSON')
    result=verify(*sys.argv[1:4])
    Path(sys.argv[4]).write_text(json.dumps(result,indent=2,ensure_ascii=False)+'\n',encoding='utf-8')
    print('CAPTION_VISUAL_QA_PASS',json.dumps(result,ensure_ascii=False))
