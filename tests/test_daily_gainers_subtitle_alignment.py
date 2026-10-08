#!/usr/bin/env python3
import sys
import unittest
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
from daily_gainers_subtitle_alignment import align_cues
from daily_gainers_spoken_text import normalize_spoken_text

def boundaries(parts):
    t = 0
    result = []
    for text, duration in parts:
        result.append({"text": text, "offset": int(t*10_000_000), "duration": int(duration*10_000_000)})
        t += duration
    return result

class CaptionTimingTest(unittest.TestCase):
    def test_speech_based_cue_start_with_irregular_sentence_lengths(self):
        cues = ["最後一定要看風險。", "今天三十六檔強勢股裡，法人偏多。", "明天追蹤成交量。"]
        words = boundaries([("最後一定要看風險",2.4), ("今天三十六檔強勢股裡法人偏多",6.8), ("明天追蹤成交量",2.1)])
        spans = align_cues(cues,normalize_spoken_text,words,11.3)
        self.assertAlmostEqual(spans[1][0],2.4,places=3)
        self.assertAlmostEqual(spans[2][0],9.2,places=3)

    def test_spoken_slash_caption_stays_short(self):
        cues = ["法人/分點", "10/7 觀察"]
        words = boundaries([("法人與分點",1.1),("十月七日觀察",1.9)])
        spans = align_cues(cues,normalize_spoken_text,words,3.0)
        self.assertAlmostEqual(spans[1][0],1.1,places=3)

    def test_insufficient_boundaries_fail_closed(self):
        with self.assertRaisesRegex(ValueError,"coverage insufficient"):
            align_cues(["大量重要內容無法對齊"],normalize_spoken_text,boundaries([("大量",1)]),6.0)

if __name__ == "__main__":
    unittest.main()
