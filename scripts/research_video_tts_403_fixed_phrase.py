#!/usr/bin/env python3
"""Isolated fixed-phrase Edge TTS research. Never imports or reads production scripts."""
import asyncio
import datetime
import hashlib
import importlib.metadata
import json
import platform
import sys
from pathlib import Path

TEXT = "這是一段獨立的語音連線測試。"
VOICE = "zh-TW-YunJheNeural"
RATE = "+15%"

def evaluate(audio, boundaries):
    return {"audio_bytes": len(audio), "word_boundary_count": len(boundaries),
            "mp3_sha256": hashlib.sha256(audio).hexdigest() if audio else None,
            "pass": len(audio) > 1000 and len(boundaries) > 0}

def self_test():
    assert not evaluate(b"", [])["pass"]
    assert not evaluate(b"x" * 1001, [])["pass"]
    assert not evaluate(b"", [{"text": "test"}])["pass"]
    assert evaluate(b"x" * 1001, [{"text": "test"}])["pass"]
    print("PASS: four offline fail-closed cases")

async def main():
    import edge_tts
    out = Path("output/research-video-tts-403")
    out.mkdir(parents=True, exist_ok=True)
    result = {"research_only": True, "publication_authorized": False,
              "fixed_phrase": TEXT, "voice": VOICE, "rate": RATE,
              "utc": datetime.datetime.now(datetime.timezone.utc).isoformat(),
              "python": platform.python_version(),
              "edge_tts": importlib.metadata.version("edge-tts")}
    audio = bytearray()
    boundaries = []
    try:
        comm = edge_tts.Communicate(text=TEXT, voice=VOICE, rate=RATE, boundary="WordBoundary")
        async for chunk in comm.stream():
            if chunk["type"] == "audio":
                audio.extend(chunk["data"])
            elif chunk["type"] == "WordBoundary":
                boundaries.append({"offset": chunk.get("offset"), "duration": chunk.get("duration"),
                                   "text": chunk.get("text")})
        result.update(evaluate(audio, boundaries))
        result["word_boundaries"] = boundaries
        if result["pass"]:
            (out / "fixed-phrase.mp3").write_bytes(audio)
    except Exception as error:
        result.update({"pass": False, "error_type": type(error).__name__,
                       "error_category": "EDGE_TTS_CONNECTION_OR_STREAM_FAILURE"})
    (out / "preflight.json").write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n")
    print(json.dumps({k:v for k,v in result.items() if k != "word_boundaries"}, ensure_ascii=False))
    if not result["pass"]:
        raise SystemExit("FAIL-CLOSED: fixed-phrase audio and WordBoundary not both verified")

if __name__ == "__main__":
    if sys.argv[1:] == ["--self-test"]:
        self_test()
    elif len(sys.argv) == 1:
        asyncio.run(main())
    else:
        raise SystemExit("usage: script [--self-test]")
