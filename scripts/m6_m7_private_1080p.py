#!/usr/bin/env python3
"""M6/M7 1080p local-private research render. No network, upload, TTS, or acoustic claims."""
import argparse,hashlib,json,pathlib,subprocess,tempfile
from PIL import Image,ImageDraw,ImageFont
EXPECTED='1daf7a269c0a39ab8c9bab59048c6c36293ce5ee5a9e878bb8971f689126271f'
def digest(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def cmd(args):return subprocess.run(args,check=True,stdout=subprocess.PIPE,stderr=subprocess.PIPE).stdout
def font(size):
 for p in ['/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc']:
  if pathlib.Path(p).exists():return ImageFont.truetype(p,size)
 raise RuntimeError('M7_FONT_MISSING: Noto Sans CJK must be installed; do not render missing glyph boxes')
def main():
 p=argparse.ArgumentParser();p.add_argument('--handoff',type=pathlib.Path,required=True);p.add_argument('--sprite',type=pathlib.Path,required=True);p.add_argument('--source',type=pathlib.Path,required=True);p.add_argument('--output',type=pathlib.Path,required=True);a=p.parse_args()
 m=json.loads((a.handoff/'manifest.json').read_text());source=json.loads((a.source/'source.json').read_text())
 assert m['schema']=='M5-PRIVATE-PREVIEW-HANDOFF-v1' and m['timing_status']=='TIMING_ESTIMATED_NOT_SYNC_VERIFIED' and m['release_gate']=='BLOCKED' and all(v is False for v in m['locks'].values())
 assert len(m['audio'])==len(source['scenes'])==7 and m['blocks']==14 and m['duration_seconds']==79.416 and digest(a.handoff/'candidate.srt')==EXPECTED
 sprite=Image.open(a.sprite).convert('RGBA');sw,sh=sprite.size;assert sw%4==0 and sw//4>=300 and sh>=300,(sw,sh)
 states=[sprite.crop((j*sw//4,0,(j+1)*sw//4,sh)) for j in range(4)]
 a.output.mkdir(parents=True,exist_ok=True);pieces=[];begin=0.
 with tempfile.TemporaryDirectory() as td:
  root=pathlib.Path(td)
  for ix,(r,scene) in enumerate(zip(m['audio'],source['scenes'])):
   mp3=a.handoff/'audio'/('%02d.mp3'%r['scene']);assert digest(mp3)==r['sha256']
   assert scene['scene']==r['scene'] and scene['speech_text']==scene['caption_text']==scene['display_text']
   duration=r['duration_seconds'];title=['節目開場','市場觀察','市場重點','資金與行情','個股研究','籌碼與風險','重點整理'][ix]
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
   for j in range(7):
    x=110+j*205;d.rounded_rectangle((x,888,x+188,906),7,fill='#ffcf73' if j==ix else '#3c536b')
   d.text((110,932),f'{ix+1}/7   {title}',font=font(31),fill='#dbeafe')
   d.text((830,937),'歡迎打開 CC中文字幕觀賞',font=font(25),fill='#cbd5e1')
   d.text((110,1016),'PRIVATE PREVIEW | TIMING ESTIMATED - NOT SYNC VERIFIED',font=font(23),fill='#facc15')
   frame=root/f'slide-{ix}.png';base.save(frame)
   # Visual lip animation only: repeating shapes; NOT phoneme-aligned.
   crops=[]
   for j,state in enumerate(states):
    v=state.copy();v.thumbnail((415,550));q=root/f'sprite-{j}.png';v.save(q);crops.append(q)
   output=root/f'part-{ix}.mp4'
   args=['ffmpeg','-hide_banner','-loglevel','error','-y','-loop','1','-framerate','24','-i',str(frame),'-i',str(mp3)]
   for q in crops:args+=['-loop','1','-framerate','24','-i',str(q)]
   ff='[0:v]format=rgba[b];[2:v]format=rgba[s0];[b][s0]overlay=W-w-65:H-h-160[v0];'
   # overlays of complete mouth-state crops; all source assets from pinned repository.
   for j in (1,2,3):
    ff+=f'[{j+2}:v]format=rgba[s{j}];[v{j-1}][s{j}]overlay=W-w-65:H-h-160:enable=\'eq(mod(floor(t*4),4),{j})\'[v{j}];'
   ff+='[v3]format=yuv420p[v]'
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
  proof={'schema':'M6-M7-PRIVATE-REVIEW-v1','resolution':'1920x1080','duration_seconds':dur,'source_duration_seconds':79.416,'audio_count':7,'subtitle_count':14,'srt_sha256':EXPECTED,'mp4_sha256':digest(movie),'estimated_timing_not_verified':True,'subtitles_delivery':'separate optional SRT, not burnt into MP4','cjk_font':'Noto Sans CJK required','vtuber':'repository four-state sprite; visual timing only; not phoneme synchronized','release_gate':'BLOCKED','publication_authorized':False,'prompt_b_eligible':False,'real_acoustic_boundaries':'0/15'}
  (a.output/'review-proof.json').write_text(json.dumps(proof,ensure_ascii=False,indent=2)+'\n')
  (a.output/'candidate.srt').write_bytes((a.handoff/'candidate.srt').read_bytes())
  print('M6_M7_PRIVATE_1080P_PASS duration=%.3f scenes=7 subtitles=14 acoustic=0/15 release=BLOCKED'%dur)
if __name__=='__main__':main()
