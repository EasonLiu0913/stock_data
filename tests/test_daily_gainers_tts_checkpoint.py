import json
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
import daily_gainers_tts_checkpoint as checkpoint


class TtsCheckpointTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name)
        self.script = self.root / "script.json"
        self.manifest = self.root / "manifest.json"
        self.audio_dir = self.root / "checkpoint"
        self.write_script([
            {"id": 1, "scene_type": "stock_list", "narration": "第一段內容。"},
            {"id": 2, "scene_type": "closing_summary", "narration": "第二段內容。"},
        ])
        self.initialize()

    def tearDown(self):
        self.temp.cleanup()

    def write_script(self, scenes):
        self.script.write_text(json.dumps({"target_date": "20261104", "scenes": scenes}, ensure_ascii=False), encoding="utf-8")

    def initialize(self, voice="zh-TW-YunJheNeural", rate="+15%"):
        return checkpoint.initialize(
            self.script, "20261104", self.manifest, self.audio_dir,
            voice, rate, "7.3.1"
        )

    def record_scene(self, scene_id):
        audio = self.root / f"generated-{scene_id}.mp3"
        audio.write_bytes(bytes([scene_id]) * 2048)
        text = "第一段內容。" if scene_id == 1 else "第二段內容。"
        generated = self.root / f"generated-{scene_id}.json"
        generated.write_text(json.dumps({
            "scenes": [{
                "id": scene_id,
                "engine": "edge-tts",
                "spoken_text": text,
                "word_boundaries": [
                    {"text": "內容", "offset": 0, "duration": 2500000}
                ],
                "sha256": checkpoint.sha256_file(audio),
            }]
        }, ensure_ascii=False), encoding="utf-8")
        boundaries = self.root / f"boundaries-{scene_id}.json"
        boundaries.write_text(json.dumps([{"text": "內容", "offset": 0, "duration": 2500000}], ensure_ascii=False), encoding="utf-8")
        return checkpoint.record_success(
            self.manifest, self.audio_dir, scene_id, audio, boundaries,
            "run-1", generated
        )

    def test_partial_checkpoint_is_reused_and_only_missing_scene_is_planned(self):
        self.record_scene(1)
        current = self.initialize()
        self.assertEqual(checkpoint.missing_scenes(current), [2])
        self.assertEqual(current["scenes"][0]["status"], "success")
        self.assertEqual(current["scenes"][1]["status"], "pending")

    def test_matching_complete_checkpoint_validates(self):
        self.record_scene(1)
        self.record_scene(2)
        current = self.initialize()
        self.assertEqual(checkpoint.validate_checkpoint(current, self.audio_dir), [])

    def test_corrupt_audio_invalidates_only_that_scene(self):
        self.record_scene(1)
        self.record_scene(2)
        (self.audio_dir / "audio" / "02.mp3").write_bytes(b"corrupt")
        current = self.initialize()
        self.assertEqual(checkpoint.missing_scenes(current), [2])

    def test_voice_or_rate_drift_invalidates_scene_audio(self):
        self.record_scene(1)
        current = self.initialize(voice="zh-TW-HsiaoChenNeural")
        self.assertEqual(checkpoint.missing_scenes(current), [1, 2])

    def test_text_drift_invalidates_only_affected_scene(self):
        self.record_scene(1)
        self.record_scene(2)
        self.write_script([
            {"id": 1, "scene_type": "stock_list", "narration": "第一段內容。"},
            {"id": 2, "scene_type": "closing_summary", "narration": "第二段修改。"},
        ])
        current = self.initialize()
        self.assertEqual(checkpoint.missing_scenes(current), [2])

    def test_invalid_wordboundary_blocks_completion(self):
        self.record_scene(1)
        self.record_scene(2)
        boundary_path = self.audio_dir / "audio" / "02.wordboundaries.json"
        boundary_path.write_text(json.dumps([{"text": "", "offset": -1, "duration": 0}]), encoding="utf-8")
        current = json.loads(self.manifest.read_text(encoding="utf-8"))
        self.assertIn("SCENE_02_WORDBOUNDARY_INVALID", checkpoint.validate_checkpoint(current, self.audio_dir))

    def test_cleanup_requires_receipt_bound_to_manifest(self):
        self.record_scene(1)
        self.record_scene(2)
        current = json.loads(self.manifest.read_text(encoding="utf-8"))
        receipt = {
            "status": "uploaded",
            "target_date": current["target_date"],
            "script_sha256": current["script_sha256"],
            "audio_manifest_sha256": checkpoint.sha256_bytes(checkpoint.canonical_json(current)),
        }
        self.assertTrue(checkpoint.cleanup_allowed(current, receipt))
        receipt["target_date"] = "20261103"
        self.assertFalse(checkpoint.cleanup_allowed(current, receipt))

    def test_duplicate_or_out_of_order_scene_ids_are_rejected(self):
        self.write_script([
            {"id": 2, "narration": "第二段。"},
            {"id": 1, "narration": "第一段。"},
        ])
        with self.assertRaisesRegex(ValueError, "SCRIPT_SCENE_ORDER_INVALID"):
            self.initialize()


if __name__ == "__main__":
    unittest.main()
