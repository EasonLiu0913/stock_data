#!/usr/bin/env python3
"""Opt-in research fixture tests for 20261008 source reuse, never production CI."""
import copy, json, shutil, tempfile, unittest
from pathlib import Path
from research_verify_20261008_scene1_source import verify

class VerifiedSceneContract(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        import os
        if not os.getenv("MVP10_RESEARCH_SCENE1_FIXTURE") or not os.getenv("MVP10_RESEARCH_SCENE1_WAV"):
            raise unittest.SkipTest("Explicit verified original local fixture paths required")
        cls.input_dir = Path(os.environ["MVP10_RESEARCH_SCENE1_FIXTURE"])
        cls.source_wav = Path(os.environ["MVP10_RESEARCH_SCENE1_WAV"])
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.root = Path(self.tmp.name) / "source"
        shutil.copytree(self.input_dir, self.root)
    def tearDown(self):
        self.tmp.cleanup()
    def change(self, name, callback):
        path=self.root/name
        record=json.loads(path.read_text(encoding="utf-8"))
        callback(record)
        path.write_text(json.dumps(record,ensure_ascii=False),encoding="utf-8")
    def rejected(self):
        with self.assertRaises(ValueError):
            verify(self.root,self.source_wav)
    def test_valid_source(self):
        result=verify(self.root,self.source_wav)
        self.assertEqual(result["srt_cues"],14)
        self.assertFalse(result["publishable"])
    def test_date_tampering(self):
        self.change("plan.json", lambda d:d.update(target_date="20261009"))
        self.rejected()
    def test_publication_tampering(self):
        self.change("integration-receipt.json", lambda d:d.update(publication_authorized=True))
        self.rejected()
    def test_fake_new_tts(self):
        self.change("tts-manifest.json", lambda d:d["scenes"][0].update(engine="edge-tts"))
        self.rejected()
    def test_missing_event(self):
        self.change("tts-manifest.json",lambda d:d["scenes"][0]["word_boundaries"].pop())
        self.rejected()
    def test_wrong_voice(self):
        self.change("tts-manifest.json",lambda d:d.update(rate="+30%"))
        self.rejected()
    def test_audio_tampering(self):
        (self.root/"audio/01.mp3").write_bytes(b"invalid")
        self.rejected()
    def test_caption_tampering(self):
        (self.root/"daily-gainers-20261008.zh-TW.srt").write_text("invalid",encoding="utf-8")
        self.rejected()
    def test_owner_acceptance_removed(self):
        self.change("integration-receipt.json",lambda d:d.update(source_line4_owner_lexical_pass=False))
        self.rejected()
    def test_added_scene(self):
        self.change("plan.json",lambda d:d.update(scene_count=9))
        self.rejected()

if __name__=="__main__":
    unittest.main(verbosity=2)
