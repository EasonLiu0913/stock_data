#!/usr/bin/env python3
"""Fail-closed pinned Artifact reassembly of 20261008 first scene, research-only."""
import argparse, copy, hashlib, json, subprocess, tempfile, wave, zipfile
from pathlib import Path
from mutagen.mp3 import MP3

ZIPS = {'old': 'f3863f435e9606745562bb8d8513609f4d3a704769f1a390ac340ee921f24a04',
        'v4': 'fabeb1ca1464163dd072d5a5089c2c345f9527905a75de282c144bab86ab5ea6'}
MP4S = {'old': '587918ab81e2fc111b08aa1a62e5ddf76e2079302c2aed5f5433e79cec410641',
        'v4': '47b27163fc74289373eedaf311897b44b651af83430018a0b2f07be1b6d9a474'}
WAV_SHA = 'fc5598fcb5a4def1a3a0f1bf5d17609c12a7f065589c27109e8d50ce3ce06bc7'
LINE_SHA = '059f9403f614b7c83ecffdf625c3a18adaee21af66cf1f4f394dd0c079d71a40'
SRT_SHA = 'adf0c086bc5c73cf0a3cb9604adad90c2112264381f5b3517dcbba919cfb9024'
MP3_SHA = '3721fc4e80f2ab875499fdb9faf68c382c8775dfb9397000f150de5474c043e6'

def insist(value, reason):
    if not value:
        raise ValueError(reason)

def sha(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()

def ffmpeg(*args):
    subprocess.run(['ffmpeg', '-nostdin', '-y', '-loglevel', 'error', *map(str,args)], check=True)

def pcm(path):
    with wave.open(str(path), 'rb') as w:
        insist((w.getframerate(), w.getnchannels(), w.getsampwidth()) == (24000,1,2), 'PCM format')
        return w.readframes(w.getnframes())

def savewav(path, data):
    with wave.open(str(path), 'wb') as w:
        w.setparams((1,2,24000,0,'NONE','not compressed'))
        w.writeframes(data)

def build(oldzip,v4zip,srt,out):
    out=Path(out)
    out.mkdir(parents=True,exist_ok=True)
    (out/'audio').mkdir(exist_ok=True)
    insist(sha(oldzip)==ZIPS['old'] and sha(v4zip)==ZIPS['v4'], 'artifact ZIP SHA mismatch')
    insist(sha(srt)==SRT_SHA, 'reviewed 14-cue subtitle SHA mismatch')
    with tempfile.TemporaryDirectory() as tmp:
        tmp=Path(tmp)
        extracted={}
        for key,zpath,date in [('old',oldzip,'20261008'),('v4',v4zip,'20261013')]:
            with zipfile.ZipFile(zpath) as z:
                p=tmp/(key+'.mp4')
                p.write_bytes(z.read('daily-gainers-'+date+'.mp4'))
                insist(sha(p)==MP4S[key], key+' MP4 SHA mismatch')
                extracted[key]=(p,json.loads(z.read('plan.json')),json.loads(z.read('tts-manifest.json')))
        old,oldplan,oldtts=extracted['old']
        v4,v4plan,v4tts=extracted['v4']
        insist(oldplan['target_date']=='20261008' and len(oldplan['scenes'])==9,'historical plan mismatch')
        insist(oldtts['voice']==v4tts['voice']=='zh-TW-YunJheNeural' and oldtts['rate']==v4tts['rate']=='+15%','voice drift')
        ffmpeg('-i',old,'-t','41.712','-ar','24000','-ac','1','-c:a','pcm_s16le',tmp/'old.wav')
        ffmpeg('-ss','7.6','-i',v4,'-t','1.85','-ar','24000','-ac','1','-c:a','pcm_s16le',tmp/'line.wav')
        oldpcm=pcm(tmp/'old.wav')
        linepcm=pcm(tmp/'line.wav')
        insist(len(oldpcm)==1001088*2 and len(linepcm)==44400*2,'decoded length mismatch')
        insist(sha(tmp/'line.wav')==LINE_SHA,'source fourth-line WAV SHA mismatch')
        outwav=out/'source_scene1.wav'
        savewav(outwav,oldpcm[:182400*2]+linepcm+oldpcm[182400*2:])
        insist(sha(outwav)==WAV_SHA,'sample-exact V4 scene SHA mismatch')
        before=oldtts['scenes'][0]['word_boundaries'][:17]
        after=oldtts['scenes'][0]['word_boundaries'][17:]
        lineevents=v4tts['scenes'][0]['word_boundaries'][17:21]
        insist(before==v4tts['scenes'][0]['word_boundaries'][:17] and [e['text'] for e in lineevents]==['那麼','我們','開始','囉'],'brand event mismatch')
        merged=before+lineevents+[dict(e,offset=e['offset']+18500000) for e in after]
        insist(len(merged)==128,'word count mismatch')
        original=oldplan['scenes'][0]['narration']
        content=original.replace('錢在哪，我們就在哪！\n','錢在哪，我們就在哪！那麼我們開始囉。\n',1)
        insist(content!=original and content.count('那麼我們開始囉。')==1,'text rewrite mismatch')
        plan=copy.deepcopy(oldplan)
        plan['scenes']=[copy.deepcopy(oldplan['scenes'][0])]
        plan['scenes'][0]['narration']=content
        plan.update(scene_count=1,research_only=True,production_video_plan=False,historical_full_plan_scene_count=9)
        tts=copy.deepcopy(oldtts)
        tts['scenes']=[copy.deepcopy(oldtts['scenes'][0])]
        item=tts['scenes'][0]
        item.update(spoken_text=content,word_boundaries=merged,engine='edge-tts-reused-pcm-research-only',file='audio/01.mp3')
        item['research_provenance']={'source_artifacts':[12953454424,13036325288],'does_not_attest_new_live_edge_tts':True}
        tts.update(research_only=True,publication_authorized=False)
        (out/'plan.json').write_text(json.dumps(plan,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
        (out/'tts-manifest.json').write_text(json.dumps(tts,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
        ffmpeg('-i',outwav,'-c:a','libmp3lame','-b:a','160k',out/'audio/01.mp3')
        insist(sha(out/'audio/01.mp3')==MP3_SHA,'encoded MP3 SHA mismatch (fail closed)')
        (out/'daily-gainers-20261008.zh-TW.srt').write_bytes(Path(srt).read_bytes())
        receipt={
            'research_only':True,'publication_authorized':False,'date':'20261008',
            'source_line4_owner_lexical_pass':True,'scene1_pcm_sha256':WAV_SHA,
            'reencoded_mp3_sha256':MP3_SHA,'research_srt_sha256':SRT_SHA,'cue_count':14,
            'main_modified':False,'youtube_uploaded':False,
            'mp3_measured_seconds':MP3(str(out/'audio/01.mp3')).info.length,
            'original_sources':[12953454424,13036325288]}
        (out/'integration-receipt.json').write_text(json.dumps(receipt,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
        return {'date':'20261008','wav_sha256':WAV_SHA,'mp3_sha256':MP3_SHA,
                'srt_sha256':SRT_SHA,'word_events':128,'publication_authorized':False}

if __name__=='__main__':
    ap=argparse.ArgumentParser()
    ap.add_argument('--old',required=True)
    ap.add_argument('--v4',required=True)
    ap.add_argument('--srt',required=True)
    ap.add_argument('--out',required=True)
    args=ap.parse_args()
    print(json.dumps(build(args.old,args.v4,args.srt,args.out),indent=2))
