#!/usr/bin/env python3
"""Strict 20261008 scene-1 source import contract. Research-only; no upload or render."""
import argparse, hashlib, json, re, wave
from pathlib import Path
from mutagen.mp3 import MP3

DATE = "20261008"
WAV_SHA = "fc5598fcb5a4def1a3a0f1bf5d17609c12a7f065589c27109e8d50ce3ce06bc7"
MP3_SHA = "3721fc4e80f2ab875499fdb9faf68c382c8775dfb9397000f150de5474c043e6"
SRT_SHA = "adf0c086bc5c73cf0a3cb9604adad90c2112264381f5b3517dcbba919cfb9024"
ENGINE = "edge-tts-reused-pcm-research-only"
LINE = "那麼我們開始囉。"
WORD_LABELS = ("那麼", "我們", "開始", "囉")
WORD_TICKS = (79304160, 82130410, 84087080, 86804160)

def insist(condition, message):
    if not condition:
        raise ValueError(message)

def digest(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()

def normalized(value):
    return re.sub(r"[\s，。！？、；：,.!?;:（）()「」『』【】\[\]—-]", "", value).lower()

def verify(scene_folder, source_wav):
    root = Path(scene_folder)
    plan = json.loads((root / "plan.json").read_text(encoding="utf-8"))
    manifest = json.loads((root / "tts-manifest.json").read_text(encoding="utf-8"))
    receipt = json.loads((root / "integration-receipt.json").read_text(encoding="utf-8"))
    insist(plan.get("target_date") == receipt.get("date") == DATE, "date mismatch")
    insist(plan.get("research_only") is True and plan.get("production_video_plan") is False, "not isolated research")
    insist(plan.get("scene_count") == len(plan.get("scenes", [])) == 1, "scene count mismatch")
    insist(plan.get("historical_full_plan_scene_count") == 9, "historical scene count mismatch")
    insist(receipt.get("publication_authorized") is False and receipt.get("research_only") is True, "publication forbidden")
    insist(receipt.get("main_modified") is False and receipt.get("youtube_uploaded") is False, "unsafe state")
    insist(receipt.get("source_line4_owner_lexical_pass") is True, "owner audio approval missing")
    insist(manifest.get("voice") == "zh-TW-YunJheNeural" and manifest.get("rate") == "+15%", "wrong voice")
    insist(manifest.get("research_only") is True and manifest.get("publication_authorized") is False, "unsafe manifest")
    insist(manifest.get("engine") == "edge-tts" and len(manifest.get("scenes", [])) == 1, "source lineage mismatch")
    item = manifest["scenes"][0]
    insist(item.get("id") == 1 and item.get("engine") == ENGINE and item.get("file") == "audio/01.mp3", "source engine mismatch")
    speech = item.get("spoken_text", "")
    insist(LINE in speech and LINE in plan["scenes"][0].get("narration", ""), "frozen line missing")
    insist(normalized(speech) == normalized(plan["scenes"][0]["narration"]), "source narration mismatch")
    words = item.get("word_boundaries", [])
    insist(len(words) == 128, "word event count mismatch")
    insist(normalized("".join(w["text"] for w in words)) == normalized(speech), "spoken text/event mismatch")
    for idx, (word, tick) in enumerate(zip(WORD_LABELS, WORD_TICKS), 17):
        insist(words[idx]["text"] == word and words[idx]["offset"] == tick, "V4 word event drift")
    last = -1
    for w in words:
        offset, duration = w["offset"], w["duration"]
        insist(type(offset) is int and type(duration) is int and duration > 0 and offset >= last, "word-event ordering")
        insist((offset + duration) / 1e7 <= 43.563, "word event beyond source audio")
        last = offset + duration
    wav = Path(source_wav)
    insist(digest(wav) == WAV_SHA == receipt["scene1_pcm_sha256"], "WAV source tampered")
    with wave.open(str(wav), "rb") as handle:
        insist((handle.getframerate(), handle.getnchannels(), handle.getsampwidth(), handle.getnframes()) == (24000,1,2,1045488), "WAV format mismatch")
    mp3 = root / "audio/01.mp3"
    insist(digest(mp3) == MP3_SHA == receipt["reencoded_mp3_sha256"], "MP3 tampered")
    measured = MP3(str(mp3)).info.length
    insist(43.562 <= measured <= 43.740, "unexpected MP3 padding")
    srt = root / "daily-gainers-20261008.zh-TW.srt"
    insist(digest(srt) == SRT_SHA == receipt["research_srt_sha256"], "audited SRT tampered")
    cues = [x.splitlines() for x in re.split(r"\n\s*\n", srt.read_text(encoding="utf-8").strip())]
    insist(len(cues) == 14 and receipt.get("cue_count") == 14, "subtitle cue count mismatch")
    insist(normalized("".join("".join(c[2:]) for c in cues)) == normalized(speech), "subtitle/speech mismatch")
    insist(sum(LINE in "".join(c[2:]) for c in cues) == 1, "frozen line must be one cue")
    events_ms = {round(e["offset"] / 1e7, 3) for e in words}
    prev_end = None
    for i, cue in enumerate(cues, 1):
        insist(cue[0] == str(i) and len(cue) >= 3, "invalid SRT cue")
        match = re.fullmatch(r"(\d\d):(\d\d):(\d\d),(\d{3}) --> (\d\d):(\d\d):(\d\d),(\d{3})", cue[1])
        insist(match is not None, "invalid SRT timestamp")
        v = list(map(int, match.groups()))
        start = v[0]*3600+v[1]*60+v[2]+v[3]/1000
        end = v[4]*3600+v[5]*60+v[6]+v[7]/1000
        insist(end-start >= 1 and end <= 43.563, "invalid cue exposure")
        insist(round(start, 3) in events_ms, "non-authentic subtitle word boundary")
        insist(prev_end is None or abs(prev_end-start) <= 0.002, "subtitle gap/overlap")
        prev_end = end
    return {"research_only":True,"publishable":False,"date":DATE,"source_engine":ENGINE,
            "word_events":len(words),"srt_cues":len(cues),"source_wav_seconds":43.562,
            "mp3_measured_seconds":round(measured,6),"frozen_ab_complete":False}

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("scene_folder")
    parser.add_argument("--source-wav", required=True)
    args = parser.parse_args()
    print(json.dumps(verify(args.scene_folder,args.source_wav), ensure_ascii=False, indent=2))
