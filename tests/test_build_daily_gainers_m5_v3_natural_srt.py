"""Natural SRT review invariant tests, with no false acoustic timing assertion."""
import pathlib,re,unittest
class Check(unittest.TestCase):
 def test_full_opening_sentence_is_not_split(self):
  original="大家好，歡迎來到 TAIWAN STOCK！"
  sentences=re.findall(r"[^。！？!?；;]+[。！？!?；;]?|[。！？!?；;]",original)
  self.assertEqual(sentences,[original])
 def test_source_text_is_preserved(self):
  s="量能低於五日平均，須對照市場廣度。"
  parts=re.findall(r"[^。！？!?；;]+[。！？!?；;]?|[。！？!?；;]",s)
  self.assertEqual("".join(parts),s)
 def test_old_generator_must_not_claim_acoustic_alignment(self):
  p=pathlib.Path(__file__).resolve().parents[1]/"scripts/build_daily_gainers_m5_v3_private_srt.py"
  s=p.read_text()
  self.assertIn('"acoustic_sentence_boundary_verified":False',s)
if __name__=="__main__":unittest.main()
