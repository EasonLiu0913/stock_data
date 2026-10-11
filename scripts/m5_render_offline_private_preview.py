#!/usr/bin/env python3
"""Offline research-only MP4 renderer, never publishing and never claiming acoustic sync."""
import argparse,hashlib,json,pathlib,subprocess,tempfile
EXPECTED='1daf7a269c0a39ab8c9bab59048c6c36293ce5ee5a9e878bb8971f689126271f'
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def main():
 p=argparse.ArgumentParser();p.add_argument('--handoff',type=pathlib.Path,required=True);p.add_argument('--output',type=pathlib.Path,required=True);a=p.parse_args()
 h=a.handoff;m=json.loads((h/'manifest.json').read_text());assert m['schema']=='M5-PRIVATE-PREVIEW-HANDOFF-v1' and m['timing_status']=='TIMING_ESTIMATED_NOT_SYNC_VERIFIED';assert m['locks'] and all(v is False for v in m['locks'].values());assert m['release_gate']=='BLOCKED' and m['actual_acoustic_boundaries']=='0/15';assert len(m['audio'])==7 and m['blocks']==14 and m['duration_seconds']==79.416 and sha(h/'candidate.srt')==EXPECTED==m['srt_sha256']
 for r in m['audio']:assert sha(h/'audio'/('%02d.mp3'%r['scene']))==r['sha256']
 a.output.parent.mkdir(parents=True,exist_ok=True)
 with tempfile.TemporaryDirectory():
  args=['ffmpeg','-hide_banner','-nostdin','-y','-f','lavfi','-i','color=c=0x101b2b:s=960x540:r=24']
  for r in m['audio']:args+=['-i',str((h/'audio'/('%02d.mp3'%r['scene'])).resolve())]
  subtitles=str((h/'candidate.srt').resolve()).replace('\\','\\\\').replace(':','\\:').replace("'","\\'").replace(',','\\,')
  filters=''.join(f'[{i}:a]aresample=async=1:first_pts=0[a{i}];' for i in range(1,8))+''.join(f'[a{i}]' for i in range(1,8))+'concat=n=7:v=0:a=1[all_audio];'+f"[0:v]subtitles=filename='{subtitles}':force_style='FontName=Noto Sans CJK TC,FontSize=22,PrimaryColour=&H00FFFFFF,OutlineColour=&H00000000,Outline=2,MarginV=75',drawtext=text='TAIWAN STOCK  /  PRIVATE RESEARCH PREVIEW':fontcolor=white:fontsize=22:x=(w-text_w)/2:y=38,drawtext=text='ESTIMATED CAPTION TIMING - NOT SYNC VERIFIED':fontcolor=yellow:fontsize=16:x=(w-text_w)/2:y=h-38[video]"
  args+=['-filter_complex',filters,'-map','[video]','-map','[all_audio]','-t','79.416','-c:v','libx264','-preset','ultrafast','-crf','26','-pix_fmt','yuv420p','-c:a','aac','-b:a','160k','-movflags','+faststart',str(a.output)]
  subprocess.run(args,check=True,stdout=subprocess.DEVNULL,stderr=subprocess.PIPE)
 probe=json.loads(subprocess.check_output(['ffprobe','-v','error','-show_entries','format=duration','-of','json',str(a.output)]));duration=float(probe['format']['duration']);assert abs(duration-79.416)<.08,(duration,79.416)
 report={'schema':'M5-OFFLINE-RESEARCH-MP4-v1','status':'PRIVATE_PREVIEW_RENDERED_NOT_SYNC_VERIFIED','timing_status':m['timing_status'],'source_audio_artifact':m['source_audio_artifact'],'candidate_artifact':m['origin_artifact'],'mp4_sha256':sha(a.output),'bytes':a.output.stat().st_size,'duration_seconds':duration,'acoustic_boundaries_verified':'0/15','publication_authorized':False,'release_gate':'BLOCKED'}
 (a.output.parent/'render-proof.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n');print('M5_OFFLINE_MP4_PASS duration=%.3f estimated_subtitles=true acoustic=0/15 release=BLOCKED'%duration)
if __name__=='__main__':main()
