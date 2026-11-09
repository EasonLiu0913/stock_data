import base64
import importlib.util
import json
import os
import sys
import tempfile
import unittest
from pathlib import Path
from unittest import mock

ROOT = Path(__file__).resolve().parents[1]
SCRIPTS = ROOT / "scripts"
sys.path.insert(0, str(SCRIPTS))
import daily_gainers_tts_checkpoint as checkpoint

spec = importlib.util.spec_from_file_location("fish_production", SCRIPTS / "synthesize_daily_gainers_fish_tts.py")
fish = importlib.util.module_from_spec(spec)
spec.loader.exec_module(fish)


class FishProductionTtsTests(unittest.TestCase):
    def test_request_uses_pinned_identity_and_exactly_one_http_call(self):
        audio = b"mp3-chunk"
        event = {
            "audio_base64": base64.b64encode(audio).decode("ascii"),
            "content": "大家好歡迎",
            "chunk_seq": 0,
            "chunk_audio_offset_sec": 0,
            "alignment": {
                "audio_duration": 2,
                "segments": [
                    {"text": "大家", "start": 0, "end": 0.5},
                    {"text": "好", "start": 0.5, "end": 0.8},
                    {"text": "歡迎", "start": 0.8, "end": 1.2},
                ],
            },
        }

        class FakeResponse:
            status = 200
            headers = {"Content-Type": "text/event-stream"}

            def __enter__(self):
                return self

            def __exit__(self, *_args):
                return False

            def __iter__(self):
                return iter([b"data: " + json.dumps(event, ensure_ascii=False).encode("utf-8"), b""])

        with mock.patch.object(fish.urllib.request, "urlopen", return_value=FakeResponse()) as urlopen:
            returned_audio, alignments, content_type = fish.request_tts("大家好歡迎", "test-only-key")

        self.assertEqual(urlopen.call_count, 1)
        request = urlopen.call_args.args[0]
        payload = json.loads(request.data.decode("utf-8"))
        identity = fish.provider_identity()
        self.assertEqual(request.full_url, identity["endpoint"])
        self.assertEqual(request.get_header("Model"), identity["model"])
        self.assertEqual(payload["reference_id"], identity["reference_id"])
        self.assertEqual(payload["prosody"]["speed"], identity["prosody_speed"])
        self.assertEqual(payload["format"], "mp3")
        self.assertEqual(payload["sample_rate"], identity["sample_rate"])
        self.assertEqual(payload["mp3_bitrate"], identity["mp3_bitrate"])
        self.assertEqual(returned_audio, audio)
        self.assertEqual(content_type, "text/event-stream")
        self.assertEqual(sorted(alignments), [0])

    def test_generated_scene_is_bound_to_frozen_plan_and_checkpoint(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            script = root / "script.json"
            script.write_text(json.dumps({
                "target_date": "20261103",
                "scenes": [{"id": 1, "scene_type": "market_opening", "narration": "大家好，歡迎。"}],
            }, ensure_ascii=False), encoding="utf-8")
            manifest_path = root / "checkpoint" / "manifest.json"
            checkpoint_dir = root / "checkpoint"
            identity = fish.provider_identity()
            initialized = checkpoint.initialize(
                script, "20261103", manifest_path, checkpoint_dir,
                fish.VOICE, fish.RATE, "fish-timestamped-stream-v1",
                provider_identity=identity,
            )
            scene_plan = root / "scene" / "plan.json"
            checkpoint.make_scene_plan(script, "20261103", 1, scene_plan)

            alignments = {
                0: {
                    "content": "大家好歡迎",
                    "offset": 0,
                    "audio_duration": 2,
                    "segments": [
                        {"text": "大家", "start": 0, "end": 0.5},
                        {"text": "好", "start": 0.5, "end": 0.8},
                        {"text": "歡迎", "start": 0.8, "end": 1.2},
                    ],
                }
            }
            with mock.patch.dict(os.environ, {"FISH_API_KEY": "test-only-key"}), \
                 mock.patch.object(fish, "request_tts", return_value=(b"x" * 2048, alignments, "text/event-stream")), \
                 mock.patch.object(fish, "probe_mp3", return_value={
                    "codec": "mp3", "sample_rate": 44100, "channels": 1,
                    "bitrate": 128000, "duration_seconds": 1.5,
                }) as media_probe:
                generated = fish.run(scene_plan, 1)

            media_probe.assert_called_once()
            self.assertEqual(generated["engine"], "fish.audio")
            self.assertEqual(generated["provider_identity"], identity)
            self.assertEqual(generated["audio_probe"]["sample_rate"], 44100)
            self.assertEqual(generated["audio_probe"]["bitrate"], 128000)
            self.assertEqual(generated["target_date"], "20261103")
            self.assertEqual(generated["plan_sha256"], initialized["script_sha256"])
            self.assertTrue((scene_plan.parent / "audio" / "01.mp3").is_file())
            self.assertTrue((scene_plan.parent / "fish-alignment.json").is_file())
            self.assertTrue((scene_plan.parent / "tts-transport-diagnostics.json").is_file())

            boundaries = scene_plan.parent / "boundaries.json"
            checkpoint.record_success(
                manifest_path, checkpoint_dir, 1,
                scene_plan.parent / "audio" / "01.mp3", boundaries,
                "unit-test-run", scene_plan.parent / "tts-manifest.json",
            )
            saved = json.loads(manifest_path.read_text(encoding="utf-8"))
            self.assertEqual(checkpoint.missing_scenes(saved), [])
            self.assertEqual(
                checkpoint.validate_checkpoint_identity(
                    saved, script, "20261103", fish.VOICE, fish.RATE,
                    "fish-timestamped-stream-v1", identity,
                ),
                [],
            )
            self.assertEqual(checkpoint.validate_checkpoint(saved, checkpoint_dir), [])


if __name__ == "__main__":
    unittest.main()
