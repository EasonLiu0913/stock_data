#!/usr/bin/env python3
"""Research-only MP3 join validation; does NOT generate or replace narration.

Uses real source MP3 durations and actual Edge WordBoundary events supplied by
caller. Test tones are allowed in offline tests, never as production speech.
"""
import json
import math
import subprocess
from pathlib import Path

from daily_gainers_tts_segments import combine_word_boundaries


def _probe_duration(path):
    path = Path(path)
    if not path.is_file() or path.stat().st_size < 100:
        raise ValueError("Missing or empty MP3 segment")
    proc = subprocess.run(
        ["ffprobe", "-v", "error", "-select_streams", "a:0",
         "-show_entries", "stream=codec_name:format=duration",
         "-of", "json", str(path)],
        capture_output=True, text=True, check=True)
    payload = json.loads(proc.stdout)
    streams = payload.get("streams") or []
    if len(streams) != 1 or streams[0].get("codec_name") != "mp3":
        raise ValueError("Audio segment must contain MP3")
    duration = float(payload.get("format", {}).get("duration", 0))
    if not math.isfinite(duration) or duration <= 0:
        raise ValueError("Invalid measured audio duration")
    return duration


def join_verified_mp3(parts, output, tolerance_seconds=0.085):
    """Join ordered (mp3_path, genuine WordBoundary-list) pairs.

    Re-encode through ffmpeg concat filter to handle independent MP3 frame
    boundaries. Measured merged duration must agree with source duration sum.
    Returns metadata only after validating the MP3. No text substitutions.
    """
    if not parts or len(parts) > 200:
        raise ValueError("Invalid segment count")
    output = Path(output)
    paths = [Path(p) for p, _ in parts]
    if output in paths or len(set(paths)) != len(paths):
        raise ValueError("Output aliases or duplicates an input")
    durations = [_probe_duration(p) for p in paths]
    boundaries, expected = combine_word_boundaries(
        [(duration, b) for duration, (_, b) in zip(durations, parts)])
    if not 0 < tolerance_seconds <= 0.085:
        raise ValueError("Invalid timing tolerance")
    output.parent.mkdir(parents=True, exist_ok=True)
    temp = output.with_name(output.name + ".joining.mp3")
    temp.unlink(missing_ok=True)
    cmd = ["ffmpeg", "-nostdin", "-hide_banner", "-loglevel", "error", "-y"]
    for path in paths:
        cmd.extend(["-i", str(path)])
    filters = "".join(f"[{i}:a:0]" for i in range(len(parts)))
    filters += f"concat=n={len(parts)}:v=0:a=1[out]"
    cmd.extend(["-filter_complex", filters, "-map", "[out]",
                "-c:a", "libmp3lame", "-b:a", "128k", str(temp)])
    try:
        subprocess.run(cmd, check=True, capture_output=True, text=True)
        actual = _probe_duration(temp)
        if abs(actual - expected) > tolerance_seconds:
            raise ValueError(
                f"MP3 duration mismatch: sources={expected:.6f}s output={actual:.6f}s")
        if boundaries[-1]["offset"] + boundaries[-1]["duration"] > round(
                (actual + tolerance_seconds) * 10_000_000):
            raise ValueError("WordBoundary extends beyond joined MP3")
        temp.replace(output)
    finally:
        temp.unlink(missing_ok=True)
    return {"duration_seconds": actual, "source_duration_seconds": expected,
            "segments": len(parts), "word_boundaries": boundaries}
