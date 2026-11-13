#!/usr/bin/env python3
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
from daily_gainers_caption_numbers import normalize_spoken_percentages


class SpokenPercentCaptionTest(unittest.TestCase):
    def test_compound_chinese_integer_is_converted_as_a_whole(self):
        self.assertEqual(
            normalize_spoken_percentages("成交量較前日增加百分之三十八。"),
            "成交量較前日增加38%。",
        )

    def test_chinese_decimal_keeps_each_fraction_digit(self):
        self.assertEqual(
            normalize_spoken_percentages("增加百分之三點一八"),
            "增加3.18%",
        )

    def test_chinese_unit_number_is_converted(self):
        self.assertEqual(
            normalize_spoken_percentages("法人買超百分之十二"),
            "法人買超12%",
        )

    def test_arabic_percentage_value_is_preserved(self):
        self.assertEqual(
            normalize_spoken_percentages("較前日增加百分之3.18"),
            "較前日增加3.18%",
        )

    def test_unrelated_text_is_unchanged(self):
        self.assertEqual(
            normalize_spoken_percentages("收盤28.6元，成交量增加38%。"),
            "收盤28.6元，成交量增加38%。",
        )


if __name__ == "__main__":
    unittest.main()
