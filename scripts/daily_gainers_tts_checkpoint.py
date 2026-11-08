#!/usr/bin/env python3
"""Durable per-scene TTS checkpoint manifest helpers.

The manifest and audio live on a date-scoped checkpoint branch. Main retains
only the validated narration and text-only production record.
"""
import argparse
import hashlib
import json
import os
import shutil
import sys
import tempfile
from pathlib import Path

from daily_gainers_spoken_text import normalize_spoken_text

SCHEMA_VERSION = 1
PIPELINE_VERSION = "daily-gainers-tts-checkpoint-v1"


def sha256_bytes(value):
    return hashlib.sha256(value).hexdigest()


def sha256_file(path):
    return sha256_bytes(Path(path).read_bytes())


def canonical_json(value):
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode("utf-8")


def atomic_json(path, value):
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, temp_name = tempfile.mkstemp(prefix=path.name + ".", suffix=".tmp", dir=path.parent)
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as stream:
            json.dump(value, stream, ensure_ascii=False, indent=2)
            stream.write("\n")
            stream.flush()
            os.fsync(stream.fileno())
        os.replace(temp_name, path)
    except Exception:
        Path(temp_name).unlink(missing_ok=True)
        raise


def scene_text(scene):
    return normalize_spoken_text(scene.get("speech_text") or scene.get("narration") or "")


def scene_fingerprint(scene_id, text, voice, rate, engine_version):
    parts = {
        "scene_id": int(scene_id),
        "normalized_text_sha256": sha256_bytes(text.encode("utf-8")),
        "voice": voice,
        "rate": rate,
        "engine": "edge-tts",
        "engine_version": engine_version,
        "pipeline_version": PIPELINE_VERSION,
    }
    return sha256_bytes(canonical_json(parts)), parts


def boundary_valid(boundaries):
    if not isinstance(boundaries, list) or not boundaries:
        return False
    previous_offset = -1
    for item in boundaries:
        if not isinstance(item, dict) or not isinstance(item.get("text"), str) or not item["text"]:
            return False
        offset = item.get("offset")
        duration = item.get("duration")
        if not isinstance(offset, int) or not isinstance(duration, int) or offset < 0 or duration <= 0:
            return False
        if offset < previous_offset:
            return False
        previous_offset = offset
    return True


def read_script(script_path, target_date):
    raw = Path(script_path).read_bytes()
    doc = json.loads(raw)
    if doc.get("target_date") not in (None, target_date):
        raise ValueError("SCRIPT_DATE_MISMATCH")
    scenes = doc.get("scenes")
    if not isinstance(scenes, list) or not scenes:
        raise ValueError("SCRIPT_SCENES_MISSING")
    normalized = []
    seen = set()
    for index, scene in enumerate(scenes, 1):
        scene_id = int(scene.get("id", index))
        if scene_id in seen:
            raise ValueError("SCRIPT_DUPLICATE_SCENE_ID")
        seen.add(scene_id)
        spoken = scene_text(scene)
        if not spoken.strip():
            raise ValueError("SCRIPT_EMPTY_SCENE_TEXT")
        normalized.append({"id": scene_id, "position": index, "scene_type": scene.get("scene_type", ""), "text": spoken})
    expected = list(range(1, len(normalized) + 1))
    if [item["id"] for item in normalized] != expected:
        raise ValueError("SCRIPT_SCENE_ORDER_INVALID")
    return sha256_bytes(raw), normalized


def initialize(script_path, target_date, manifest_path, checkpoint_dir, voice, rate, engine_version):
    script_sha, scenes = read_script(script_path, target_date)
    manifest_path = Path(manifest_path)
    checkpoint_dir = Path(checkpoint_dir)
    existing = {}
    if manifest_path.exists():
        current = json.loads(manifest_path.read_text(encoding="utf-8"))
        if current.get("schema_version") != SCHEMA_VERSION or current.get("target_date") != target_date:
            raise ValueError("CHECKPOINT_MANIFEST_IDENTITY_INVALID")
        existing = {int(item["scene_id"]): item for item in current.get("scenes", [])}

    records = []
    for scene in scenes:
        fingerprint, identity = scene_fingerprint(scene["id"], scene["text"], voice, rate, engine_version)
        prior = existing.get(scene["id"], {})
        prior_path = checkpoint_dir / "audio" / f'{scene["id"]:02d}.mp3'
        prior_boundary = checkpoint_dir / "audio" / f'{scene["id"]:02d}.wordboundaries.json'
        reusable = (
            prior.get("fingerprint") == fingerprint
            and prior.get("status") == "success"
            and prior_path.is_file()
            and prior_boundary.is_file()
            and prior.get("audio_sha256") == sha256_file(prior_path)
            and prior.get("wordboundaries_sha256") == sha256_file(prior_boundary)
            and prior_path.stat().st_size >= 1000
            and boundary_valid(json.loads(prior_boundary.read_text(encoding="utf-8")))
        )
        records.append({
            "scene_id": scene["id"],
            "position": scene["position"],
            "scene_type": scene["scene_type"],
            "fingerprint": fingerprint,
            "identity": identity,
            "status": "success" if reusable else "pending",
            "audio_file": f'audio/{scene["id"]:02d}.mp3' if reusable else None,
            "audio_sha256": prior.get("audio_sha256") if reusable else None,
            "audio_bytes": prior.get("audio_bytes") if reusable else None,
            "wordboundaries_file": f'audio/{scene["id"]:02d}.wordboundaries.json' if reusable else None,
            "wordboundaries_sha256": prior.get("wordboundaries_sha256") if reusable else None,
            "workflow_run_id": prior.get("workflow_run_id") if reusable else None,
            "updated_at": prior.get("updated_at") if reusable else None,
        })
    manifest = {
        "schema_version": SCHEMA_VERSION,
        "pipeline_version": PIPELINE_VERSION,
        "target_date": target_date,
        "script_sha256": script_sha,
        "voice": voice,
        "rate": rate,
        "engine": "edge-tts",
        "engine_version": engine_version,
        "scenes": records,
    }
    atomic_json(manifest_path, manifest)
    return manifest


def missing_scenes(manifest):
    return [item["scene_id"] for item in manifest["scenes"] if item["status"] != "success"]


def validate_checkpoint(manifest, checkpoint_dir):
    checkpoint_dir = Path(checkpoint_dir)
    failures = []
    ids = [item["scene_id"] for item in manifest.get("scenes", [])]
    if ids != list(range(1, len(ids) + 1)):
        failures.append("SCENE_COVERAGE_OR_ORDER_INVALID")
    for item in manifest.get("scenes", []):
        sid = int(item["scene_id"])
        audio = checkpoint_dir / "audio" / f"{sid:02d}.mp3"
        boundaries_file = checkpoint_dir / "audio" / f"{sid:02d}.wordboundaries.json"
        if item.get("status") != "success" or not audio.is_file() or not boundaries_file.is_file():
            failures.append(f"SCENE_{sid:02d}_MISSING")
            continue
        if audio.stat().st_size < 1000 or sha256_file(audio) != item.get("audio_sha256"):
            failures.append(f"SCENE_{sid:02d}_AUDIO_HASH_INVALID")
        try:
            boundaries = json.loads(boundaries_file.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            boundaries = None
        if sha256_file(boundaries_file) != item.get("wordboundaries_sha256") or not boundary_valid(boundaries):
            failures.append(f"SCENE_{sid:02d}_WORDBOUNDARY_INVALID")
    return failures


def record_success(manifest_path, checkpoint_dir, scene_id, audio_source, boundaries_source, run_id, generated_manifest_path):
    manifest_path = Path(manifest_path)
    checkpoint_dir = Path(checkpoint_dir)
    generated = json.loads(Path(generated_manifest_path).read_text(encoding="utf-8"))
    source_scene = next((item for item in generated.get("scenes", []) if int(item.get("id", -1)) == int(scene_id)), None)
    if source_scene is None or source_scene.get("engine") != "edge-tts":
        raise ValueError("GENERATED_SCENE_NOT_EDGE_TTS")
    boundaries = source_scene.get("word_boundaries")
    if not boundary_valid(boundaries):
        raise ValueError("GENERATED_WORDBOUNDARY_INVALID")
    audio_source = Path(audio_source)
    if not audio_source.is_file() or audio_source.stat().st_size < 1000:
        raise ValueError("GENERATED_AUDIO_INVALID")
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    target = next((item for item in manifest["scenes"] if int(item["scene_id"]) == int(scene_id)), None)
    if target is None or target.get("status") == "success":
        raise ValueError("SCENE_NOT_PENDING")
    expected_text_sha = target["identity"]["normalized_text_sha256"]
    spoken_text = source_scene.get("spoken_text")
    if not isinstance(spoken_text, str) or not spoken_text:
        raise ValueError("GENERATED_TEXT_MISSING")
    if sha256_bytes(spoken_text.encode("utf-8")) != expected_text_sha:
        raise ValueError("GENERATED_TEXT_FINGERPRINT_MISMATCH")
    if generated.get("voice") != manifest.get("voice") or generated.get("rate") != manifest.get("rate"):
        raise ValueError("GENERATED_VOICE_OR_RATE_MISMATCH")
    if source_scene.get("sha256") != sha256_file(audio_source):
        raise ValueError("GENERATED_AUDIO_HASH_MISMATCH")
    if Path(boundaries_source).is_file():
        supplied_boundaries = json.loads(Path(boundaries_source).read_text(encoding="utf-8"))
        if supplied_boundaries != boundaries:
            raise ValueError("GENERATED_WORDBOUNDARY_MISMATCH")

    audio_dir = checkpoint_dir / "audio"
    audio_dir.mkdir(parents=True, exist_ok=True)
    audio_target = audio_dir / f"{int(scene_id):02d}.mp3"
    boundary_target = audio_dir / f"{int(scene_id):02d}.wordboundaries.json"
    temp_audio = audio_target.with_suffix(".mp3.tmp")
    shutil.copyfile(audio_source, temp_audio)
    os.replace(temp_audio, audio_target)
    atomic_json(boundary_target, boundaries)
    target.update({
        "status": "success",
        "audio_file": f"audio/{int(scene_id):02d}.mp3",
        "audio_sha256": sha256_file(audio_target),
        "audio_bytes": audio_target.stat().st_size,
        "wordboundaries_file": f"audio/{int(scene_id):02d}.wordboundaries.json",
        "wordboundaries_sha256": sha256_file(boundary_target),
        "workflow_run_id": str(run_id),
        "updated_at": os.environ.get("GITHUB_RUN_STARTED_AT", ""),
    })
    atomic_json(manifest_path, manifest)
    return manifest


def make_scene_plan(script_path, target_date, scene_id, output_path):
    _, scenes = read_script(script_path, target_date)
    scene = next((item for item in scenes if item["id"] == int(scene_id)), None)
    if scene is None:
        raise ValueError("SCENE_ID_NOT_FOUND")
    source = json.loads(Path(script_path).read_text(encoding="utf-8"))
    source_scene = source["scenes"][scene["position"] - 1]
    payload = {
        "schema_version": 1,
        "target_date": target_date,
        "scenes": [{"id": int(scene_id), "narration": source_scene.get("narration") or source_scene.get("speech_text")}],
    }
    atomic_json(output_path, payload)


def cleanup_allowed(manifest, receipt):
    scenes = manifest.get("scenes", [])
    return (
        isinstance(scenes, list)
        and bool(scenes)
        and all(item.get("status") == "success" for item in scenes)
        and isinstance(receipt, dict)
        and receipt.get("status") in ("uploaded", "success", "complete")
        and receipt.get("target_date") == manifest.get("target_date")
        and receipt.get("script_sha256") == manifest.get("script_sha256")
        and receipt.get("audio_manifest_sha256") == sha256_bytes(canonical_json(manifest))
    )


def main():
    parser = argparse.ArgumentParser()
    sub = parser.add_subparsers(dest="command", required=True)
    init = sub.add_parser("init")
    init.add_argument("--script", required=True)
    init.add_argument("--date", required=True)
    init.add_argument("--manifest", required=True)
    init.add_argument("--checkpoint-dir", required=True)
    init.add_argument("--voice", required=True)
    init.add_argument("--rate", required=True)
    init.add_argument("--engine-version", required=True)
    plan = sub.add_parser("plan")
    plan.add_argument("--manifest", required=True)
    plan.add_argument("--checkpoint-dir", required=True)
    plan.add_argument("--limit", type=int, default=3)
    make = sub.add_parser("make-scene-plan")
    make.add_argument("--script", required=True)
    make.add_argument("--date", required=True)
    make.add_argument("--scene-id", type=int, required=True)
    make.add_argument("--output", required=True)
    record = sub.add_parser("record-success")
    record.add_argument("--manifest", required=True)
    record.add_argument("--checkpoint-dir", required=True)
    record.add_argument("--scene-id", type=int, required=True)
    record.add_argument("--audio", required=True)
    record.add_argument("--boundaries", required=True)
    record.add_argument("--run-id", required=True)
    record.add_argument("--generated-manifest", required=True)
    validate = sub.add_parser("validate")
    validate.add_argument("--manifest", required=True)
    validate.add_argument("--checkpoint-dir", required=True)
    cleanup = sub.add_parser("cleanup-check")
    cleanup.add_argument("--manifest", required=True)
    cleanup.add_argument("--receipt", required=True)
    args = parser.parse_args()

    if args.command == "init":
        result = initialize(args.script, args.date, args.manifest, args.checkpoint_dir, args.voice, args.rate, args.engine_version)
        print(json.dumps({"target_date": args.date, "script_sha256": result["script_sha256"], "missing_scene_ids": missing_scenes(result)}))
    elif args.command == "plan":
        manifest = json.loads(Path(args.manifest).read_text(encoding="utf-8"))
        ids = missing_scenes(manifest)[:max(0, args.limit)]
        print(json.dumps({"scene_ids": ids}))
    elif args.command == "make-scene-plan":
        make_scene_plan(args.script, args.date, args.scene_id, args.output)
    elif args.command == "record-success":
        result = record_success(args.manifest, args.checkpoint_dir, args.scene_id, args.audio, args.boundaries, args.run_id, args.generated_manifest)
        print(json.dumps({"recorded_scene": args.scene_id, "script_sha256": result["script_sha256"]}))
    elif args.command == "validate":
        manifest = json.loads(Path(args.manifest).read_text(encoding="utf-8"))
        failures = validate_checkpoint(manifest, args.checkpoint_dir)
        if failures:
            print(json.dumps({"status": "FAIL", "failures": failures}), file=sys.stderr)
            raise SystemExit(1)
        print(json.dumps({"status": "PASS", "scene_count": len(manifest["scenes"])}))
    else:
        manifest = json.loads(Path(args.manifest).read_text(encoding="utf-8"))
        receipt = json.loads(Path(args.receipt).read_text(encoding="utf-8"))
        if not cleanup_allowed(manifest, receipt):
            raise SystemExit("CLEANUP_RECEIPT_MISMATCH")
        print(json.dumps({"status": "CLEANUP_ELIGIBLE", "target_date": manifest["target_date"]}))


if __name__ == "__main__":
    main()
