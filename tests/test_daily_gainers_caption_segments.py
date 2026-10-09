import sys
import unittest
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
from daily_gainers_caption_segments import segment_pairs


class SegmentationTest(unittest.TestCase):
    def test_merge_two_sentences_but_not_overflow_third(self):
        pairs = [{"caption": "今天外資買超，市場量能增加。不過短線漲幅偏高，", "speech": "今天外資買超，市場量能增加。不過短線漲幅偏高，"}]
        result = segment_pairs(pairs, max_chars=20)
        self.assertEqual(len(result), 2)
        self.assertEqual(result[0]["caption"], "今天外資買超，市場量能增加。")
        self.assertEqual("".join(x["caption"] for x in result), pairs[0]["caption"])

    def test_numbers_preserve_spoken_content(self):
        pairs = [{"caption": "今天上漲5%，外資買超35檔。", "speech": "今天上漲百分之五，外資買超三十五檔。"}]
        result = segment_pairs(pairs)
        self.assertEqual("".join(x["caption"] for x in result), pairs[0]["caption"])
        self.assertEqual("".join(x["speech"] for x in result), pairs[0]["speech"])

    def test_three_sentence_cap(self):
        pairs = [{"caption": "甲，乙，丙，丁。", "speech": "甲，乙，丙，丁。"}]
        result = segment_pairs(pairs)
        self.assertEqual([x["caption"] for x in result], ["甲，乙，丙，", "丁。"])

    def test_long_clause_remains_single_line(self):
        text = "這是一個沒有標點符號而且需要在三十字之前切換字幕時間軸的測試句子可以完整保留"
        result = segment_pairs([{"caption": text, "speech": text}])
        self.assertTrue(all(len(x["caption"]) <= 30 for x in result))
        self.assertEqual("".join(x["caption"] for x in result), text)


if __name__ == "__main__":
    unittest.main()
