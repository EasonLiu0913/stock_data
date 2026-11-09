/Users/eason/.zlogin:7: nice(5) failed: operation not permitted
#!/usr/bin/env python3
"""Production Fish Audio timestamped synthesizer for one frozen narration scene.

This performs exactly one API request and writes the same MP3/WordBoundary
contract consumed by the date-scoped checkpoint workflow. It has no fallback.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
from pathlib import Path
import subprocess
import sys
import urllib.error
import urllib.request

SCRIPT_DIR = Path(__file__).resolve().parent
if str(SCRIPT_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPT_DIR))

from daily_gainers_spoken_text import normalize_spoken_text
from fish_audio_timestamp_stream import (
    ENDPOINT,
    MODEL,
    REFERENCE_ID,
    SPEED,
    FishStreamError,
    build_global_timeline,
    parse_sse_events,
    timeline_to_word_boundaries,
    validate_alignment,
    write_failure_diagnostic,
)

PARSER_VERSION = "fish-audio-timestamp-stream-v1"
PIPELINE_VERSION = "daily-gainers-fish-tts-v1"
SAMPLE_RATE = 44100
MP3_BITRATE = 128
VOICE = f"fish:{REFERENCE_ID}"
RATE = str(SPEED)


def provider_identity() -> dict:
    return {
        "provider": "fish.audio",
        "endpoint": ENDPOINT,
        "model": MODEL,
        "reference_id": REFERENCE_ID,
        "prosody_speed": SPEED,
        "format": "mp3",
        "sample_rate": SAMPLE_RATE,
        "mp3_bitrate": MP3_BITRATE,
        "normalize": False,
        "language": "zh-TW",
        "parser_version": PARSER_VERSION,
        "pipeline_version": PIPELINE_VERSION,
    }


def load_scene(plan_path: Path, scene_id: int) -> tuple[dict, dict, str, str]:
    raw = plan_path.read_bytes()
    plan = json.loads(raw.decode("utf-8"))
    target_date = plan.get("target_date")
    if not isinstance(target_date, str) or len(target_date) != 8 or not target_date.isdigit():
        raise FishStreamError("Frozen Fish scene plan has an invalid target date")
    plan_sha = plan.get("script_sha256")
    if not isinstance(plan_sha, str) or len(plan_sha) != 64:
        raise FishStreamError("Frozen Fish scene plan omitted source script SHA-256")
    matches = [scene for scene in plan.get("scenes", []) if int(scene.get("id", -1)) == scene_id]
    if len(matches) != 1:
        raise FishStreamError("Expected exactly one target scene in the frozen Fish plan")
    scene = matches[0]
    raw_text = scene.get("narration") or scene.get("speech_text")
    if not isinstance(raw_text, str) or not raw_text.strip():
        raise FishStreamError("Frozen Fish scene narration is empty")
    return plan, scene, raw_text, normalize_spoken_text(raw_text)


def request_tts(text: str, api_key: str) -> tuple[bytes, dict[int, dict], str]:
    payload = {
        "text": text,
        "reference_id": REFERENCE_ID,
        "prosody": {"speed": SPEED},
        "format": "mp3",
        "sample_rate": SAMPLE_RATE,
        "mp3_bitrate": MP3_BITRATE,
        "normalize": False,
        "language": "zh-TW",
        "latency": "normal",
    }
    request = urllib.request.Request(
        ENDPOINT,
        data=json.dumps(payload, ensure_ascii=False).encode("utf-8"),
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
            "model": MODEL,
            "Accept": "text/event-stream",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=180) as response:
            content_type = response.headers.get("Content-Type", "").split(";", 1)[0].strip().lower()
            if response.status != 200 or content_type != "text/event-stream":
                raise FishStreamError("Fish Audio response did not match the HTTP 200 SSE contract")
            audio, alignments = parse_sse_events(response)
            return audio, alignments, content_type
    except urllib.error.HTTPError as error:
        raise FishStreamError(f"Fish Audio HTTP request failed with status {error.code}") from error
    except urllib.error.URLError as error:
        raise FishStreamError(f"Fish Audio transport failed ({type(error.reason).__name__})") from error


def probe_mp3(audio_path: Path) -> dict:
    result = subprocess.run(
        [
            "ffprobe", "-v", "error", "-show_entries",
            "stream=codec_type,codec_name,sample_rate,channels,bit_rate:format=duration",
            "-of", "json", str(audio_path),
        ],
        check=True,
        capture_output=True,
        text=True,
    )
    try:
        report = json.loads(result.stdout)
        audio_streams = [stream for stream in report.get("streams", []) if stream.get("codec_type") == "audio"]
        stream = audio_streams[0]
        duration = float(report["format"]["duration"])
        sample_rate = int(stream["sample_rate"])
        channels = int(stream["channels"])
        bitrate = int(stream["bit_rate"])
    except (KeyError, IndexError, TypeError, ValueError, json.JSONDecodeError) as error:
        raise FishStreamError("Fish MP3 probe returned incomplete media metadata") from error
    if stream.get("codec_name") != "mp3":
        raise FishStreamError("Fish Audio output is not MP3")
    if sample_rate != SAMPLE_RATE or channels != 1 or bitrate != MP3_BITRATE * 1000:
        raise FishStreamError("Fish MP3 does not match the pinned mono 44.1kHz/128kbps format")
    if not duration > 0:
        raise FishStreamError("Fish MP3 duration must be positive")
    return {
        "codec": stream["codec_name"],
        "sample_rate": sample_rate,
        "channels": channels,
        "bitrate": bitrate,
        "duration_seconds": duration,
    }


def _run(plan_path: Path, scene_id: int) -> dict:
    api_key = os.environ.get("FISH_API_KEY", "")
    if not api_key:
        raise FishStreamError("FISH_API_KEY is not configured")
    plan, scene, raw_text, spoken_text = load_scene(plan_path, scene_id)

    # Exactly one request. Failures are surfaced for diagnosis, never rerouted to Edge.
    audio, alignments, content_type = request_tts(spoken_text, api_key)
    if len(audio) < 1024:
        raise FishStreamError("Fish Audio returned an empty or truncated audio stream")
    timeline = build_global_timeline(alignments)
    coverage = validate_alignment(spoken_text, timeline, alignments)

    out_dir = plan_path.parent / "audio"
    out_dir.mkdir(parents=True, exist_ok=True)
    audio_path = out_dir / f"{scene_id:02d}.mp3"
    audio_path.write_bytes(audio)
    audio_probe = probe_mp3(audio_path)
    boundaries = timeline_to_word_boundaries(timeline, audio_probe["duration_seconds"])
    identity = provider_identity()
    scene_doc = {
        "id": scene_id,
        "engine": "fish.audio",
        "file": str(audio_path),
        "spoken_text": spoken_text,
        "word_boundaries": boundaries,
        "sha256": hashlib.sha256(audio).hexdigest(),
        "alignment_coverage": round(coverage, 6),
    }
    generated = {
        "schema_version": 1,
        "engine": "fish.audio",
        "provider_identity": identity,
        "pipeline_version": PIPELINE_VERSION,
        "target_date": plan["target_date"],
        "plan_sha256": plan["script_sha256"],
        "voice": VOICE,
        "rate": RATE,
        "audio_probe": audio_probe,
        "scenes": [scene_doc],
    }
    (plan_path.parent / "boundaries.json").write_text(
        json.dumps(boundaries, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    (plan_path.parent / "tts-manifest.json").write_text(
        json.dumps(generated, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    (plan_path.parent / "tts-transport-diagnostics.json").write_text(
        json.dumps({
            "provider": "fish.audio",
            "model": MODEL,
            "target_date": plan["target_date"],
            "scene_id": scene_id,
            "status": "success",
            "http_content_type": content_type,
            "audio_bytes": len(audio),
            "audio_sha256": scene_doc["sha256"],
            "audio_probe": audio_probe,
            "alignment_chunks": len(alignments),
            "alignment_coverage": round(coverage, 6),
        }, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    (plan_path.parent / "fish-alignment.json").write_text(
        json.dumps({
            "provider": "fish.audio",
            "target_date": plan["target_date"],
            "scene_id": scene_id,
            "plan_sha256": plan["script_sha256"],
            "raw_text_sha256": hashlib.sha256(raw_text.encode("utf-8")).hexdigest(),
            "spoken_text_sha256": hashlib.sha256(spoken_text.encode("utf-8")).hexdigest(),
            "alignment_chunks": len(alignments),
            "alignment_coverage": round(coverage, 6),
            "timeline": timeline,
        }, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    print(json.dumps({
        "provider": "fish.audio",
        "model": MODEL,
        "reference_id": REFERENCE_ID,
        "prosody_speed": SPEED,
        "target_date": plan["target_date"],
        "scene_id": scene_id,
        "audio_bytes": len(audio),
        "audio_sha256": scene_doc["sha256"],
        "alignment_coverage": round(coverage, 6),
        "content_type": content_type,
    }, ensure_ascii=False))
    return generated


def run(plan_path: Path, scene_id: int) -> dict:
    try:
        return _run(plan_path, scene_id)
    except FishStreamError as error:
        diagnostic_path = write_failure_diagnostic(
            plan_path.parent,
            scene_id=scene_id,
            error=error,
        )
        print(json.dumps({
            "provider": "fish.audio",
            "status": "failure",
            "scene_id": scene_id,
            "error_code": error.code,
            "diagnostic_path": str(diagnostic_path),
        }, ensure_ascii=False), file=sys.stderr)
        raise


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--plan", type=Path)
    parser.add_argument("--scene-id", type=int)
    parser.add_argument("--write-provider-identity", type=Path)
    args = parser.parse_args()
    if args.write_provider_identity is not None:
        args.write_provider_identity.parent.mkdir(parents=True, exist_ok=True)
        args.write_provider_identity.write_text(
            json.dumps(provider_identity(), ensure_ascii=False, indent=2) + "\n",
            encoding="utf-8",
        )
        return
    if args.plan is None or args.scene_id is None:
        parser.error("--plan and --scene-id are required unless --write-provider-identity is used")
    run(args.plan, args.scene_id)


if __name__ == "__main__":
    main()
