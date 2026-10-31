#!/usr/bin/env python3
"""Offline negative contract tests; never invoke Edge TTS or production render."""
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
from daily_gainers_tts_segments import split_spoken_text, combine_word_boundaries


class SegmentContractTests(unittest.TestCase):
    def test_exact_v4_preserved(self):
        speech = "大家好，歡迎來到 TAIWAN STOCK！追蹤資金，解讀行情。錢在哪，我們就在哪！那麼我們開始囉。"
        parts = split_spoken_text(speech, 35)
        self.assertGreaterEqual(len(parts), 3)
        self.assertEqual("".join(parts), speech)

    def test_unsplittable_sentence_fails(self):
        with self.assertRaises(ValueError):
            split_spoken_text("這是一段沒有句號而且不能拆開的長文字", 5)

    def test_nonempty_required(self):
        with self.assertRaises(ValueError):
            split_spoken_text("")
        with self.assertRaises(ValueError):
            split_spoken_text("。", 10)

    def test_measured_duration_offsets(self):
        parts = [
            (0.8, [{"text": "大家", "offset": 1000000, "duration": 2500000}]),
            (1.4, [{"text": "開始", "offset": 2000000, "duration": 3200000}]),
        ]
        events, duration = combine_word_boundaries(parts)
        self.assertEqual(duration, 2.2)
        self.assertEqual(events[0]["offset"], 1000000)
        self.assertEqual(events[1]["offset"], 10000000)
        self.assertEqual(events[1]["text"], "開始")

    def test_no_missing_or_fabricated_events(self):
        with self.assertRaises(ValueError):
            combine_word_boundaries([(1.0, [])])
        with self.assertRaises(ValueError):
            combine_word_boundaries([])
        with self.assertRaises(ValueError):
            combine_word_boundaries([(1.0, [{"text": "", "offset": 0, "duration": 1}])])

    def test_reject_outside_duration(self):
        with self.assertRaises(ValueError):
            combine_word_boundaries([(0.3, [{"text": "早", "offset": 2500000, "duration": 1000000}])])

    def test_reject_overlapping_events(self):
        with self.assertRaises(ValueError):
            combine_word_boundaries([(1, [
                {"text": "你", "offset": 0, "duration": 3000000},
                {"text": "好", "offset": 1000000, "duration": 3000000},
            ])])


if __name__ == "__main__":
    unittest.main()
