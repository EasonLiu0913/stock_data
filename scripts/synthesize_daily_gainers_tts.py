#!/usr/bin/env python3
import asyncio, json, os, subprocess, sys
from pathlib import Path

if len(sys.argv) < 2:
    print("Usage: python scripts/synthesize_daily_gainers_tts.py <plan.json>", file=sys.stderr)
    sys.exit(1)

plan_path = Path(sys.argv[1])
plan = json.loads(plan_path.read_text(encoding="utf-8"))
out_dir = plan_path.parent / "audio"
out_dir.mkdir(parents=True, exist_ok=True)
voice = os.environ.get("YOUTUBE_TTS_VOICE", "zh-TW-HsiaoChenNeural")
rate = os.environ.get("YOUTUBE_TTS_RATE", "+30%")

async def edge_tts_save(text, out_path):
    import edge_tts
    communicate = edge_tts.Communicate(text=text, voice=voice, rate=rate)
    await communicate.save(str(out_path))

def gtts_save(text, out_path):
    from gtts import gTTS
    gTTS(text=text, lang="zh-TW").save(str(out_path))

def espeak_save(text, out_path):
    wav = out_path.with_suffix(".wav")
    subprocess.run(["espeak-ng","-v","cmn","-s","155","-w",str(wav),text], check=True)
    subprocess.run(["ffmpeg","-y","-loglevel","error","-i",str(wav),"-c:a","libmp3lame","-q:a","3",str(out_path)], check=True)
    wav.unlink(missing_ok=True)

async def main():
    manifest = {"voice": voice, "rate": rate, "engine": None, "scenes": []}
    for scene in plan["scenes"]:
        sid = int(scene["id"])
        out_path = out_dir / f"{sid:02d}.mp3"
        text = scene["narration"]
        engine = None
        errors = []
        try:
            await edge_tts_save(text, out_path)
            engine = "edge-tts"
        except Exception as e:
            errors.append(f"edge-tts: {e}")
            try:
                gtts_save(text, out_path)
                engine = "gTTS"
            except Exception as e2:
                errors.append(f"gTTS: {e2}")
                espeak_save(text, out_path)
                engine = "espeak-ng"
        if not out_path.exists() or out_path.stat().st_size < 1000:
            raise RuntimeError(f"TTS output invalid for scene {sid}: {out_path}")
        print(f"scene {sid:02d}: {engine} -> {out_path} ({out_path.stat().st_size} bytes)")
        manifest["engine"] = manifest["engine"] or engine
        manifest["scenes"].append({"id": sid, "engine": engine, "file": str(out_path), "errors": errors})
    (plan_path.parent / "tts-manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

asyncio.run(main())
