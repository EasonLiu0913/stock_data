#!/usr/bin/env python3
"""Fish Audio timestamped TTS transport and deterministic alignment adapter."""

from __future__ import annotations

import argparse
import base64
import difflib
import hashlib
import json
import os
import re
import sys
import unicodedata
import urllib.error
import urllib.request
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent
if str(SCRIPT_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPT_DIR))

from daily_gainers_spoken_text import normalize_spoken_text

ENDPOINT = "https://api.fish.audio/v1/tts/stream/with-timestamp"
MODEL = "s2.1-pro-free"
REFERENCE_ID = "e7af89da8abc4fbdacd9a10ab9881933"
SPEED = 1.15


class FishStreamError(RuntimeError):
    pass


def _parse_event(data_lines: list[str]) -> dict | None:
    if not data_lines:
        return None
    payload = "\n".join(data_lines)
    if payload.strip() == "[DONE]":
        return None
    try:
        event = json.loads(payload)
    except json.JSONDecodeError as error:
        raise FishStreamError("Fish Audio returned malformed SSE JSON") from error
    if not isinstance(event, dict):
        raise FishStreamError("Fish Audio SSE event must be a JSON object")
    return event


def parse_sse_events(lines) -> tuple[bytes, dict[int, dict]]:
    """Append every audio transport chunk and retain latest alignment per text chunk."""
    audio_chunks: list[bytes] = []
    alignment_by_chunk: dict[int, dict] = {}
    data_lines: list[str] = []

    def consume() -> None:
        event = _parse_event(data_lines)
        if event is None:
            return
        audio_b64 = event.get("audio_base64")
        if not isinstance(audio_b64, str):
            raise FishStreamError("Fish Audio event omitted audio_base64")
        try:
            audio_chunks.append(base64.b64decode(audio_b64, validate=True))
        except (ValueError, base64.binascii.Error) as error:
            raise FishStreamError("Fish Audio event contained invalid audio_base64") from error

        alignment = event.get("alignment")
        if alignment is None:
            return
        try:
            seq = int(event["chunk_seq"])
            offset = float(event["chunk_audio_offset_sec"])
            segments = alignment["segments"]
            duration = float(alignment["audio_duration"])
        except (KeyError, TypeError, ValueError) as error:
            raise FishStreamError("Fish Audio alignment snapshot has an invalid shape") from error
        if seq < 0 or offset < 0 or duration < 0 or not isinstance(segments, list):
            raise FishStreamError("Fish Audio alignment values are outside their valid range")
        if not isinstance(event.get("content"), str):
            raise FishStreamError("Fish Audio alignment event omitted text content")
        # API contract: snapshots are cumulative and latest-wins for each chunk_seq.
        alignment_by_chunk[seq] = {
            "content": event["content"],
            "offset": offset,
            "audio_duration": duration,
            "segments": segments,
        }

    for raw_line in lines:
        line = raw_line.decode("utf-8") if isinstance(raw_line, bytes) else str(raw_line)
        line = line.rstrip("\r\n")
        if not line:
            consume()
            data_lines = []
        elif line.startswith("data:"):
            data_lines.append(line[5:].lstrip())
    consume()
    return b"".join(audio_chunks), alignment_by_chunk


def _spoken_chars(text: str) -> str:
    return "".join(
        char for char in text
        if unicodedata.category(char)[0] in ("L", "N")
    )


def build_global_timeline(alignment_by_chunk: dict[int, dict]) -> list[dict]:
    timeline: list[dict] = []
    for seq, item in sorted(alignment_by_chunk.items()):
        previous_start = -1.0
        for segment in item["segments"]:
            if not isinstance(segment, dict) or not isinstance(segment.get("text"), str):
                raise FishStreamError("Fish Audio alignment segment has invalid text")
            try:
                local_start = float(segment["start"])
                local_end = float(segment["end"])
            except (KeyError, TypeError, ValueError) as error:
                raise FishStreamError("Fish Audio alignment segment has invalid times") from error
            if local_start < previous_start or local_start < 0 or local_end < local_start:
                raise FishStreamError("Fish Audio alignment times are not ordered")
            if local_end > item["audio_duration"] + 0.25:
                raise FishStreamError("Fish Audio alignment exceeds its chunk duration")
            previous_start = local_start
            timeline.append({
                "text": segment["text"],
                "start": round(local_start + item["offset"], 6),
                "end": round(local_end + item["offset"], 6),
                "chunk_seq": seq,
            })
    return timeline


def validate_alignment(source_text: str, timeline: list[dict], alignment_by_chunk: dict[int, dict]) -> float:
    if not timeline or not alignment_by_chunk:
        raise FishStreamError("Fish Audio returned no usable timestamp alignment")
    sequences = sorted(alignment_by_chunk)
    if sequences != list(range(sequences[-1] + 1)):
        raise FishStreamError("Fish Audio alignment chunk sequence has a gap")
    source = _spoken_chars(source_text)
    aligned = _spoken_chars("".join(item["text"] for item in timeline))
    if not source or not aligned:
        raise FishStreamError("Fish Audio text coverage is empty")
    coverage = difflib.SequenceMatcher(a=source, b=aligned, autojunk=False).ratio()
    if coverage < 0.95:
        raise FishStreamError(f"Fish Audio alignment text coverage too low: {coverage:.3f}")
    previous_end = 0.0
    for item in timeline:
        if item["start"] + 0.25 < previous_end:
            raise FishStreamError("Fish Audio global timeline is not monotonic")
        previous_end = max(previous_end, item["end"])
    return coverage


def load_scene(plan_path: Path, scene_id: int) -> tuple[str, str, str]:
    plan_bytes = plan_path.read_bytes()
    plan = json.loads(plan_bytes.decode("utf-8"))
    if plan.get("target_date") != "20261103":
        raise FishStreamError("Test accepts only the frozen 20261103 narration plan")
    matches = [scene for scene in plan.get("scenes", []) if int(scene.get("id", -1)) == scene_id]
    if len(matches) != 1:
        raise FishStreamError("Expected exactly one target scene in the frozen narration plan")
    raw_text = matches[0].get("narration")
    if not isinstance(raw_text, str) or not raw_text.strip():
        raise FishStreamError("Frozen scene narration is empty")
    return raw_text, normalize_spoken_text(raw_text), hashlib.sha256(plan_bytes).hexdigest()


def request_tts(text: str, api_key: str) -> tuple[bytes, dict[int, dict], str]:
    payload = {
        "text": text,
        "reference_id": REFERENCE_ID,
        "prosody": {"speed": SPEED},
        "format": "mp3",
        "sample_rate": 44100,
        "mp3_bitrate": 128,
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
                raise FishStreamError("Fish Audio response status/content type did not match SSE contract")
            audio, alignments = parse_sse_events(response)
            return audio, alignments, content_type
    except urllib.error.HTTPError as error:
        # Never print request headers or credentials into Actions logs.
        raise FishStreamError(f"Fish Audio HTTP request failed with status {error.code}") from error
    except urllib.error.URLError as error:
        raise FishStreamError(f"Fish Audio transport failed ({type(error.reason).__name__})") from error


def run(plan_path: Path, scene_id: int, output_dir: Path) -> dict:
    api_key = os.environ.get("FISH_API_KEY", "")
    if not api_key:
        raise FishStreamError("FISH_API_KEY is not configured")
    raw_text, spoken_text, plan_sha = load_scene(plan_path, scene_id)
    audio, alignments, content_type = request_tts(spoken_text, api_key)
    if len(audio) < 1024:
        raise FishStreamError("Fish Audio returned an empty or truncated audio stream")
    timeline = build_global_timeline(alignments)
    coverage = validate_alignment(spoken_text, timeline, alignments)
    output_dir.mkdir(parents=True, exist_ok=True)
    audio_path = output_dir / f"scene-{scene_id:02d}.mp3"
    alignment_path = output_dir / f"scene-{scene_id:02d}-alignment.json"
    audio_path.write_bytes(audio)
    alignment_doc = {
        "schema_version": 1,
        "provider": "fish.audio",
        "model": MODEL,
        "reference_id": REFERENCE_ID,
        "prosody_speed": SPEED,
        "target_date": "20261103",
        "scene_id": scene_id,
        "plan_sha256": plan_sha,
        "spoken_text_sha256": hashlib.sha256(spoken_text.encode("utf-8")).hexdigest(),
        "raw_text_sha256": hashlib.sha256(raw_text.encode("utf-8")).hexdigest(),
        "alignment_coverage": round(coverage, 6),
        "alignment_chunks": len(alignments),
        "timeline": timeline,
    }
    alignment_path.write_text(json.dumps(alignment_doc, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    manifest = {
        "schema_version": 1,
        "provider": "fish.audio",
        "endpoint": ENDPOINT,
        "model": MODEL,
        "reference_id": REFERENCE_ID,
        "prosody_speed": SPEED,
        "format": "mp3",
        "sample_rate": 44100,
        "mp3_bitrate": 128,
        "normalize": False,
        "language": "zh-TW",
        "response_content_type": content_type,
        "target_date": "20261103",
        "scene_id": scene_id,
        "plan_sha256": plan_sha,
        "spoken_text_sha256": hashlib.sha256(spoken_text.encode("utf-8")).hexdigest(),
        "audio_bytes": len(audio),
        "audio_sha256": hashlib.sha256(audio).hexdigest(),
        "alignment_sha256": hashlib.sha256(alignment_path.read_bytes()).hexdigest(),
        "alignment_coverage": round(coverage, 6),
    }
    manifest_path = output_dir / "request-manifest.json"
    manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({key: manifest[key] for key in (
        "provider", "model", "reference_id", "prosody_speed", "target_date", "scene_id",
        "audio_bytes", "audio_sha256", "alignment_coverage",
    )}, ensure_ascii=False))
    return manifest


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--plan", type=Path, required=True)
    parser.add_argument("--scene-id", type=int, default=1)
    parser.add_argument("--output-dir", type=Path, required=True)
    args = parser.parse_args()
    run(args.plan, args.scene_id, args.output_dir)


if __name__ == "__main__":
    main()
