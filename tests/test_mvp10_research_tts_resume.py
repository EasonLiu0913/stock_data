"""Offline proof of bounded MVP10 research TTS checkpoint and integrity fail-closed."""
import asyncio
import contextlib
import io
import json
import os
from pathlib import Path
import random
import runpy
import sys
import tempfile
import types
import unittest
from unittest.mock import patch

SCRIPT = Path(__file__).resolve().parents[1] / "scripts" / "synthesize_daily_gainers_tts.py"
sys.path.insert(0, str(SCRIPT.parent))


class ResearchTTSResumeTest(unittest.TestCase):
    def _run(self, plan_path, fake_module, sleep):
        argv = ["synthesize_daily_gainers_tts.py", str(plan_path)]
        with patch.object(sys, "argv", argv), patch.dict(sys.modules, {"edge_tts": fake_module}), \
             patch.dict(os.environ, {"YOUTUBE_TTS_VOICE": "zh-TW-YunJheNeural",
                                     "YOUTUBE_TTS_RATE": "+15%",
                                     "MVP10_RESEARCH_TTS_CHECKPOINT": "1"}, clear=False), \
             patch.object(asyncio, "sleep", sleep), patch.object(random, "uniform", lambda *_: 0), \
             contextlib.redirect_stdout(io.StringIO()):
            runpy.run_path(str(SCRIPT), run_name="__main__")

    def test_failed_third_scene_recovers_without_regenerating_completed_audio(self):
        with tempfile.TemporaryDirectory(prefix="mvp10-tts-recovery-") as td:
            root = Path(td)
            plan_path = root / "plan.json"
            plan_path.write_text(json.dumps({
                "schema_version": 1, "target_date": "20261013", "research_only": True,
                "source_final_approved": False, "publication_authorized": False,
                "render_preview_only": True,
                "scenes": [{"id": i, "narration": f"第{i}場景配音。" } for i in range(1, 8)]
            }, ensure_ascii=False), encoding="utf-8")
            fake = types.ModuleType("edge_tts")
            counts = {}
            state = {"fail_3": True}

            class FakeCommunicate:
                def __init__(self, text, voice, rate, boundary):
                    self.sid = next(i for i in range(1, 8) if f"第{i}場景" in text)
                    if (voice, rate, boundary) != ("zh-TW-YunJheNeural", "+15%", "WordBoundary"):
                        raise AssertionError("Research audio identity drift")

                async def stream(self):
                    sid = self.sid
                    counts[sid] = counts.get(sid, 0) + 1
                    if sid == 3 and state["fail_3"]:
                        raise RuntimeError("simulated NoAudioReceived")
                    yield {"type": "audio", "data": bytes([sid]) * 1700}
                    yield {"type": "WordBoundary", "text": "場景", "offset": 0, "duration": 1000000}

            fake.Communicate = FakeCommunicate

            async def no_wait(_seconds):
                return None

            with self.assertRaisesRegex(RuntimeError, "Scene 3: Edge TTS failed"):
                self._run(plan_path, fake, no_wait)
            manifest_path = root / "tts-manifest.json"
            first = json.loads(manifest_path.read_text(encoding="utf-8"))
            self.assertEqual([x["id"] for x in first["scenes"]], [1, 2])
            self.assertTrue(all(x.get("audio_sha256") for x in first["scenes"]))
            self.assertEqual(counts[1], 1)
            self.assertEqual(counts[2], 1)
            self.assertEqual(counts[3], 4)

            state["fail_3"] = False
            self._run(plan_path, fake, no_wait)
            recovered = json.loads(manifest_path.read_text(encoding="utf-8"))
            self.assertEqual(len(recovered["scenes"]), 7)
            self.assertEqual(counts[1], 1, "scene1 must not be regenerated")
            self.assertEqual(counts[2], 1, "scene2 must not be regenerated")
            self.assertEqual(counts[3], 5, "scene3 only was retried")
            self.assertTrue(all(x["engine"] == "edge-tts" and x["word_boundaries"] for x in recovered["scenes"]))

            (root / "audio" / "01.mp3").write_bytes(b"tampered-content" * 150)
            with self.assertRaisesRegex(RuntimeError, "MVP10_RESEARCH_TTS_COMPLETED_SCENE_DRIFT_1"):
                self._run(plan_path, fake, no_wait)

    def test_nonresearch_plan_is_rejected_before_audio(self):
        with tempfile.TemporaryDirectory(prefix="mvp10-tts-refuse-") as td:
            path = Path(td) / "plan.json"
            path.write_text(json.dumps({
                "schema_version": 1, "target_date": "20261013", "research_only": False,
                "source_final_approved": False, "publication_authorized": False,
                "render_preview_only": True, "scenes": [{"id": i, "narration": "研究"} for i in range(1, 8)]
            }))
            async def no_wait(_seconds):
                return None
            with self.assertRaisesRegex(RuntimeError, "MVP10_RESEARCH_TTS_CHECKPOINT_NOT_AUTHORIZED"):
                self._run(path, types.ModuleType("edge_tts"), no_wait)


if __name__ == "__main__":
    unittest.main()
