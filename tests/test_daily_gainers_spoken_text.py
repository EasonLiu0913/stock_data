#!/usr/bin/env python3
"""Regression tests for spoken dates vs. subtitle display dates."""
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
from daily_gainers_spoken_text import normalize_spoken_dates, normalize_spoken_text, normalize_spoken_percentages


class SpokenDatesTest(unittest.TestCase):
    def test_month_day_and_year_month_day(self):
        self.assertEqual(normalize_spoken_dates("今天是 10/7。"), "今天是 十月七日。")
        self.assertEqual(normalize_spoken_dates("2026/10/07 台股"), "二零二六年十月七日 台股")
        self.assertEqual(normalize_spoken_dates("明天 1/2、12/31"), "明天 一月二日、十二月三十一日")

    def test_non_dates_preserved(self):
        self.assertEqual(normalize_spoken_dates("股票 2330/10/7，日期 13/40"), "股票 2330/10/7，日期 13/40")
        self.assertEqual(normalize_spoken_dates("2026/02/30 資料"), "2026/02/30 資料")

    def test_conversational_slash_and_protected_values(self):
        self.assertEqual(normalize_spoken_text("法人/分點"), "法人與分點")
        self.assertEqual(normalize_spoken_text("法人 / 分點、資金/籌碼"), "法人與分點、資金與籌碼")
        self.assertEqual(normalize_spoken_text("PCB/CPO，10/7 收盤"), "PCB 與 CPO，十月七日 收盤")
        self.assertEqual(normalize_spoken_text("13/40，股票 2330/10/7"), "13/40，股票 2330/10/7")

    def test_original_caption_source_unchanged(self):
        caption = "10/7 強勢股；2026/10/07 收盤。"
        spoken = normalize_spoken_dates(caption)
        self.assertEqual(caption, "10/7 強勢股；2026/10/07 收盤。")
        self.assertEqual(spoken, "十月七日 強勢股；二零二六年十月七日 收盤。")

    def test_percentage_tts_only_and_no_english_suffix(self):
        cases = {
            "跌幅 1.95%": "跌幅 百分之1.95",
            "跌幅百分之1.95 percent": "跌幅百分之1.95",
            "跌幅百分之1.95% percent": "跌幅百分之1.95",
            "上漲 5％": "上漲 百分之5",
            "法人占比 9.91 percent": "法人占比 百分之9.91",
            "上漲百分之1.95": "上漲百分之1.95",
            "跌幅 -1.95%": "跌幅 負百分之1.95",
            "百分之1.95 percent percent": "百分之1.95",
        }
        for source, expected in cases.items():
            with self.subTest(source=source):
                self.assertEqual(normalize_spoken_text(source), expected)
                self.assertNotIn("percent", normalize_spoken_text(source).lower())

    def test_percentage_display_is_untouched(self):
        caption = "跌幅 1.95%，成交占比 9.91%。"
        self.assertEqual(normalize_spoken_text(caption), "跌幅 百分之1.95，成交占比 百分之9.91。")
        self.assertEqual(caption, "跌幅 1.95%，成交占比 9.91%。")
        self.assertEqual(normalize_spoken_percentages("https://example.com/1.95%"), "https://example.com/1.95%")


if __name__ == "__main__":
    unittest.main()
