import base64
import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from scripts.fish_audio_timestamp_stream import (
    FishStreamError,
    build_global_timeline,
    parse_sse_events,
    timeline_to_word_boundaries,
    validate_alignment,
    write_failure_diagnostic,
    run as run_timestamp_adapter,
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

    def test_preserves_fish_documented_zero_duration_word_and_exact_offset(self):
        by_chunk = {0: {"content": "to", "offset": 0, "audio_duration": 20, "segments": [
            {"text": "to", "start": 15.6, "end": 15.6},
        ]}}
        timeline = build_global_timeline(by_chunk)
        self.assertEqual(timeline[0]["text"], "to")
        self.assertEqual(timeline[0]["start_seconds_exact"], "15.6")
        self.assertEqual(timeline[0]["end_seconds_exact"], "15.6")
        boundaries = timeline_to_word_boundaries(timeline, 20)
        self.assertEqual(boundaries, [{"text": "to", "offset": 156_000_000, "duration": 0}])
        self.assertEqual(validate_alignment("to", timeline, by_chunk), 1.0)

    def test_sse_preserves_decimal_timestamp_values(self):
        lines = [event(b"a", 0, 15.6, [{"text": "to", "start": 0.0, "end": 0.0}], 20.0, "to")]
        _, by_chunk = parse_sse_events("".join(lines).splitlines())
        self.assertEqual(str(by_chunk[0]["offset"]), "15.6")
        self.assertEqual(str(by_chunk[0]["segments"][0]["start"]), "0.0")

    def test_preserves_positive_submicrosecond_interval_through_chunk_offset(self):
        by_chunk = {0: {"content": "甲", "offset": 23.371701, "audio_duration": 3, "segments": [
            {"text": "甲", "start": 2.0, "end": 2.0000001},
        ]}}
        timeline = build_global_timeline(by_chunk)
        self.assertLess(timeline[0]["start"], timeline[0]["end"])
        boundaries = timeline_to_word_boundaries(timeline, 30.0)
        self.assertEqual(boundaries[0]["duration"], 1)

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
        with self.assertRaises(FishStreamError) as context:
            timeline_to_word_boundaries(
                [{"text": "超時", "start": 0.9, "end": 1.1}],
                1.0,
            )
        self.assertEqual(context.exception.code, "end_after_media_duration")

    def test_normalizes_small_backward_start_jitter_for_word_boundaries(self):
        boundaries = timeline_to_word_boundaries([
            {"text": "甲", "start": 1.0, "end": 1.2},
            {"text": "乙", "start": 0.9, "end": 1.4},
        ], 1.5)
        self.assertEqual(boundaries, [
            {"text": "甲", "offset": 10_000_000, "duration": 2_000_000},
            {"text": "乙", "offset": 10_000_000, "duration": 4_000_000},
        ])

    def test_reports_large_backward_start_violation_separately(self):
        with self.assertRaises(FishStreamError) as context:
            timeline_to_word_boundaries([
                {"text": "甲", "start": 1.0, "end": 1.2},
                {"text": "乙", "start": 0.7, "end": 1.4},
            ], 1.5)
        self.assertEqual(context.exception.code, "start_order_violation")
        self.assertEqual(context.exception.details["backward_jitter_seconds"], "0.3")

    def test_reports_positive_interval_rounded_to_zero_ticks(self):
        with self.assertRaises(FishStreamError) as context:
            timeline_to_word_boundaries([{"text": "微小", "start": 0.1, "end": 0.10000001}], 1.0)
        self.assertEqual(context.exception.code, "duration_rounds_to_zero")
        self.assertEqual(context.exception.details["time_condition"], "positive_provider_interval_rounded_to_zero_ticks")

    def test_reports_negative_duration_separately(self):
        with self.assertRaises(FishStreamError) as context:
            build_global_timeline({0: {"content": "錯", "offset": 0, "audio_duration": 1, "segments": [
                {"text": "錯", "start": 0.5, "end": 0.4},
            ]}})
        self.assertEqual(context.exception.code, "provider_negative_duration")

    def test_reports_non_finite_timestamp_separately(self):
        with self.assertRaises(FishStreamError) as context:
            build_global_timeline({0: {"content": "錯", "offset": 0, "audio_duration": 1, "segments": [
                {"text": "錯", "start": float("nan"), "end": 0.5},
            ]}})
        self.assertEqual(context.exception.code, "non_finite_timestamp")

    def test_reports_out_of_chunk_end_separately(self):
        with self.assertRaises(FishStreamError) as context:
            build_global_timeline({0: {"content": "超", "offset": 0, "audio_duration": 1, "segments": [
                {"text": "超", "start": 0.5, "end": 1.5},
            ]}})
        self.assertEqual(context.exception.code, "end_after_chunk_duration")

    def test_reports_positive_interval_float_collapse_separately(self):
        with self.assertRaises(FishStreamError) as context:
            build_global_timeline({0: {"content": "微", "offset": 0, "audio_duration": 100000001, "segments": [
                {"text": "微", "start": 100000000, "end": 100000000.000000001},
            ]}})
        self.assertEqual(context.exception.code, "adapter_precision_collapse")

    def test_failure_diagnostic_is_payload_free_and_names_time_condition(self):
        error = FishStreamError(
            "Fish Audio timeline exceeds MP3 duration",
            code="end_after_media_duration",
            details={"end_seconds": "1.1", "media_duration_seconds": "1.0"},
        )
        with tempfile.TemporaryDirectory() as temp_dir:
            path = write_failure_diagnostic(
                Path(temp_dir),
                scene_id=2,
                error=error,
            )
            document = json.loads(path.read_text(encoding="utf-8"))
        self.assertEqual(document["error_code"], "end_after_media_duration")
        self.assertEqual(document["scene_id"], 2)
        self.assertNotIn("text", document)
        self.assertNotIn("api_key", document)

    def test_adapter_cli_path_writes_diagnostic_before_preserving_failure(self):
        failure = FishStreamError(
            "Fish Audio timeline exceeds MP3 duration",
            code="end_after_media_duration",
            details={"end_seconds": "1.1", "media_duration_seconds": "1.0"},
        )
        with tempfile.TemporaryDirectory() as temp_dir:
            with patch("scripts.fish_audio_timestamp_stream._run", side_effect=failure):
                with self.assertRaises(FishStreamError):
                    run_timestamp_adapter(Path("unused-plan.json"), 2, Path(temp_dir))
            document = json.loads(
                (Path(temp_dir) / "tts-transport-diagnostics.json").read_text(encoding="utf-8")
            )
        self.assertEqual(document["status"], "failure")
        self.assertEqual(document["error_code"], "end_after_media_duration")

    def test_rejects_alignment_with_text_coverage_gap(self):
        by_chunk = {0: {"content": "台灣", "offset": 0, "audio_duration": 1, "segments": [
            {"text": "台灣", "start": 0, "end": 0.5},
        ]}}
        timeline = build_global_timeline(by_chunk)
        with self.assertRaisesRegex(RuntimeError, "coverage too low"):
            validate_alignment("台灣股市市場開盤", timeline, by_chunk)


if __name__ == "__main__":
    unittest.main()
