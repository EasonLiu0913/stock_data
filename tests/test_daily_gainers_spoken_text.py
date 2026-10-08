#!/usr/bin/env python3
"""Regression tests for spoken dates vs. subtitle display dates."""
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
from daily_gainers_spoken_text import normalize_spoken_dates


class SpokenDatesTest(unittest.TestCase):
    def test_month_day_and_year_month_day(self):
        self.assertEqual(normalize_spoken_dates("今天是 10/7。"), "今天是 十月七日。")
        self.assertEqual(normalize_spoken_dates("2026/10/07 台股"), "二零二六年十月七日 台股")
        self.assertEqual(normalize_spoken_dates("明天 1/2、12/31"), "明天 一月二日、十二月三十一日")

    def test_non_dates_preserved(self):
        self.assertEqual(normalize_spoken_dates("股票 2330/10/7，日期 13/40"), "股票 2330/10/7，日期 13/40")
        self.assertEqual(normalize_spoken_dates("2026/02/30 資料"), "2026/02/30 資料")

    def test_original_caption_source_unchanged(self):
        caption = "10/7 強勢股；2026/10/07 收盤。"
        spoken = normalize_spoken_dates(caption)
        self.assertEqual(caption, "10/7 強勢股；2026/10/07 收盤。")
        self.assertEqual(spoken, "十月七日 強勢股；二零二六年十月七日 收盤。")


if __name__ == "__main__":
    unittest.main()
