"""Offline fail-closed SRT contract checks; never represents actual acoustic alignment."""
import pathlib,subprocess,sys,tempfile,unittest
SCRIPT=pathlib.Path(__file__).resolve().parents[1]/"scripts/build_daily_gainers_m5_v3_private_srt.py"
class Check(unittest.TestCase):
 def test_python_syntax(self):
  compile(SCRIPT.read_text(),str(SCRIPT),"exec")
 def test_rejects_untrusted_audio_zip(self):
  with tempfile.TemporaryDirectory() as d:
   z=pathlib.Path(d)/"fake.zip";z.write_bytes(b"not the owner artifact")
   p=subprocess.run([sys.executable,str(SCRIPT),str(z),str(pathlib.Path(d)/"output")],capture_output=True,text=True)
   self.assertNotEqual(p.returncode,0)
   self.assertIn("WRONG_ARCHIVE_SHA",p.stderr)
   self.assertFalse((pathlib.Path(d)/"output"/"private-preview.srt").exists())
 def test_no_publication_or_false_acoustic_claim(self):
  s=SCRIPT.read_text()
  self.assertIn('"acoustic_sentence_boundary_verified":False',s)
  self.assertIn('"publication_authorized":False',s)
  self.assertIn('"all_mp3_hashes_verified":True',s)
  self.assertNotIn("edge-tts",s)
if __name__=="__main__":unittest.main()
