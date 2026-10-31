#!/usr/bin/env python3
"""Research-only 20261008 scene-1 genuine YunJhe voice pilot.

Never uploads, publishes, modifies source narration or fabricates WordBoundary.
Runs only in isolated GitHub Actions. A missing required segment fails closed.
"""
import asyncio
import hashlib
import json
import os
import sys
import tempfile
from pathlib import Path

from daily_gainers_spoken_text import normalize_spoken_text
from daily_gainers_tts_segments import split_spoken_text
from daily_gainers_tts_audio_join import join_verified_mp3
from daily_gainers_subtitle_alignment import align_cues

VOICE = "zh-TW-YunJheNeural"
RATE = "+15%"
DATE = "20261008"
BRAND = (
    "大家好，歡迎來到 TAIWAN STOCK！",
    "追蹤資金，解讀行情。",
    "錢在哪，我們就在哪！",
    "那麼我們開始囉。",
)


def source_segments(source):
    if source.get("target_date") != DATE or source.get("privacy_status") != "private":
        raise ValueError("Golden input date or privacy mismatch")
    scenes = source.get("scenes")
    if not isinstance(scenes, list) or not scenes or not scenes[0].get("narration"):
        raise ValueError("Missing Golden opening narration")
    narration = normalize_spoken_text(scenes[0]["narration"])
    narration_parts = split_spoken_text(narration, 100)
    # Preserve the actual interlude newline from the frozen V4 upgraded script.
    chunks = list(BRAND) + ["\n" + narration_parts[0]] + narration_parts[1:]
    expected = "".join(BRAND) + "\n" + narration
    if "".join(chunks) != expected or chunks[3] != BRAND[3]:
        raise ValueError("Frozen four-line speech drift")
    return chunks, expected


async def synthesize_segment(text, destination):
    import edge_tts
    stream = edge_tts.Communicate(text=text, voice=VOICE, rate=RATE,
                                  boundary="WordBoundary")
    boundaries = []
    with destination.open("wb") as fh:
        async for event in stream.stream():
            if event["type"] == "audio":
                fh.write(event["data"])
            elif event["type"] == "WordBoundary":
                boundaries.append({key: event[key] for key in
                                   ("text", "offset", "duration")})
    if destination.stat().st_size < 1000 or not boundaries:
        raise RuntimeError("Missing actual Edge voice audio or WordBoundary")
    return boundaries


async def main():
    if len(sys.argv) != 2:
        raise SystemExit("Usage: pilot.py video_scripts/daily-gainers/20261008.json")
    script = json.loads(Path(sys.argv[1]).read_text(encoding="utf-8"))
    chunks, expected = source_segments(script)
    with tempfile.TemporaryDirectory(prefix="mvp10-scene1-") as temp:
        root = Path(temp)
        parts = []
        for index, chunk in enumerate(chunks, 1):
            path = root / f"{index:02}.mp3"
            try:
                boundaries = await asyncio.wait_for(
                    synthesize_segment(chunk, path), timeout=65)
            except Exception as exc:
                # Never print the full narration, never silently substitute text.
                print(f"SCENE1_PILOT segment={index}/{len(chunks)} "
                      f"status=BLOCKED error_type={type(exc).__name__} "
                      f"voice={VOICE} word_boundaries_required=true", flush=True)
                raise SystemExit(2) from exc
            parts.append((path, boundaries))
            print(f"SCENE1_PILOT segment={index}/{len(chunks)} status=PASS "
                  f"audio_bytes={path.stat().st_size} word_boundaries={len(boundaries)}",
                  flush=True)
        joined = root / "scene-01-joined.mp3"
        joined_meta = join_verified_mp3(parts, joined)
        # Alignment checks the genuine Edge text coverage across the entire scene.
        align_cues([expected], lambda x: x, joined_meta["word_boundaries"],
                   joined_meta["duration_seconds"])
        audit = {
            "date": DATE, "voice": VOICE, "rate": RATE,
            "segments": len(parts), "word_boundaries": len(joined_meta["word_boundaries"]),
            "audio_seconds": joined_meta["duration_seconds"],
            "speech_sha256": hashlib.sha256(expected.encode("utf-8")).hexdigest(),
            "mp3_sha256": hashlib.sha256(joined.read_bytes()).hexdigest(),
            "verification": "actual Edge audio + WordBoundary + ffprobe + full text alignment",
            "publication_authorized": False,
        }
        print("SCENE1_PILOT status=PASS " + json.dumps(audit, ensure_ascii=False),
              flush=True)


if __name__ == "__main__":
    asyncio.run(main())
