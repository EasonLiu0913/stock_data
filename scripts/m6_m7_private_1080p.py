#!/usr/bin/env python3
"""M6/M7 1080p local-private research render. No network, upload, TTS, or acoustic claims."""
import argparse,hashlib,json,pathlib,subprocess,tempfile,math
from functools import lru_cache
from PIL import Image,ImageDraw,ImageFont
EXPECTED='1daf7a269c0a39ab8c9bab59048c6c36293ce5ee5a9e878bb8971f689126271f'
def digest(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def cmd(args):return subprocess.run(args,check=True,stdout=subprocess.PIPE,stderr=subprocess.PIPE).stdout
@lru_cache(maxsize=16)
def font(size):
 for p in ['/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc']:
  if pathlib.Path(p).exists():return ImageFont.truetype(p,size)
 raise RuntimeError('M7_FONT_MISSING: Noto Sans CJK must be installed; do not render missing glyph boxes')
def chapter_timeline(audio, config):
 chapters=config['chapters']
 assert config['schema']=='M7-CHAPTER-MAP-v1' and config['publication_authorized'] is False
 scenes=[int(r['scene']) for r in audio]
 assert scenes==list(range(1,8)), 'Unexpected original audio scene ordering'
 flattened=[s for ch in chapters for s in ch['scenes']]
 assert flattened==scenes and all(ch['scenes'] and isinstance(ch['title'],str) and ch['title'] for ch in chapters), 'Chapters must partition seven audio scenes exactly once in order'
 assert chapters[0]['scenes']==[1,2,3] and chapters[0]['id']=='opening', 'Fixed opening cannot jump chapter after first or second sentence'
 offsets={}; t=0.0
 for r in audio:
  offsets[int(r['scene'])]=t
  t+=float(r['duration_seconds'])
 assert round(t,3)==79.416, 'Source audio duration changed'
 timeline=[]; pointer=0
 for index,ch in enumerate(chapters):
  start=offsets[ch['scenes'][0]]
  end=t if index==len(chapters)-1 else offsets[chapters[index+1]['scenes'][0]]
  assert end>start and (not timeline or abs(start-timeline[-1]['end_seconds'])<0.00001)
  timeline.append(dict(id=ch['id'],title=ch['title'],scenes=ch['scenes'],ordinal=index+1,total=len(chapters),start_seconds=round(start,3),end_seconds=round(end,3)))
 return timeline

def progress_state(t, timeline):
 total=timeline[-1]['end_seconds']
 assert 0<=t<=total+0.001
 ch=next((x for x in timeline if t < x['end_seconds']),timeline[-1])
 elapsed=max(0.,min(t-ch['start_seconds'],ch['end_seconds']-ch['start_seconds']))
 fraction=elapsed/(ch['end_seconds']-ch['start_seconds'])
 return ch,fraction,max(0.,total-t)

def clock(t):
 seconds=max(0,int(t));return f'{seconds//60:02d}:{seconds%60:02d}'

def progress_overlay(global_t,timeline):
 ch,frac,remaining=progress_state(min(global_t,timeline[-1]['end_seconds']),timeline)
 overlay=Image.new('RGBA',(1620,180),(0,0,0,0));d=ImageDraw.Draw(overlay)
 count=len(timeline);gap=16;barwidth=(1430-gap*(count-1))/count
 for j in range(count):
  x=int(j*(barwidth+gap));right=int(x+barwidth)
  d.rounded_rectangle((x,20,right,38),radius=7,fill='#3c536b')
  if j<ch['ordinal']-1: fill=1.
  elif j==ch['ordinal']-1: fill=frac
  else: fill=0.
  if fill>0:
   width=int(barwidth*fill)
   if width>0:d.rounded_rectangle((x,20,min(right,x+max(2,width)),38),radius= min(7,max(1,width//2)),fill='#ffcf73')
  d.text((x,0),timeline[j]['title'],font=font(17),fill='#dbeafe')
 d.text((0,58),f"{ch['ordinal']}/{count}   {ch['title']}",font=font(29),fill='#dbeafe')
 d.text((0,105),f"已播放 {clock(global_t)}  |  剩餘 {clock(remaining)}  |  總長 {clock(timeline[-1]['end_seconds'])}",font=font(22),fill='#dbeafe')
 return overlay

def main():
 p=argparse.ArgumentParser();p.add_argument('--handoff',type=pathlib.Path,required=True);p.add_argument('--sprite',type=pathlib.Path,required=True);p.add_argument('--source',type=pathlib.Path,required=True);p.add_argument('--output',type=pathlib.Path,required=True);p.add_argument('--chapters',type=pathlib.Path,default=pathlib.Path('data_research/m5/m7-research-chapters.json'));a=p.parse_args()
 m=json.loads((a.handoff/'manifest.json').read_text());source=json.loads((a.source/'source.json').read_text())
 assert m['schema']=='M5-PRIVATE-PREVIEW-HANDOFF-v1' and m['timing_status']=='TIMING_ESTIMATED_NOT_SYNC_VERIFIED' and m['release_gate']=='BLOCKED' and all(v is False for v in m['locks'].values())
 assert len(m['audio'])==len(source['scenes'])==7 and m['blocks']==14 and m['duration_seconds']==79.416 and digest(a.handoff/'candidate.srt')==EXPECTED
 chapter_config=json.loads(a.chapters.read_text())
 timeline=chapter_timeline(m['audio'],chapter_config)
 chapter_for_scene={s:ch for ch in timeline for s in ch['scenes']}
 sprite=Image.open(a.sprite).convert('RGBA');sw,sh=sprite.size;assert sw%4==0 and sw//4>=300 and sh>=300,(sw,sh)
 states=[sprite.crop((j*sw//4,0,(j+1)*sw//4,sh)) for j in range(4)]
 a.output.mkdir(parents=True,exist_ok=True);pieces=[];begin=0.
 with tempfile.TemporaryDirectory() as td:
  root=pathlib.Path(td)
  for ix,(r,scene) in enumerate(zip(m['audio'],source['scenes'])):
   mp3=a.handoff/'audio'/('%02d.mp3'%r['scene']);assert digest(mp3)==r['sha256']
   assert scene['scene']==r['scene'] and scene['speech_text']==scene['caption_text']==scene['display_text']
   duration=r['duration_seconds'];chapter=chapter_for_scene[int(r['scene'])];title=chapter['title']
   base=Image.new('RGB',(1920,1080),'#101c2d');d=ImageDraw.Draw(base)
   d.rounded_rectangle((74,55,1846,170),25,fill='#1a304b')
   d.text((110,79),'TAIWAN STOCK',font=font(49),fill='#f8fafc')
   d.text((113,215),title,font=font(64),fill='#ffcf73')
   # Copy text verbatim; never pretend it is acoustic evidence.
   raw=scene['display_text'];line='';lines=[];body_font=font(37)
   for ch in raw:
    proposal=line+ch
    if line and d.textbbox((0,0),proposal,font=body_font)[2]>1050:
     lines.append(line);line=ch
    else:line=proposal
   if line:lines.append(line)
   # Never clip or silently omit narration: copy full text to subtitle sidecar; slides show overview.
   for j,line in enumerate(lines[:7]):d.text((116,325+j*66),line,font=body_font,fill='#ffffff')
   if len(lines)>7:d.text((116,808),'完整內容請開啟 CC 字幕',font=font(27),fill='#cbd5e1')
   d.text((1500,937),'CC 字幕可選擇開啟',font=font(21),fill='#cbd5e1')
   d.text((110,1016),'PRIVATE PREVIEW | TIMING ESTIMATED - NOT SYNC VERIFIED',font=font(23),fill='#facc15')
   frame=root/f'slide-{ix}.png';base.save(frame)
   # Visual lip animation only: repeating shapes; NOT phoneme-aligned.
   crops=[]
   for j,state in enumerate(states):
    v=state.copy();v.thumbnail((415,550));q=root/f'sprite-{j}.png';v.save(q);crops.append(q)
   overlaydir=root/f'progress-{ix}';overlaydir.mkdir()
   frames=math.ceil(duration*24)
   for n in range(frames):
    progress_overlay(min(begin+n/24,timeline[-1]['end_seconds']),timeline).save(overlaydir/f'{n:05d}.png')
   output=root/f'part-{ix}.mp4'
   args=['ffmpeg','-hide_banner','-loglevel','error','-y','-loop','1','-framerate','24','-i',str(frame),'-i',str(mp3)]
   for q in crops:args+=['-loop','1','-framerate','24','-i',str(q)]
   args+=['-framerate','24','-i',str(overlaydir/'%05d.png')]
   ff='[0:v]format=rgba[b];[2:v]format=rgba[s0];[b][s0]overlay=W-w-65:H-h-160[v0];'
   # overlays of complete mouth-state crops; all source assets from pinned repository.
   for j in (1,2,3):
    ff+=f'[{j+2}:v]format=rgba[s{j}];[v{j-1}][s{j}]overlay=W-w-65:H-h-160:enable=\'eq(mod(floor(t*4),4),{j})\'[v{j}];'
   ff+='[v3][6:v]overlay=110:868:shortest=1,format=yuv420p[v]'
   cmd(args+['-filter_complex',ff,'-map','[v]','-map','1:a','-t',str(duration),'-r','24','-c:v','libx264','-preset','ultrafast','-crf','28','-c:a','aac','-b:a','128k','-pix_fmt','yuv420p',str(output)])
   pieces.append(output);begin+=duration
  assert round(begin,3)==79.416
  concat=root/'concat.txt';concat.write_text(''.join("file '"+str(q)+"'\n" for q in pieces))
  raw=root/'joined.mp4';cmd(['ffmpeg','-hide_banner','-loglevel','error','-y','-f','concat','-safe','0','-i',str(concat),'-c','copy',str(raw)])
  movie=a.output/'m6-m7-private-1080p.mp4'
  # Keep estimated subtitles as optional external CC: do NOT burn a full-width line over presenter.
  cmd(['ffmpeg','-hide_banner','-loglevel','error','-y','-i',str(raw),'-c','copy','-movflags','+faststart',str(movie)])
  info=json.loads(cmd(['ffprobe','-v','error','-show_entries','format=duration:stream=codec_name,width,height','-of','json',str(movie)]))
  v=next(s for s in info['streams'] if s['codec_name']=='h264');dur=float(info['format']['duration']);assert (v['width'],v['height'])==(1920,1080) and abs(dur-79.416)<1.5
  (a.output/'chapter-manifest.json').write_text(json.dumps({'schema':'M7-CHAPTER-TIMELINE-v1','timeline':timeline,'timing_basis':chapter_config['timing_basis'],'subtitle_timing':'TIMING_ESTIMATED_NOT_SYNC_VERIFIED','publication_authorized':False},ensure_ascii=False,indent=2)+'\n')
  proof={'schema':'M6-M7-PRIVATE-REVIEW-v1','resolution':'1920x1080','duration_seconds':dur,'source_duration_seconds':79.416,'audio_count':7,'progress_mode':'frame-driven 24fps cumulative source-audio chapter clock','chapter_count':len(timeline),'chapter_manifest_sha256':digest(a.output/'chapter-manifest.json'),'subtitle_count':14,'srt_sha256':EXPECTED,'mp4_sha256':digest(movie),'estimated_timing_not_verified':True,'subtitles_delivery':'separate optional SRT, not burnt into MP4','cjk_font':'Noto Sans CJK required','vtuber':'repository four-state sprite; visual timing only; not phoneme synchronized','release_gate':'BLOCKED','publication_authorized':False,'prompt_b_eligible':False,'real_acoustic_boundaries':'0/15'}
  (a.output/'review-proof.json').write_text(json.dumps(proof,ensure_ascii=False,indent=2)+'\n')
  (a.output/'candidate.srt').write_bytes((a.handoff/'candidate.srt').read_bytes())
  print('M6_M7_PRIVATE_1080P_PASS duration=%.3f scenes=7 chapters=%d subtitles=14 acoustic=0/15 release=BLOCKED'%(dur,len(timeline)))
if __name__=='__main__':main()
