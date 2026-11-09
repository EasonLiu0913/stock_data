import base64
import json
import unittest

from scripts.fish_audio_timestamp_stream import (
    build_global_timeline,
    parse_sse_events,
    timeline_to_word_boundaries,
    validate_alignment,
)
from scripts.daily_gainers_spoken_text import normalize_spoken_text
from scripts.daily_gainers_subtitle_alignment import align_cues


def event(audio, seq, offset, words, duration, content):
    return "data: " + json.dumps({
        "audio_base64": base64.b64encode(audio).decode("ascii"),
        "content": content,
        "chunk_seq": seq,
        "chunk_audio_offset_sec": offset,
        "alignment": {"audio_duration": duration, "segments": words},
    }) + "\n\n"


class FishTimestampStreamTests(unittest.TestCase):
    def test_concatenates_every_audio_chunk_and_uses_latest_alignment_snapshot(self):
        lines = "".join([
            event(b"a", 0, 0.0, [{"text": "大家好", "start": 0, "end": 0.6}], 0.6, "大家好"),
            event(b"b", 0, 0.0, [
                {"text": "大家好", "start": 0, "end": 0.6},
                {"text": "歡迎", "start": 0.6, "end": 1.0},
            ], 1.0, "大家好歡迎"),
            event(b"c", 1, 1.0, [{"text": "收看", "start": 0, "end": 0.5}], 0.5, "收看"),
        ]).splitlines()
        audio, by_chunk = parse_sse_events(lines)
        self.assertEqual(audio, b"abc")
        self.assertEqual(len(by_chunk[0]["segments"]), 2)
        timeline = build_global_timeline(by_chunk)
        self.assertEqual(timeline[-1]["start"], 1.0)
        self.assertEqual(validate_alignment("大家好歡迎收看", timeline, by_chunk), 1.0)

    def test_audio_without_alignment_is_kept_but_cannot_pass_final_validation(self):
        line = "data: " + json.dumps({"audio_base64": base64.b64encode(b"audio").decode(), "alignment": None}) + "\n\n"
        audio, by_chunk = parse_sse_events([line])
        self.assertEqual(audio, b"audio")
        self.assertEqual(by_chunk, {})
        with self.assertRaisesRegex(RuntimeError, "no usable timestamp alignment"):
            validate_alignment("台灣市場", [], by_chunk)

    def test_rejects_non_monotonic_alignment(self):
        by_chunk = {0: {"content": "甲乙", "offset": 0, "audio_duration": 2, "segments": [
            {"text": "甲", "start": 1, "end": 1.2},
            {"text": "乙", "start": 0.5, "end": 1.5},
        ]}}
        with self.assertRaisesRegex(RuntimeError, "not ordered"):
            build_global_timeline(by_chunk)

    def test_converts_seconds_to_consumer_wordboundary_ticks_and_aligns_cues(self):
        timeline = [
            {"text": "大家好", "start": 0.25, "end": 0.75},
            {"text": "歡迎", "start": 0.8, "end": 1.0},
        ]
        boundaries = timeline_to_word_boundaries(timeline, 1.1)
        self.assertEqual(boundaries, [
            {"text": "大家好", "offset": 2_500_000, "duration": 5_000_000},
            {"text": "歡迎", "offset": 8_000_000, "duration": 2_000_000},
        ])
        cues = align_cues(["大家好", "歡迎"], normalize_spoken_text, boundaries, 1.1)
        self.assertEqual(cues[0][0], 0.25)
        self.assertEqual(cues[1][0], 0.8)

    def test_rejects_timeline_outside_mp3_duration(self):
        with self.assertRaisesRegex(RuntimeError, "exceeds MP3 duration"):
            timeline_to_word_boundaries(
                [{"text": "超時", "start": 0.9, "end": 1.1}],
                1.0,
            )

    def test_rejects_alignment_with_text_coverage_gap(self):
        by_chunk = {0: {"content": "台灣", "offset": 0, "audio_duration": 1, "segments": [
            {"text": "台灣", "start": 0, "end": 0.5},
        ]}}
        timeline = build_global_timeline(by_chunk)
        with self.assertRaisesRegex(RuntimeError, "coverage too low"):
            validate_alignment("台灣股市市場開盤", timeline, by_chunk)


if __name__ == "__main__":
    unittest.main()
