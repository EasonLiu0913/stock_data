"""Research-only natural segmentation regression; never implies acoustic alignment."""
import ast,pathlib,re,unittest
GEN=pathlib.Path(__file__).resolve().parents[1]/"scripts/build_daily_gainers_m5_v3_private_srt.py"
def segments(text):
 tree=ast.parse(GEN.read_text(encoding="utf-8"))
 fn=next(n for n in tree.body if isinstance(n,ast.FunctionDef) and n.name=="segments")
 scope={"re":re}
 exec(compile(ast.Module(body=[fn],type_ignores=[]),str(GEN),"exec"),scope)
 return scope["segments"](text)
class Check(unittest.TestCase):
 def test_fixed_opening_one_block(self):
  t="大家好，歡迎來到 TAIWAN STOCK！"
  self.assertEqual(segments(t),[t])
 def test_preserves_source_and_avoids_kd_word_cuts(self):
  samples=[
   "這裡的漲跌家數依上市普通股統計，和證交所整體市場成交金額是不同口徑，不能混在一起解讀。",
   "台灣證交所整體市場成交金額約九千二百四十五點零九億元，低於前五個交易日平均。",
   "三大法人合計賣超約九百一十五點七五億元，淨買賣超絕對金額相對於當天整體市場成交金額的參考比率約為百分之九點九一。",
   "外資賣超約七百五十八點五二億元、投信買超約三十點零九億元、自營商賣超約一百八十七點三一億元。",
   "法人買賣超為金額淨額，不能直接等同每一檔股票的買賣股數，也不代表當天市場所有交易都是法人所為。",
   "綜合當天盤面，市場偏向弱勢，量能低於前五個交易日平均，三大法人整體賣超。"]
  forbidden=["是|同","前|五","相對|於","自|營商","不|代表","法|人"]
  for t in samples:
   with self.subTest(t=t):
    a=segments(t)
    self.assertEqual("".join(a),t)
    self.assertTrue(all(0<len(x)<=30 for x in a))
    for bad in forbidden:
     left,right=bad.split("|")
     self.assertFalse(any(x.endswith(left) and y.startswith(right) for x,y in zip(a,a[1:])),bad)
 def test_unknown_long_clause_fails_closed(self):
  with self.assertRaisesRegex(ValueError,"UNSAFE_OVERLONG"):
   segments("甲"*31+"。")
 def test_no_false_acoustic_or_publication_claim(self):
  s=GEN.read_text(encoding="utf-8")
  self.assertIn('"acoustic_sentence_boundary_verified":False',s)
  self.assertIn('"publication_authorized":False',s)
  self.assertNotIn('piece[:30]',s)
if __name__=="__main__":unittest.main()
