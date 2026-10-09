#!/usr/bin/env python3
import json, re, sys
from pathlib import Path

from mutagen.mp3 import MP3
from pypinyin import Style, pinyin
from daily_gainers_spoken_text import normalize_spoken_text

if len(sys.argv) < 2:
    print("Usage: python scripts/build_daily_gainers_lipsync.py <plan.json>", file=sys.stderr)
    sys.exit(1)

plan_path = Path(sys.argv[1]).resolve()
if not plan_path.exists():
    raise FileNotFoundError(f"Missing plan: {plan_path}")

plan = json.loads(plan_path.read_text(encoding="utf-8"))
audio_dir = plan_path.parent / "audio"
out_path = plan_path.parent / "lipsync.json"

PAUSE_PUNCT = set("，。！？；：,.!?;:")
LIGHT_PUNCT = set("、（）()「」『』【】[]—-")
ROUND_FINALS = ("o", "ou", "ong", "uo", "u", "ue", "un")
WIDE_FINALS = ("a", "ai", "ao", "an", "ang", "ia", "iao", "ian", "iang", "ua", "uai", "uan", "uang")

def classify_char(ch):
    if ch.isspace():
        return "closed", 0.2
    if ch in PAUSE_PUNCT:
        return "closed", 0.72 if ch in "。！？!?;" else 0.46
    if ch in LIGHT_PUNCT:
        return "closed", 0.24
    if re.match(r"[A-Za-z0-9%+./]", ch):
        return "small", 1.0

    readings = pinyin(ch, style=Style.FINALS, strict=False, errors=lambda _: [""])
    final = (readings[0][0] if readings and readings[0] else "").lower()
    if any(final.startswith(x) or final.endswith(x) for x in ROUND_FINALS):
        return "o", 1.0
    if any(final.startswith(x) or final.endswith(x) for x in WIDE_FINALS):
        return "wide", 1.0
    return "small", 1.0

def merge_intervals(intervals):
    merged = []
    for item in intervals:
        if item["end"] <= item["start"]:
            continue
        if merged and merged[-1]["shape"] == item["shape"] and abs(merged[-1]["end"] - item["start"]) < 0.002:
            merged[-1]["end"] = item["end"]
        else:
            merged.append(dict(item))
    return merged

scenes = []
for scene in plan.get("scenes", []):
    sid = int(scene["id"])
    audio_path = audio_dir / f"{sid:02d}.mp3"
    if not audio_path.exists():
        raise FileNotFoundError(f"Missing audio: {audio_path}")
    duration = float(MP3(audio_path).info.length)
    if duration <= 0:
        raise RuntimeError(f"Invalid audio duration: {audio_path}")

    text = normalize_spoken_text(scene.get("speech_text") if plan.get("schema_version") == 2 else scene.get("narration"))
    units = []
    for ch in text:
        shape, weight = classify_char(ch)
        units.append((ch, shape, weight))

    if not units:
        scenes.append({"id": sid, "duration_seconds": round(duration, 3), "intervals": []})
        continue

    total_weight = sum(weight for _, _, weight in units) or 1.0
    cursor = 0.0
    intervals = []
    for index, (_, shape, weight) in enumerate(units):
        allocated = duration * (weight / total_weight)
        start = cursor
        end = duration if index == len(units) - 1 else min(duration, cursor + allocated)
        intervals.append({"shape": shape, "start": round(start, 3), "end": round(end, 3)})
        cursor = end

    intervals = merge_intervals(intervals)
    scenes.append({
        "id": sid,
        "duration_seconds": round(duration, 3),
        "interval_count": len(intervals),
        "intervals": intervals,
    })

manifest = {
    "schema_version": 1,
    "methodology": "text-pinyin-final-v1",
    "target_date": plan["target_date"],
    "mouth_shapes": ["closed", "small", "wide", "o"],
    "presenter_asset": "assets/daily-gainers-vtuber-sprite.webp",
    "mouth_patch_origin": {"x": 150, "y": 120, "source_width": 330, "source_height": 440},
    "scenes": scenes,
}
out_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
print(json.dumps({
    "target_date": manifest["target_date"],
    "methodology": manifest["methodology"],
    "scene_count": len(scenes),
    "interval_count": sum(len(s.get("intervals", [])) for s in scenes),
    "file": str(out_path),
}, ensure_ascii=False, indent=2))
