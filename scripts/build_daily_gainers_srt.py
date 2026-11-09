#!/usr/bin/env python3
import json, re, sys
from pathlib import Path
from mutagen.mp3 import MP3
from daily_gainers_spoken_text import normalize_spoken_text
from daily_gainers_subtitle_alignment import align_cues
from daily_gainers_caption_segments import segment_pairs

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
tts_engine = tts_manifest.get("engine")
if tts_engine not in ("edge-tts", "fish.audio"):
    raise RuntimeError("Unsupported TTS timing provider")
if tts_engine == "fish.audio" and (
    not isinstance(tts_manifest.get("provider_identity"), dict)
    or tts_manifest["provider_identity"].get("provider") != "fish.audio"
):
    raise RuntimeError("Fish timing manifest omitted provider identity")
tts_scenes = {int(item["id"]): item for item in tts_manifest["scenes"]}


def split_long_sentence(sentence, max_chars=30, min_fragment_chars=6):
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
        if parts and len(remaining) < min_fragment_chars and len(parts[-1]) + len(remaining) <= max_chars:
            parts[-1] = f"{parts[-1]}{remaining}"
        else:
            parts.append(remaining)

    return [p for p in parts if p]


def split_text(text, max_chars=30):
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

def wrap_caption_for_screen(text, max_columns=30):
    """At most two centered SRT lines, punctuation-first, no dropped words."""
    import unicodedata
    def width(value):
        return sum(1 if unicodedata.east_asian_width(c) in ('F', 'W') else 0.55 for c in value)
    source = str(text).replace('\n', '')
    if width(source) <= max_columns:
        return source
    if width(source) > 2 * max_columns:
        raise RuntimeError('Subtitle >2-line safe capacity; resegment spoken cue')
    eligible = [i for i in range(1, len(source))
                if width(source[:i]) <= max_columns
                and width(source[i:]) <= max_columns]
    if not eligible:
        raise RuntimeError('Subtitle cannot fit within two 30-column lines')
    midpoint = width(source) / 2
    punctuation = [i for i in eligible if source[i-1] in '。！？；，、：,;:!?']
    candidates = punctuation if punctuation else eligible
    cut = min(candidates, key=lambda i: abs(width(source[:i]) - midpoint))
    lines = [source[:cut], source[cut:]]
    if ''.join(lines) != source or len(lines) > 2 or any(width(line) > max_columns for line in lines):
        raise RuntimeError('Subtitle wrapping altered text or left the caption safe area')
    return '\n'.join(lines)

def detect_silence_centers(audio_path):
    """Non-AI pause hints from ffmpeg; WordBoundary remains authoritative."""
    import subprocess
    proc = subprocess.run(
        ['ffmpeg', '-hide_banner', '-nostats', '-i', str(audio_path),
         '-af', 'silencedetect=noise=-38dB:d=0.14', '-f', 'null', '-'],
        capture_output=True, text=True, check=False)
    if proc.returncode:
        raise RuntimeError('Waveform silence analysis failed: ' + proc.stderr[-400:])
    starts = []
    centers = []
    for line in proc.stderr.splitlines():
        found_start = re.search(r'silence_start:\s*([0-9.]+)', line)
        found_end = re.search(r'silence_end:\s*([0-9.]+)', line)
        if found_start:
            starts.append(float(found_start.group(1)))
        if found_end and starts:
            start = starts.pop(0)
            end = float(found_end.group(1))
            if end > start:
                centers.append((start + end) / 2)
    return centers

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
pause_audit = []
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

    if plan.get("schema_version") == 2:
        pairs = scene.get("caption_cues")
        if not isinstance(pairs, list) or not pairs:
            raise RuntimeError(f"Scene {sid}: v2 requires complete caption_cues")
        if any(not isinstance(p, dict) or not p.get("caption") or not p.get("speech") for p in pairs):
            raise RuntimeError(f"Scene {sid}: invalid caption/speech pairs")
        chunks = [p["caption"] for p in pairs]
        spoken_chunks = [p["speech"] for p in pairs]
        if "".join(spoken_chunks) != scene.get("speech_text"):
            raise RuntimeError(f"Scene {sid}: spoken cues omit or add words")
        if "".join(chunks) != scene.get("caption_text"):
            raise RuntimeError(f"Scene {sid}: caption cues omit or add text")
    else:
        chunks = split_text(scene.get("narration"))
        spoken_chunks = chunks
    if plan.get("schema_version") == 2:
        timed_pairs = segment_pairs(pairs)
        chunks = [item["caption"] for item in timed_pairs]
        spoken_chunks = [item["speech"] for item in timed_pairs]
    if not chunks:
        cursor += rendered_duration
        continue

    tts_scene = tts_scenes.get(sid)
    if not tts_scene or tts_scene.get("engine") != tts_engine:
        raise RuntimeError(f"Scene {sid}: word-level subtitle timing provider mismatch")
    try:
        cue_intervals = align_cues(spoken_chunks, normalize_spoken_text,
                                   tts_scene.get("word_boundaries", []), duration)
    except ValueError as exc:
        raise RuntimeError(f"Scene {sid} ({scene.get('title')}): subtitle alignment failed: {exc}") from exc

    # Compare word-aligned cue boundaries with actual quiet intervals.
    # A mismatch is diagnostic only: waveform energy cannot identify words.
    silence_centers = detect_silence_centers(audio_path)
    for boundary_index in range(1, len(cue_intervals)):
        expected = cue_intervals[boundary_index][0]
        distance = min((abs(expected - p) for p in silence_centers), default=None)
        pause_audit.append({'scene_id': sid, 'kind': 'pause_boundary_check',
                          'boundary_index': boundary_index,
                          'word_boundary_seconds': round(expected, 3),
                          'nearest_pause_distance_seconds':
                          round(distance, 3) if distance is not None else None,
                          'pause_nearby': distance is not None and distance <= 0.20})

    for chunk, (start, end) in zip(chunks, cue_intervals):
        # v1 aligns the *spoken* chunks first.  Change display text only AFTER
        # WordBoundary alignment so speech remains 百分之9.96 and captions show 9.96%.
        if plan.get("schema_version") == 1:
            percent_words = {"零": "0", "一": "1", "二": "2", "三": "3", "四": "4",
                             "五": "5", "六": "6", "七": "7", "八": "8",
                             "九": "9", "十": "10"}
            def display_percent(match):
                value = match.group(1)
                return (percent_words.get(value, value) + "%")
            chunk = re.sub(r"百分之\s*(\d+(?:\.\d+)?|[零一二三四五六七八九十])",
                           display_percent, chunk)
        # Display-only two-line wrapping; WordBoundary alignment used the original spoken chunk.
        chunk = wrap_caption_for_screen(chunk, max_columns=30)
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

final_video_duration = float(render_timing["duration_seconds"])
if abs(cursor - final_video_duration) > 0.30:
    raise RuntimeError(f"Subtitles vs final MP4 duration mismatch: {cursor:.3f}s vs {final_video_duration:.3f}s")
if cue_audit and cue_audit[-1]["end_seconds"] > final_video_duration + 0.1:
    raise RuntimeError("Last subtitle extends beyond the final MP4")
out_path.write_text("\n\n".join(block.rstrip("\n") for block in blocks) + "\n", encoding="utf-8")
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
    "pause_checks": pause_audit,
}
(plan_path.parent / "subtitle-manifest.json").write_text(
    json.dumps(manifest, ensure_ascii=False, indent=2) + "\n",
    encoding="utf-8",
)
print(json.dumps(manifest, ensure_ascii=False, indent=2))
