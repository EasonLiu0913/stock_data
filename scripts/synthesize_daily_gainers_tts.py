#!/usr/bin/env python3
import asyncio, json, os, subprocess, sys, random, hashlib
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

async def edge_tts_save(text, out_path, transport_record=None):
    import edge_tts
    diagnostic_enabled = os.environ.get("TAIWAN_STOCK_TTS_TRANSPORT_DIAGNOSTICS") == "1"
    observation = None
    if diagnostic_enabled:
        import aiohttp
        import edge_tts.communicate as communicate_module
        from daily_gainers_tts_transport_diagnostics import (
            TransportObservation,
            observe_communicate_transport,
        )
        observation = TransportObservation()
        transport_record.update({
            "edge_tts_version": getattr(edge_tts, "__version__", "unknown"),
            "aiohttp_version": getattr(aiohttp, "__version__", "unknown"),
        })
        observer = observe_communicate_transport(communicate_module, observation)
    else:
        from contextlib import nullcontext
        observer = nullcontext()

    communicate = edge_tts.Communicate(text=text, voice=voice, rate=rate, boundary='WordBoundary')
    boundaries = []
    result = "error"
    try:
        with observer:
            with out_path.open('wb') as audio:
                async for chunk in communicate.stream():
                    if chunk['type'] == 'audio':
                        audio.write(chunk['data'])
                        if observation is not None:
                            observation.audio_bytes += len(chunk['data'])
                    elif chunk['type'] == 'WordBoundary':
                        boundaries.append({key: chunk[key] for key in ('text', 'offset', 'duration')})
                        if observation is not None:
                            observation.word_boundary_count += 1
            if not boundaries:
                raise RuntimeError('Edge TTS returned zero WordBoundary events; check boundary=WordBoundary and service metadata')
        result = "stream_completed"
    except Exception as error:
        if observation is not None:
            if observation.transport_error is None:
                observation.transport_error = type(error).__name__
            transport_record.update(observation.as_dict(result=result))
        raise
    if observation is not None:
        transport_record.update(observation.as_dict(result=result))
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
    safe_retry = os.environ.get("TAIWAN_STOCK_TTS_RESUME") == "1"
    transport_diagnostics = os.environ.get("TAIWAN_STOCK_TTS_TRANSPORT_DIAGNOSTICS") == "1"
    transport_diagnostics_path = plan_path.parent / "tts-transport-diagnostics.json"
    transport_diagnostic_doc = {"schema_version": 1, "attempts": []}
    if transport_diagnostics and transport_diagnostics_path.is_file():
        try:
            existing_diagnostics = json.loads(transport_diagnostics_path.read_text(encoding="utf-8"))
            if existing_diagnostics.get("schema_version") == 1 and isinstance(existing_diagnostics.get("attempts"), list):
                transport_diagnostic_doc = existing_diagnostics
        except (OSError, json.JSONDecodeError):
            pass

    def save_transport_diagnostic(record):
        if not transport_diagnostics:
            return
        transport_diagnostic_doc["attempts"].append(record)
        temporary = transport_diagnostics_path.with_suffix(".json.tmp")
        try:
            temporary.write_text(json.dumps(transport_diagnostic_doc, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
            temporary.replace(transport_diagnostics_path)
        except OSError as error:
            print(f"TTS transport diagnostic could not be persisted ({type(error).__name__})", file=sys.stderr, flush=True)

    if safe_retry:
        if checkpoint or resume or not manifest_path.is_file():
            raise RuntimeError("SAFE_TTS_RETRY_NOT_ELIGIBLE")
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
        if (manifest.get("voice"), manifest.get("rate")) != (voice, rate) or (manifest.get("engine") not in ("edge-tts", None)) or (manifest["scenes"] and manifest.get("engine") != "edge-tts"):
            raise RuntimeError("SAFE_TTS_RETRY_VOICE_DRIFT")
        if len(manifest.get("scenes", [])) > len(plan["scenes"]):
            raise RuntimeError("SAFE_TTS_RETRY_SCENE_OVERFLOW")
    if resume:
        marker = json.loads((plan_path.parent / "m5-verified-resume.json").read_text(encoding="utf-8"))
        if not checkpoint or marker.get("source_run") != 38062405623 or marker.get("source_artifact_id") != 11674007334 or marker.get("scene_count") != 5 or marker.get("publication_authorized") is not False:
            raise RuntimeError("M5_RESUME_MARKER_INVALID")
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
        if (manifest.get("voice"), manifest.get("rate"), manifest.get("engine")) != (voice, rate, "edge-tts") or len(manifest.get("scenes", [])) != 5:
            raise RuntimeError("M5_RESUME_MANIFEST_INVALID")
    if not safe_retry and not resume:
        manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    for scene in plan["scenes"]:
        sid = int(scene["id"])
        # Avoid consecutive Edge websocket requests overwhelming the remote service.
        if sid > 1 and not resume:
            await asyncio.sleep(2.5)
        out_path = out_dir / f"{sid:02d}.mp3"
        text = normalize_spoken_text(scene["speech_text"] if plan.get("schema_version") == 2 else scene["narration"])
        if safe_retry and sid <= len(manifest["scenes"]):
            record = manifest["scenes"][sid-1]
            actual_sha = hashlib.sha256(out_path.read_bytes()).hexdigest() if out_path.is_file() else None
            if (record.get("id") != sid or record.get("spoken_text") != text
                    or record.get("engine") != "edge-tts" or not record.get("word_boundaries")
                    or record.get("sha256") != actual_sha or not actual_sha or out_path.stat().st_size < 1000):
                raise RuntimeError(f"SAFE_TTS_RETRY_SCENE_DRIFT_{sid}")
            print(f"scene {sid:02d}: reuse verified Edge MP3 and WordBoundary", flush=True)
            continue
        if resume and sid <= 5:
            record = manifest["scenes"][sid-1]
            expected_hash = marker["files"][f"audio/{sid:02d}.mp3"]
            if record["id"] != sid or record["spoken_text"] != text or record["engine"] != "edge-tts" or not record["word_boundaries"] or not out_path.is_file() or hashlib.sha256(out_path.read_bytes()).hexdigest() != expected_hash:
                raise RuntimeError(f"M5_RESUME_SCENE_DRIFT_{sid}")
            print(f"scene {sid:02d}: verified reusable original audio", flush=True)
            continue
        engine = None
        errors = []
        boundaries = []
        try:
            max_attempts = int(os.environ.get("TAIWAN_STOCK_TTS_MAX_ATTEMPTS", "6"))
        except ValueError as error:
            raise RuntimeError("TAIWAN_STOCK_TTS_MAX_ATTEMPTS must be an integer") from error
        if max_attempts < 1 or max_attempts > 6:
            raise RuntimeError("TAIWAN_STOCK_TTS_MAX_ATTEMPTS must be between 1 and 6")
        for attempt in range(1, max_attempts + 1):
            out_path.unlink(missing_ok=True)
            attempt_diagnostic = {"scene_id": sid, "attempt": attempt, "voice": voice, "rate": rate}
            try:
                boundaries = await edge_tts_save(text, out_path, attempt_diagnostic)
                if not out_path.exists() or out_path.stat().st_size < 1000:
                    raise RuntimeError("empty or truncated Edge TTS audio")
                attempt_diagnostic["outcome"] = "success"
                save_transport_diagnostic(attempt_diagnostic)
                engine = "edge-tts"
                if attempt > 1:
                    print(f"scene {sid:02d}: Edge TTS recovered on attempt {attempt}/{max_attempts}", flush=True)
                break
            except Exception as e:
                attempt_diagnostic.setdefault("outcome", "failure")
                attempt_diagnostic["error_type"] = type(e).__name__
                save_transport_diagnostic(attempt_diagnostic)
                errors.append(f"attempt {attempt}: {type(e).__name__}: {e}")
                out_path.unlink(missing_ok=True)
                if attempt == max_attempts:
                    raise RuntimeError(
                        f"Scene {sid}: Edge TTS failed after {max_attempts} attempts; "
                        f"WordBoundary-required subtitles preserved; no unsynchronized fallback. "
                        f"Last error: {type(e).__name__}: {e}"
                    ) from e
                delay = min(35, 3 ** attempt + random.uniform(0, 2.0))
                print(f"scene {sid:02d}: transient Edge TTS failure attempt {attempt}/{max_attempts} "
                      f"({type(e).__name__}: {e}); retry in {delay:.1f}s", flush=True)
                await asyncio.sleep(delay)
        if not out_path.exists() or out_path.stat().st_size < 1000:
            raise RuntimeError(f"TTS output invalid for scene {sid}: {out_path}")
        print(f"scene {sid:02d}: {engine} -> {out_path} ({out_path.stat().st_size} bytes)")
        manifest["engine"] = manifest["engine"] or engine
        manifest["scenes"].append({"id": sid, "engine": engine, "file": str(out_path), "errors": errors, "spoken_text": text, "word_boundaries": boundaries,
                                   "sha256": hashlib.sha256(out_path.read_bytes()).hexdigest()})
        # Per-scene checkpoint remains local to this isolated Render-only runner.
        # Prior successful scenes are reused only after SHA, transcript, voice and boundary checks.
        manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

asyncio.run(main())
