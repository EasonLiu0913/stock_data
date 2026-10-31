#!/usr/bin/env python3
"""Opt-in V4 research-only 1080p scene1 preview. NEVER full 9-scene render or upload."""
import argparse, json, shutil, subprocess, tempfile, zipfile
from pathlib import Path
from research_build_pinned_scene1_fixture import build, sha, MP4S
from research_verify_20261008_scene1_source import verify

def run(cmd):
    p=subprocess.run(cmd,capture_output=True,text=True)
    if p.returncode: raise RuntimeError(f"video process failed: {p.stderr[-1200:]}")
    return p.stdout

def preview(oldzip,v4zip,reviewed_srt,destination,allow_research_matte=True):
    out=Path(destination)
    if out.exists() and any(out.iterdir()):
        raise ValueError("Research preview destination must be new and empty")
    out.mkdir(parents=True,exist_ok=True)
    with tempfile.TemporaryDirectory(prefix="mvp10-scene1-") as t:
        temp=Path(t)
        fixture=temp/"fixture"
        # Exact pinned audio/source/SRT provenance fails closed BEFORE rendering.
        build(oldzip,v4zip,reviewed_srt,fixture)
        proof=verify(fixture,fixture/"source_scene1.wav")
        if proof["publishable"] or proof["frozen_ab_complete"] or proof["word_events"]!=128 or proof["srt_cues"]!=14:
            raise ValueError("Frozen research-only source gate")
        with zipfile.ZipFile(oldzip) as z:
            source=temp/"20261008_original.mp4"
            source.write_bytes(z.read("daily-gainers-20261008.mp4"))
        if sha(source)!=MP4S["old"]:
            raise ValueError("Untrusted source MP4")
        mp4=out/"20261008_scene1_V4_1080p_RESEARCH_ONLY.mp4"
        vf="trim=duration=41.712,setpts=PTS-STARTPTS+gte(T\\,7.6)*1.85/TB,fps=24"
        if allow_research_matte: vf+=",drawbox=x=0:y=928:w=iw:h=152:color=0x07111f:t=fill"
        vf+=",format=yuv420p"
        run(["ffmpeg","-hide_banner","-nostdin","-y","-loglevel","error",
             "-i",str(source),"-i",str(fixture/"source_scene1.wav"),
             "-filter_complex",f"[0:v]{vf}[v]","-map","[v]","-map","1:a:0",
             "-c:v","libx264","-preset","ultrafast","-crf","23",
             "-c:a","aac","-b:a","160k","-t","43.562",
             "-movflags","+faststart",str(mp4)])
        playback=out/"20261008_scene1_V4_RESEARCH_ONLY.srt"
        shutil.copyfile(fixture/"daily-gainers-20261008.zh-TW.srt",playback)
        if sha(playback)!="adf0c086bc5c73cf0a3cb9604adad90c2112264381f5b3517dcbba919cfb9024":
            raise ValueError("Subtitle binding drift")
        info=json.loads(run(["ffprobe","-v","error","-show_entries",
                             "format=duration:stream=index,codec_type,width,height,nb_frames,duration",
                             "-of","json",str(mp4)]))
        streams={s["codec_type"]:s for s in info["streams"]}
        v=streams["video"]; a=streams["audio"]
        if (v.get("width"),v.get("height"))!=(1920,1080):
            raise ValueError("Not full HD")
        if abs(float(v["duration"])-43.562)>0.05 or abs(float(a["duration"])-43.562)>0.05:
            raise ValueError("Video/audio drift")
        data={"research_only":True,"publishable":False,"target_date":"20261008",
              "source_artifact_ids":[12953454424,13036325288],
              "source_scene1_wav_sha256":sha(fixture/"source_scene1.wav"),
              "scene1_preview_mp4_sha256":sha(mp4),"audited_14cue_srt_sha256":sha(playback),
              "video_duration_seconds":float(v["duration"]),
              "audio_duration_seconds":float(a["duration"]),
              "subtitle_is_external":True,
              "temporary_caption_band_masks_legacy_footer":allow_research_matte,
              "presenter_v4_fourth_line_freeze_qa":"NOT_APPROVED",
              "external_youtube_player_subtitle_qa":"NOT_ATTEMPTED",
              "formal_AB_complete":False,"publication_authorized":False}
        (out/"research-preview-receipt.json").write_text(json.dumps(data,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
        return data

if __name__=="__main__":
    p=argparse.ArgumentParser()
    p.add_argument("--old-zip",required=True)
    p.add_argument("--v4-zip",required=True)
    p.add_argument("--audited-srt",required=True)
    p.add_argument("--output-dir",required=True)
    p.add_argument("--no-caption-matte",action="store_true")
    args=p.parse_args()
    print(json.dumps(preview(args.old_zip,args.v4_zip,args.audited_srt,args.output_dir,not args.no_caption_matte),ensure_ascii=False,indent=2))
