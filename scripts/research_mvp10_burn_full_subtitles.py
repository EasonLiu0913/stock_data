#!/usr/bin/env python3
"""Research-only, pinned-date FULL 1080p MP4 caption burn. No upload capability.

Reads an existing fully rendered real video plus its audited SRT. Does not invoke
TTS, stock-data research, the production uploader or the nine-scene renderer.
This isolated entrypoint is intentionally pinned to the accepted 20261013
historical full-episode source; it is not a generic scheduled production job.
"""
import argparse
import hashlib
import json
import re
import subprocess
import wave
from pathlib import Path

DATE = "20261013"
SOURCE_SHA = "47b27163fc74289373eedaf311897b44b651af83430018a0b2f07be1b6d9a474"
SRT_SHA = "91e7632ccb0fe81ea9f22808fa8e6dedb66d60ae65ec36685697570702c57f28"
FOURTH_LINE = "那麼我們開始囉。"
NO_CC = re.compile(r"(?:歡迎|請)?(?:打開|開啟)\s*(?:CC|ＣＣ)\s*(?:中文字幕)?(?:觀賞)?", re.I)

def insist(value, message):
    if not value:
        raise ValueError(message)

def sha(path):
    h = hashlib.sha256()
    with Path(path).open("rb") as source:
        for chunk in iter(lambda: source.read(1048576), b""):
            h.update(chunk)
    return h.hexdigest()

def verify(mp4, srt, plan_path, tts_path):
    plan = json.loads(Path(plan_path).read_text(encoding="utf-8"))
    tts = json.loads(Path(tts_path).read_text(encoding="utf-8"))
    captions = Path(srt).read_text(encoding="utf-8-sig")
    insist(plan.get("target_date") == DATE and len(plan.get("scenes", [])) == 7, "Unexpected source date or scenes")
    insist((tts.get("voice"), tts.get("rate")) == ("zh-TW-YunJheNeural", "+15%"), "TTS version mismatch")
    insist(len(tts.get("scenes", [])) == 7, "Incomplete TTS manifest")
    full_intro = "".join((
        "大家好，歡迎來到 TAIWAN STOCK！",
        "追蹤資金，解讀行情。",
        "錢在哪，我們就在哪！",
        FOURTH_LINE
    ))
    insist(plan["scenes"][0].get("narration", "").startswith(full_intro), "Missing frozen V4 opening")
    insist(NO_CC.search(captions + json.dumps(plan, ensure_ascii=False)) is None, "Obsolete CC reminder")
    cues = [s for s in re.split(r"\n\s*\n", captions.strip()) if s.strip()]
    insist(len(cues) == 91, "Missing original SRT cues")
    insist(sha(mp4) == SOURCE_SHA and sha(srt) == SRT_SHA, "Unapproved video/SRT source SHA")
    return {"target_date": DATE, "scene_count": 7, "srt_cues": len(cues)}

def make_footer(path):
    from PIL import Image, ImageDraw, ImageFont
    im = Image.new("RGBA", (1920, 45), (7, 17, 31, 255))
    draw = ImageDraw.Draw(im)
    font_file = "/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc"
    if not Path(font_file).exists():
        raise RuntimeError("NotoSansCJK-Regular.ttc not installed; abort caption burn")
    font = ImageFont.truetype(font_file, 24)
    draw.text((52, 7), "TAIWANSTOCK｜每日5%強勢股研究", font=font, fill=(196, 213, 233, 255))
    im.save(path)

def build(mp4, srt, plan, tts, output, receipt):
    output, receipt = Path(output), Path(receipt)
    insist(not output.exists(), "Refusing to overwrite existing full video")
    result = verify(mp4, srt, plan, tts)
    output.parent.mkdir(parents=True, exist_ok=True)
    footer = output.parent / "research_brand_footer.png"
    make_footer(footer)
    subtitle_filter = (
        "FontName=Noto Sans CJK TC,Fontsize=18,Alignment=2,MarginV=13,"
        "Outline=1,Shadow=0,PrimaryColour=&H00FFFFFF,OutlineColour=&H00101820"
    )
    filter_graph = (
        "[0:v]drawbox=x=0:y=930:w=iw:h=150:color=0x07111f:t=fill,"
        f"subtitles='{Path(srt).resolve()}':force_style='{subtitle_filter}'[base];"
        "[base][1:v]overlay=0:1035:shortest=1,format=yuv420p[v]"
    )
    command = [
        "ffmpeg", "-hide_banner", "-nostdin", "-y", "-loglevel", "error",
        "-i", str(mp4), "-loop", "1", "-i", str(footer),
        "-filter_complex", filter_graph, "-map", "[v]", "-map", "0:a:0",
        "-c:v", "libx264", "-preset", "ultrafast", "-crf", "23",
        "-r", "24", "-c:a", "copy", "-shortest", "-movflags", "+faststart",
        str(output)
    ]
    subprocess.run(command, check=True)
    data = json.loads(subprocess.check_output([
        "ffprobe", "-v", "error", "-show_entries",
        "format=duration:stream=codec_type,codec_name,width,height,duration",
        "-of", "json", str(output)
    ], text=True))
    video_streams = [s for s in data["streams"] if s.get("codec_type") == "video"]
    audio_streams = [s for s in data["streams"] if s.get("codec_type") == "audio"]
    insist(len(video_streams) == len(audio_streams) == 1, "Missing audio/video streams")
    insist((video_streams[0].get("width"), video_streams[0].get("height")) == (1920,1080), "Not 1080p")
    insist(310.5 <= float(data["format"]["duration"]) <= 312.0, "Incomplete video duration")
    result.update({
        "research_only": True, "publication_authorized": False,
        "youtube_upload_performed": False, "srt_hard_burned_into_video": True,
        "source_mp4_sha256": SOURCE_SHA, "source_srt_sha256": SRT_SHA,
        "rendered_mp4_sha256": sha(output),
        "duration_seconds": float(data["format"]["duration"]),
        "footer_cc_reminder": False, "external_srt_retained_separately": True,
        "dashboard_opening_full_version_gate": "NOT_YET_VERIFIED",
        "formal_mvp10_A_or_B_pass": False
    })
    receipt.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return result

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--video", required=True)
    parser.add_argument("--srt", required=True)
    parser.add_argument("--plan", required=True)
    parser.add_argument("--tts", required=True)
    parser.add_argument("--output", required=True)
    parser.add_argument("--receipt", required=True)
    args = parser.parse_args()
    build(args.video, args.srt, args.plan, args.tts, args.output, args.receipt)
