#!/usr/bin/env python3
import asyncio, json, os, subprocess, sys, random
from pathlib import Path
from daily_gainers_spoken_text import normalize_spoken_text

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
    communicate = edge_tts.Communicate(text=text, voice=voice, rate=rate, boundary='WordBoundary')
    boundaries = []
    with out_path.open('wb') as audio:
        async for chunk in communicate.stream():
            if chunk['type'] == 'audio':
                audio.write(chunk['data'])
            elif chunk['type'] == 'WordBoundary':
                boundaries.append({key: chunk[key] for key in ('text', 'offset', 'duration')})
    if not boundaries:
        raise RuntimeError('Edge TTS returned zero WordBoundary events; check boundary=WordBoundary and service metadata')
    return boundaries

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
    # M5 research retains a per-scene checkpoint on failure; legacy production remains unchanged.
    checkpoint = plan.get("schema_version") == 2
    manifest_path = plan_path.parent / "tts-manifest.json"
    resume = os.environ.get("M5_VERIFIED_PARTIAL_RESUME") == "1"
    if resume:
        marker = json.loads((plan_path.parent / "m5-verified-resume.json").read_text(encoding="utf-8"))
        if not checkpoint or marker.get("source_run") != 38062405623 or marker.get("source_artifact_id") != 11674007334 or marker.get("scene_count") != 5 or marker.get("publication_authorized") is not False:
            raise RuntimeError("M5_RESUME_MARKER_INVALID")
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
        if (manifest.get("voice"), manifest.get("rate"), manifest.get("engine")) != (voice, rate, "edge-tts") or len(manifest.get("scenes", [])) != 5:
            raise RuntimeError("M5_RESUME_MANIFEST_INVALID")
    for scene in plan["scenes"]:
        sid = int(scene["id"])
        out_path = out_dir / f"{sid:02d}.mp3"
        text = normalize_spoken_text(scene["speech_text"] if plan.get("schema_version") == 2 else scene["narration"])
        if resume and sid <= 5:
            record = manifest["scenes"][sid-1]
            import hashlib
            expected_hash = marker["files"][f"audio/{sid:02d}.mp3"]
            if record["id"] != sid or record["spoken_text"] != text or record["engine"] != "edge-tts" or not record["word_boundaries"] or not out_path.is_file() or hashlib.sha256(out_path.read_bytes()).hexdigest() != expected_hash:
                raise RuntimeError(f"M5_RESUME_SCENE_DRIFT_{sid}")
            print(f"scene {sid:02d}: verified reusable original audio", flush=True)
            continue
        engine = None
        errors = []
        boundaries = []
        max_attempts = 4
        for attempt in range(1, max_attempts + 1):
            out_path.unlink(missing_ok=True)
            try:
                boundaries = await edge_tts_save(text, out_path)
                if not out_path.exists() or out_path.stat().st_size < 1000:
                    raise RuntimeError("empty or truncated Edge TTS audio")
                engine = "edge-tts"
                if attempt > 1:
                    print(f"scene {sid:02d}: Edge TTS recovered on attempt {attempt}/{max_attempts}", flush=True)
                break
            except Exception as e:
                errors.append(f"attempt {attempt}: {type(e).__name__}: {e}")
                out_path.unlink(missing_ok=True)
                if attempt == max_attempts:
                    raise RuntimeError(
                        f"Scene {sid}: Edge TTS failed after {max_attempts} attempts; "
                        f"WordBoundary-required subtitles preserved; no unsynchronized fallback. "
                        f"Last error: {type(e).__name__}: {e}"
                    ) from e
                delay = min(20, 2 ** attempt + random.uniform(0, 1.5))
                print(f"scene {sid:02d}: transient Edge TTS failure attempt {attempt}/{max_attempts} "
                      f"({type(e).__name__}: {e}); retry in {delay:.1f}s", flush=True)
                await asyncio.sleep(delay)
        if not out_path.exists() or out_path.stat().st_size < 1000:
            raise RuntimeError(f"TTS output invalid for scene {sid}: {out_path}")
        print(f"scene {sid:02d}: {engine} -> {out_path} ({out_path.stat().st_size} bytes)")
        manifest["engine"] = manifest["engine"] or engine
        manifest["scenes"].append({"id": sid, "engine": engine, "file": str(out_path), "errors": errors, "spoken_text": text, "word_boundaries": boundaries})
        if checkpoint:
            manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

asyncio.run(main())
