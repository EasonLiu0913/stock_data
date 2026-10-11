"""Offline negative and positive unit checks; synthetic durations are NEVER media proof."""
import json, pathlib, runpy, tempfile, unittest
from unittest.mock import patch
from subprocess import CalledProcessError
SCRIPT=pathlib.Path(__file__).resolve().parents[1]/"scripts/research_m5_v3_private_tts_proof.py"
class Check(unittest.TestCase):
 def run_case(self, overrides=None, durations=None, fail=False):
  with tempfile.TemporaryDirectory() as d:
   p=pathlib.Path(d); s={"target_date":"20261008","scenes":[{"scene":i,"speech_text":"測試語句","caption_text":"測試語句","display_text":"測試語句"} for i in range(1,8)],"source_sha256":{"fixture":"only"},"publication_authorized":False,"tts_authorized":False,"video_authorized":False,"private_media_proof_complete":False}
   s.update(overrides or {});(p/"source.json").write_text(json.dumps(s))
   calls=[]
   def synth(args,**kw):
    calls.append(args)
    pathlib.Path(args[-1]).write_bytes(b"mock-not-real-audio")
    if fail:raise CalledProcessError(1,args)
   vals=iter(durations or [10.]*7)
   def probe(*a,**k):return str(next(vals))
   with patch("sys.argv",[str(SCRIPT),str(p/"source.json"),str(p/"out")]),patch("subprocess.run",side_effect=synth),patch("subprocess.check_output",side_effect=probe):
    try:runpy.run_path(str(SCRIPT),run_name="__main__");error=None
    except Exception as e:error=e
   proof=p/"out"/"audio-proof.json"
   return error,json.loads(proof.read_text()) if proof.exists() else None,calls
 def test_measured_total_and_release_lock(self):
  err,proof,calls=self.run_case()
  self.assertIsNone(err);self.assertEqual(len(calls),7);self.assertEqual(proof["measured_total_audio_seconds"],70.)
  self.assertEqual(proof["target_60_to_90_seconds_pass"],True)
  for k in ("publication_authorized","timed_srt_generated","mp4_generated","private_media_proof_complete"):self.assertFalse(proof[k])
  self.assertTrue(all("--voice" in x and "zh-TW-YunJheNeural" in x and "--rate=+15%" in x for x in calls))
 def test_reject_release_drift(self):
  err,proof,calls=self.run_case({"publication_authorized":True})
  self.assertIsInstance(err,AssertionError);self.assertIsNone(proof);self.assertFalse(calls)
 def test_fail_actual_duration_gate(self):
  err,proof,_=self.run_case(durations=[2.]*7)
  self.assertIsInstance(err,RuntimeError);self.assertFalse(proof["target_60_to_90_seconds_pass"])
 def test_tts_failure_not_success(self):
  err,proof,_=self.run_case(fail=True)
  self.assertIsInstance(err,CalledProcessError);self.assertIsNone(proof)
if __name__=="__main__":unittest.main()
