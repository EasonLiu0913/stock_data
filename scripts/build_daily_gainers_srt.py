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

def split_long_sentence(sentence, max_chars=38, min_fragment_chars=8):
    sentence = sentence.strip()
    if len(sentence) <= max_chars:
        return [sentence]

    parts = []
    remaining = sentence
    while len(remaining) > max_chars:
        floor = max(min_fragment_chars, int(max_chars * 0.55))
        ceiling = min(len(remaining) - min_fragment_chars, max_chars)
        cut = None

        for i in range(ceiling, floor - 1, -1):
            if remaining[i - 1] in "，、：,: ":
                cut = i
                break

        if cut is None:
            # No natural punctuation point: split evenly enough that the
            # next cue never contains only a few orphaned characters.
            pieces_left = max(2, (len(remaining) + max_chars - 1) // max_chars)
            cut = max(min_fragment_chars, round(len(remaining) / pieces_left))
            cut = min(cut, max_chars)

        parts.append(remaining[:cut].strip())
        remaining = remaining[cut:].strip()

    if remaining:
        if parts and len(remaining) < min_fragment_chars:
            parts[-1] = f"{parts[-1]}{remaining}"
        else:
            parts.append(remaining)

    return [p for p in parts if p]


def split_text(text, max_chars=38):
    normalized = re.sub(r"\s+", " ", str(text or "")).strip()
    if not normalized:
        return []

    # Preserve sentence boundaries first. Each subtitle cue should contain
    # one complete sentence, or at most two adjacent short sentences.
    sentences = [
        s.strip()
        for s in re.findall(r"[^。！？!?；;]+[。！？!?；;]?", normalized)
        if s.strip()
    ] or [normalized]

    units = []
    for sentence in sentences:
        units.extend(split_long_sentence(sentence, max_chars=max_chars))

    chunks = []
    i = 0
    while i < len(units):
        current = units[i]
        if i + 1 < len(units):
            combined = f"{current}{units[i + 1]}"
            if len(combined) <= max_chars:
                chunks.append(combined)
                i += 2
                continue
        chunks.append(current)
        i += 1

    return chunks

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
