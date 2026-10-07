#!/usr/bin/env python3
import json, re, sys
from pathlib import Path
from mutagen.mp3 import MP3

if len(sys.argv) < 2:
    print("Usage: python scripts/build_daily_gainers_srt.py <plan.json>", file=sys.stderr)
    sys.exit(1)

plan_path = Path(sys.argv[1]).resolve()
if not plan_path.exists():
    raise FileNotFoundError(f"Missing plan: {plan_path}")

plan = json.loads(plan_path.read_text(encoding="utf-8"))
audio_dir = plan_path.parent / "audio"
out_path = plan_path.parent / f"daily-gainers-{plan['target_date']}.zh-TW.srt"

PUNCT = set("，。！？、；：,.!?;:")

def split_text(text, max_chars=24):
    normalized = re.sub(r"\s+", " ", str(text or "")).strip()
    if not normalized:
        return []
    sentences = re.findall(r"[^。！？!?；;]+[。！？!?；;]?", normalized) or [normalized]
    chunks = []
    for raw in sentences:
        sentence = raw.strip()
        while len(sentence) > max_chars:
            cut = min(max_chars, len(sentence))
            floor = max(8, int(max_chars * 0.55))
            for i in range(cut, floor - 1, -1):
                if sentence[i - 1] in "，、：,: ":
                    cut = i
                    break
            chunks.append(sentence[:cut].strip())
            sentence = sentence[cut:].strip()
        if sentence:
            chunks.append(sentence)
    return [c for c in chunks if c]

def fmt_srt(seconds):
    ms = max(0, round(seconds * 1000))
    h, rem = divmod(ms, 3_600_000)
    m, rem = divmod(rem, 60_000)
    s, z = divmod(rem, 1000)
    return f"{h:02d}:{m:02d}:{s:02d},{z:03d}"

cursor = 0.0
cue_no = 1
blocks = []
scene_timing = []

for scene in plan.get("scenes", []):
    sid = int(scene["id"])
    audio_path = audio_dir / f"{sid:02d}.mp3"
    if not audio_path.exists():
        raise FileNotFoundError(f"Missing audio: {audio_path}")
    duration = float(MP3(audio_path).info.length)
    if duration <= 0:
        raise RuntimeError(f"Invalid audio duration: {audio_path}")

    chunks = split_text(scene.get("narration"))
    if not chunks:
        cursor += duration + 0.15
        continue

    weights = [
        max(1, sum(1 for ch in chunk if (not ch.isspace() and ch not in PUNCT)))
        for chunk in chunks
    ]
    total_weight = sum(weights)
    local = cursor

    for i, chunk in enumerate(chunks):
        remaining_duration = cursor + duration - local
        remaining_cues = len(chunks) - i
        allocated = duration * (weights[i] / total_weight)
        min_duration = min(1.2, remaining_duration / remaining_cues)
        allocated = max(min_duration, allocated)
        if i == len(chunks) - 1 or local + allocated > cursor + duration:
            allocated = cursor + duration - local

        start = local
        end = max(start + 0.25, local + allocated)
        blocks.append(
            f"{cue_no}\n{fmt_srt(start)} --> {fmt_srt(end)}\n{chunk}\n"
        )
        cue_no += 1
        local = end

    scene_timing.append({
        "id": sid,
        "start_seconds": round(cursor, 3),
        "duration_seconds": round(duration, 3),
        "cue_count": len(chunks),
    })
    cursor += duration + 0.15

out_path.write_text("\n".join(blocks) + "\n", encoding="utf-8")
manifest = {
    "schema_version": 1,
    "target_date": plan["target_date"],
    "language": "zh-TW",
    "source": "scene narration + exact synthesized MP3 durations",
    "cue_count": cue_no - 1,
    "duration_seconds": round(cursor, 3),
    "subtitle_file": out_path.name,
    "scenes": scene_timing,
}
(plan_path.parent / "subtitle-manifest.json").write_text(
    json.dumps(manifest, ensure_ascii=False, indent=2) + "\n",
    encoding="utf-8",
)
print(json.dumps(manifest, ensure_ascii=False, indent=2))
