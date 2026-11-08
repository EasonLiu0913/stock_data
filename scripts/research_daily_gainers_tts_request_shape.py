#!/usr/bin/env python3
"""Bounded TTS-only comparison: one combined MP3 versus ten MP3 outputs."""
from __future__ import annotations

import argparse
import asyncio
from datetime import datetime, timezone
import hashlib
import json
from pathlib import Path
import time

from daily_gainers_spoken_text import normalize_spoken_text
from tts_request_shape_transport import (
    RequestBudget,
    RequestCapExceeded,
    RequestShapeObservation,
    observe,
)

EXPECTED_SOURCE_BLOB = "f690c703058a4367ac1f619dd786d61f9d55eab0"
VOICE = "zh-TW-YunJheNeural"
RATE = "+15%"
HARD_CONNECTION_CAP = 15
TEN_OUTPUT_COUNT = 10
INTERNAL_GAP_SECONDS = 2.5
VARIANT_GAP_SECONDS = 15.0


def git_blob_sha(data: bytes) -> str:
    return hashlib.sha1(f"blob {len(data)}\0".encode("ascii") + data).hexdigest()


def scene_narrations(candidate: dict) -> list[str]:
    scenes = candidate.get("scenes")
    if not isinstance(scenes, list):
        raise ValueError("candidate scenes must be an array")
    narrations = [normalize_spoken_text(str(scene.get("narration", "")).strip()) for scene in scenes]
    if not narrations or any(not text for text in narrations):
        raise ValueError("candidate must contain non-empty narration for every scene")
    return narrations


def combined_narration(narrations: list[str]) -> str:
    return "\n\n".join(narrations)


def partition_narrations(narrations: list[str], parts: int = TEN_OUTPUT_COUNT) -> list[str]:
    if parts <= 0 or parts > len(narrations):
        raise ValueError("parts must be between 1 and the number of scenes")
    groups = []
    count = len(narrations)
    for index in range(parts):
        start = index * count // parts
        end = (index + 1) * count // parts
        group = narrations[start:end]
        if not group:
            raise ValueError("partition produced an empty group")
        groups.append("\n\n".join(group))
    return groups


def validate_expected_request_count(expected: int, limit: int = HARD_CONNECTION_CAP) -> bool:
    if expected < 0 or limit <= 0:
        raise ValueError("request counts and limits must be non-negative/positive")
    return expected <= limit


def expected_connections(edge_tts, text: str) -> int:
    communicate = edge_tts.Communicate(text=text, voice=VOICE, rate=RATE, boundary="WordBoundary")
    return len(communicate.texts)


def _utc_now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="milliseconds").replace("+00:00", "Z")


async def synthesize_one(edge_tts, communicate_module, label, text, output_path, budget):
    observation = RequestShapeObservation(budget)
    expected = expected_connections(edge_tts, text)
    record = {
        "label": label,
        "started_at_utc": _utc_now(),
        "input_utf8_bytes": len(text.encode("utf-8")),
        "input_sha256": hashlib.sha256(text.encode("utf-8")).hexdigest(),
        "expected_connections_from_edge_tts_split": expected,
        "outcome": "pending",
        "error_type": None,
        "audio_bytes": 0,
        "word_boundary_count": 0,
    }
    if budget.used + expected > budget.limit:
        record.update(outcome="skipped_preflight_connection_cap", error_type="RequestCapExceeded")
        return record

    boundaries = 0
    audio_bytes = 0
    output_path.parent.mkdir(parents=True, exist_ok=True)
    try:
        communicate = edge_tts.Communicate(text=text, voice=VOICE, rate=RATE, boundary="WordBoundary")
        with output_path.open("wb") as audio:
            with observe(communicate_module, observation):
                async for chunk in communicate.stream():
                    if chunk.get("type") == "audio":
                        audio.write(chunk["data"])
                        audio_bytes += len(chunk["data"])
                        observation.audio_bytes += len(chunk["data"])
                    elif chunk.get("type") == "WordBoundary":
                        boundaries += 1
                        observation.word_boundary_count += 1
        record["outcome"] = "success" if audio_bytes > 0 and boundaries > 0 else "incomplete_audio_or_boundaries"
    except RequestCapExceeded as error:
        record["outcome"] = "failed_connection_cap"
        record["error_type"] = type(error).__name__
    except Exception as error:
        record["outcome"] = "failed_tts"
        record["error_type"] = type(error).__name__
    record["finished_at_utc"] = _utc_now()
    record["audio_bytes"] = audio_bytes
    record["word_boundary_count"] = boundaries
    record["transport"] = observation.as_dict()
    if output_path.exists():
        record["output_file"] = str(output_path)
    return record


async def run(source_path: Path, output_dir: Path) -> dict:
    import edge_tts
    import edge_tts.communicate as communicate_module

    if edge_tts.__version__ != "7.3.1":
        raise RuntimeError(f"expected edge-tts 7.3.1, got {edge_tts.__version__}")
    raw = source_path.read_bytes()
    source_blob = git_blob_sha(raw)
    if source_blob != EXPECTED_SOURCE_BLOB:
        raise RuntimeError(f"candidate identity mismatch: expected {EXPECTED_SOURCE_BLOB}, got {source_blob}")
    narrations = scene_narrations(json.loads(raw))
    one_text = combined_narration(narrations)
    ten_texts = partition_narrations(narrations)
    one_expected = expected_connections(edge_tts, one_text)
    ten_expected = sum(expected_connections(edge_tts, text) for text in ten_texts)
    expected_total = one_expected + ten_expected
    report = {
        "schema_version": 1,
        "experiment": "20261104-one-mp3-vs-ten-mp3-tts-request-shape",
        "started_at_utc": _utc_now(),
        "source_path": source_path.as_posix(),
        "source_blob_sha": source_blob,
        "source_scene_count": len(narrations),
        "source_narration_codepoints": sum(len(text) for text in narrations),
        "source_narration_utf8_bytes": len(one_text.encode("utf-8")),
        "voice": VOICE,
        "rate": RATE,
        "edge_tts_version": edge_tts.__version__,
        "concurrency": 1,
        "client_retry_count": 0,
        "hard_websocket_connection_cap": HARD_CONNECTION_CAP,
        "pacing_seconds": {
            "within_ten_output_variant": INTERNAL_GAP_SECONDS,
            "between_variants": VARIANT_GAP_SECONDS,
        },
        "preflight": {
            "single_mp3_expected_connections": one_expected,
            "ten_mp3_expected_connections": ten_expected,
            "total_expected_connections": expected_total,
        },
        "variants": {},
        "experiment_outcome": "pending",
    }
    output_dir.mkdir(parents=True, exist_ok=True)
    audio_dir = output_dir / "audio"
    if not validate_expected_request_count(expected_total):
        report["experiment_outcome"] = "blocked_preflight_connection_cap"
        report["finished_at_utc"] = _utc_now()
        (output_dir / "diagnostic.json").write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        return report

    budget = RequestBudget(HARD_CONNECTION_CAP)
    one_record = await synthesize_one(
        edge_tts, communicate_module, "single_mp3", one_text, audio_dir / "single.mp3", budget
    )
    report["variants"]["single_mp3"] = {
        "outputs_expected": 1,
        "outcomes": [one_record],
        "synthesis_successes": int(one_record["outcome"] == "success"),
        "websocket_connections_used": budget.used,
    }
    await asyncio.sleep(VARIANT_GAP_SECONDS)

    ten_records = []
    for index, text in enumerate(ten_texts, start=1):
        ten_records.append(await synthesize_one(
            edge_tts, communicate_module, f"ten_mp3_{index:02d}", text,
            audio_dir / f"segment-{index:02d}.mp3", budget
        ))
        if index < len(ten_texts):
            await asyncio.sleep(INTERNAL_GAP_SECONDS)
    report["variants"]["ten_mp3"] = {
        "outputs_expected": TEN_OUTPUT_COUNT,
        "outcomes": ten_records,
        "synthesis_successes": sum(item["outcome"] == "success" for item in ten_records),
        "websocket_connections_used": budget.used - report["variants"]["single_mp3"]["websocket_connections_used"],
    }

    connections = []
    for variant in report["variants"].values():
        for item in variant["outcomes"]:
            transport = item.get("transport") or {}
            connections.extend(transport.get("websocket_connection_attempts", []))
    connections.sort(key=lambda item: item["global_ordinal"])
    for previous, current in zip(connections, connections[1:]):
        current["gap_from_previous_connection_ms"] = (
            current["elapsed_since_experiment_start_ms"] - previous["elapsed_since_experiment_start_ms"]
        )
    report["connection_summary"] = {
        "actual_websocket_connection_attempts": budget.used,
        "hard_cap_respected": budget.used <= HARD_CONNECTION_CAP,
        "attempts": connections,
    }
    report["experiment_outcome"] = "diagnostics_completed"
    report["finished_at_utc"] = _utc_now()
    (output_dir / "diagnostic.json").write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return report


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--source", default="research_pending/daily-gainers-video-scripts/20261104.json")
    parser.add_argument("--output", default="tts-request-shape-output")
    args = parser.parse_args()
    report = asyncio.run(run(Path(args.source), Path(args.output)))
    print(json.dumps({
        "experiment_outcome": report["experiment_outcome"],
        "source_blob_sha": report.get("source_blob_sha"),
        "preflight": report.get("preflight"),
        "connection_summary": {
            "actual_websocket_connection_attempts": report.get("connection_summary", {}).get("actual_websocket_connection_attempts"),
            "hard_cap_respected": report.get("connection_summary", {}).get("hard_cap_respected"),
        },
        "diagnostic_path": str(Path(args.output) / "diagnostic.json"),
    }, ensure_ascii=False), flush=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
