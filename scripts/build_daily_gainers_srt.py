#!/usr/bin/env python3
import json, re, sys
from pathlib import Path
from mutagen.mp3 import MP3
from daily_gainers_spoken_text import normalize_spoken_text
from daily_gainers_subtitle_alignment import align_cues

if len(sys.argv) < 2:
    print("Usage: python scripts/build_daily_gainers_srt.py <plan.json>", file=sys.stderr)
    sys.exit(1)

plan_path = Path(sys.argv[1]).resolve()
if not plan_path.exists():
    raise FileNotFoundError(f"Missing plan: {plan_path}")

plan = json.loads(plan_path.read_text(encoding="utf-8"))
audio_dir = plan_path.parent / "audio"
out_path = plan_path.parent / f"daily-gainers-{plan['target_date']}.zh-TW.srt"

tts_manifest_path = plan_path.parent / "tts-manifest.json"
if not tts_manifest_path.exists():
    raise FileNotFoundError(f"Missing TTS timing manifest: {tts_manifest_path}")
tts_manifest = json.loads(tts_manifest_path.read_text(encoding="utf-8"))
tts_scenes = {int(item["id"]): item for item in tts_manifest["scenes"]}


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
cue_audit = []
render_timing_path = plan_path.parent / "render-timings.json"
if not render_timing_path.exists():
    raise FileNotFoundError(f"Missing rendered-scene timing manifest: {render_timing_path}")
render_timing = json.loads(render_timing_path.read_text(encoding="utf-8"))
render_scenes = {int(item["id"]): item for item in render_timing["scenes"]}

for scene in plan.get("scenes", []):
    sid = int(scene["id"])
    audio_path = audio_dir / f"{sid:02d}.mp3"
    if not audio_path.exists():
        raise FileNotFoundError(f"Missing audio: {audio_path}")
    duration = float(MP3(audio_path).info.length)
    rendered_scene = render_scenes.get(sid)
    if not rendered_scene:
        raise RuntimeError(f"No final render timing for scene {sid}")
    rendered_start = float(rendered_scene["start_seconds"])
    rendered_duration = float(rendered_scene["duration_seconds"])
    if abs(cursor - rendered_start) > 0.015:
        raise RuntimeError(f"Scene {sid}: unexpected render cursor {cursor} vs {rendered_start}")
    if duration <= 0:
        raise RuntimeError(f"Invalid audio duration: {audio_path}")

    chunks = split_text(scene.get("narration"))
    if not chunks:
        cursor += rendered_duration
        continue

    tts_scene = tts_scenes.get(sid)
    if not tts_scene or tts_scene.get("engine") != "edge-tts":
        raise RuntimeError(f"Scene {sid}: word-level subtitle timing requires edge-tts")
    try:
        cue_intervals = align_cues(chunks, normalize_spoken_text,
                                   tts_scene.get("word_boundaries", []), duration)
    except ValueError as exc:
        raise RuntimeError(f"Scene {sid} ({scene.get('title')}): subtitle alignment failed: {exc}") from exc

    for chunk, (start, end) in zip(chunks, cue_intervals):
        end = min(end, rendered_duration)
        if end <= start:
            raise RuntimeError(f"Scene {sid}: subtitle exceeds actual rendered scene duration")
        blocks.append(
            f"{cue_no}\n{fmt_srt(cursor+start)} --> {fmt_srt(cursor+end)}\n{chunk}\n"
        )
        cue_audit.append({"cue": cue_no, "scene_id": sid, "scene_title": scene.get("title"),
                          "start_seconds": round(cursor+start, 3),
                          "end_seconds": round(cursor+end, 3), "text": chunk})
        cue_no += 1

    scene_timing.append({
        "id": sid,
        "start_seconds": round(cursor, 3),
        "duration_seconds": round(rendered_duration, 3),
        "audio_duration_seconds": round(duration, 3),
        "cue_count": len(chunks),
    })
    cursor += rendered_duration

out_path.write_text("\n".join(blocks) + "\n", encoding="utf-8")
manifest = {
    "schema_version": 1,
    "target_date": plan["target_date"],
    "language": "zh-TW",
    "source": "Edge TTS actual WordBoundary offsets + synthesized MP3 durations",
    "alignment_method": "word-boundary-with-rendered-scene-offsets-v2",
    "cue_count": cue_no - 1,
    "duration_seconds": round(cursor, 3),
    "subtitle_file": out_path.name,
    "scenes": scene_timing,
    "cues": cue_audit,
}
(plan_path.parent / "subtitle-manifest.json").write_text(
    json.dumps(manifest, ensure_ascii=False, indent=2) + "\n",
    encoding="utf-8",
)
print(json.dumps(manifest, ensure_ascii=False, indent=2))
