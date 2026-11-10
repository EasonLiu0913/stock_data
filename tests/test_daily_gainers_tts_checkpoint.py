import json
import sys
import subprocess
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

    def initialize(self, voice="zh-TW-YunJheNeural", rate="+15%", provider_identity=None):
        return checkpoint.initialize(
            self.script, "20261104", self.manifest, self.audio_dir,
            voice, rate, "7.3.1", provider_identity=provider_identity
        )

    def record_scene(self, scene_id, provider_identity=None, generated_provider_identity="use-expected", boundary_duration=2500000):
        audio = self.root / f"generated-{scene_id}.mp3"
        audio.write_bytes(bytes([scene_id]) * 2048)
        text = "第一段內容。" if scene_id == 1 else "第二段內容。"
        generated = self.root / f"generated-{scene_id}.json"
        scene = {
            "id": scene_id,
            "engine": "fish.audio" if provider_identity else "edge-tts",
            "spoken_text": text,
            "word_boundaries": [
                {"text": "內容", "offset": 0, "duration": boundary_duration}
            ],
            "sha256": checkpoint.sha256_file(audio),
        }
        generated_doc = {
            "voice": f"fish:{provider_identity['reference_id']}" if provider_identity else "zh-TW-YunJheNeural",
            "rate": f"speed={provider_identity['prosody_speed']}" if provider_identity else "+15%",
            "engine": "fish.audio" if provider_identity else "edge-tts",
            "pipeline_version": provider_identity["pipeline_version"] if provider_identity else checkpoint.PIPELINE_VERSION,
            "target_date": "20261104",
            "plan_sha256": checkpoint.sha256_file(self.script),
            "scenes": [scene],
        }
        if provider_identity:
            scene["provider"] = "fish.audio"
            generated_doc["provider_identity"] = (
                provider_identity if generated_provider_identity == "use-expected"
                else generated_provider_identity
            )
        generated.write_text(json.dumps(generated_doc, ensure_ascii=False), encoding="utf-8")
        boundaries = self.root / f"boundaries-{scene_id}.json"
        boundaries.write_text(json.dumps(scene["word_boundaries"], ensure_ascii=False), encoding="utf-8")
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

    def test_plan_returns_all_missing_and_invalid_scenes_in_order(self):
        scenes = [
            {
                "id": scene_id,
                "scene_type": "stock_list" if scene_id < 8 else "closing_summary",
                "narration": "第一段內容。" if scene_id == 1 else "第二段內容。",
            }
            for scene_id in range(1, 9)
        ]
        self.write_script(scenes)
        self.initialize()
        self.record_scene(1)
        self.record_scene(2)
        (self.audio_dir / "audio" / "02.mp3").write_bytes(b"corrupt")
        current = self.initialize()
        self.assertEqual(
            [item["status"] for item in current["scenes"]],
            ["success"] + ["pending"] * 7,
        )

        command = [
            sys.executable,
            str(Path(__file__).resolve().parents[1] / "scripts" / "daily_gainers_tts_checkpoint.py"),
            "plan",
            "--manifest", str(self.manifest),
            "--checkpoint-dir", str(self.audio_dir),
        ]
        result = subprocess.run(command, check=True, capture_output=True, text=True)
        self.assertEqual(json.loads(result.stdout)["scene_ids"], [2, 3, 4, 5, 6, 7, 8])

    def test_edge_checkpoint_is_not_reusable_for_fish_identity(self):
        fish = {
            "provider": "fish.audio",
            "endpoint": "https://api.fish.audio/v1/tts/stream/with-timestamp",
            "model": "s2.1-pro-free",
            "reference_id": "e7af89da8abc4fbdacd9a10ab9881933",
            "prosody_speed": 1.15,
            "format": "mp3",
            "sample_rate": 44100,
            "mp3_bitrate": 128,
            "normalize": False,
            "language": "zh-TW",
            "parser_version": "fish-timestamp-parser-v1",
            "pipeline_version": "fish-audio-timestamp-parser-v1",
        }
        self.record_scene(1)
        current = self.initialize(voice="fish:e7af89da8abc4fbdacd9a10ab9881933", rate="speed=1.15", provider_identity=fish)
        self.assertEqual(checkpoint.missing_scenes(current), [1, 2])
        self.assertEqual(current["engine"], "fish.audio")
        self.assertEqual(current["scenes"][0]["status"], "pending")

    def test_fish_fingerprint_binds_frozen_script_sha(self):
        fish = {
            "provider": "fish.audio",
            "endpoint": "https://api.fish.audio/v1/tts/stream/with-timestamp",
            "model": "s2.1-pro-free",
            "reference_id": "e7af89da8abc4fbdacd9a10ab9881933",
            "prosody_speed": 1.15,
            "format": "mp3",
            "sample_rate": 44100,
            "mp3_bitrate": 128,
            "normalize": False,
            "language": "zh-TW",
            "parser_version": "fish-timestamp-parser-v1",
            "pipeline_version": "fish-audio-timestamp-parser-v1",
        }
        voice = f"fish:{fish['reference_id']}"
        self.initialize(voice=voice, rate="speed=1.15", provider_identity=fish)
        self.record_scene(1, provider_identity=fish)
        previous = self.initialize(voice=voice, rate="speed=1.15", provider_identity=fish)
        self.write_script([
            {"id": 1, "scene_type": "stock_list_revised", "narration": "第一段內容。"},
            {"id": 2, "scene_type": "closing_summary", "narration": "第二段內容。"},
        ])
        current = self.initialize(voice=voice, rate="speed=1.15", provider_identity=fish)
        self.assertEqual(current["scenes"][0]["identity"]["normalized_text_sha256"],
                         previous["scenes"][0]["identity"]["normalized_text_sha256"])
        self.assertNotEqual(current["scenes"][0]["fingerprint"], previous["scenes"][0]["fingerprint"])
        self.assertEqual(checkpoint.missing_scenes(current), [1, 2])

    def test_matching_fish_provider_checkpoint_is_reusable_and_validates(self):
        fish = {
            "provider": "fish.audio",
            "endpoint": "https://api.fish.audio/v1/tts/stream/with-timestamp",
            "model": "s2.1-pro-free",
            "reference_id": "e7af89da8abc4fbdacd9a10ab9881933",
            "prosody_speed": 1.15,
            "format": "mp3",
            "sample_rate": 44100,
            "mp3_bitrate": 128,
            "normalize": False,
            "language": "zh-TW",
            "parser_version": "fish-timestamp-parser-v1",
            "pipeline_version": "fish-audio-timestamp-parser-v1",
        }
        initialized = self.initialize(voice=f"fish:{fish['reference_id']}", rate="speed=1.15", provider_identity=fish)
        self.assertEqual(initialized["pipeline_version"], checkpoint.PIPELINE_VERSION)
        self.assertEqual(initialized["provider_identity"]["pipeline_version"], fish["pipeline_version"])
        self.record_scene(1, provider_identity=fish)
        self.record_scene(2, provider_identity=fish)
        current = self.initialize(voice=f"fish:{fish['reference_id']}", rate="speed=1.15", provider_identity=fish)
        self.assertEqual(checkpoint.missing_scenes(current), [])
        self.assertEqual(checkpoint.validate_checkpoint(current, self.audio_dir), [])

    def test_fish_provider_identity_change_invalidates_only_affected_audio(self):
        fish = {
            "provider": "fish.audio",
            "endpoint": "https://api.fish.audio/v1/tts/stream/with-timestamp",
            "model": "s2.1-pro-free",
            "reference_id": "e7af89da8abc4fbdacd9a10ab9881933",
            "prosody_speed": 1.15,
            "format": "mp3",
            "sample_rate": 44100,
            "mp3_bitrate": 128,
            "normalize": False,
            "language": "zh-TW",
            "parser_version": "fish-timestamp-parser-v1",
            "pipeline_version": "fish-audio-timestamp-parser-v1",
        }
        self.initialize(voice="fish:e7af89da8abc4fbdacd9a10ab9881933", rate="speed=1.15", provider_identity=fish)
        self.record_scene(1, provider_identity=fish)
        changed = {**fish, "prosody_speed": 1.1}
        current = self.initialize(voice="fish:e7af89da8abc4fbdacd9a10ab9881933", rate="speed=1.1", provider_identity=changed)
        self.assertEqual(checkpoint.missing_scenes(current), [1, 2])

    def test_fish_record_success_requires_exact_provider_identity(self):
        fish = {
            "provider": "fish.audio",
            "endpoint": "https://api.fish.audio/v1/tts/stream/with-timestamp",
            "model": "s2.1-pro-free",
            "reference_id": "e7af89da8abc4fbdacd9a10ab9881933",
            "prosody_speed": 1.15,
            "format": "mp3",
            "sample_rate": 44100,
            "mp3_bitrate": 128,
            "normalize": False,
            "language": "zh-TW",
            "parser_version": "fish-timestamp-parser-v1",
            "pipeline_version": "fish-audio-timestamp-parser-v1",
        }
        self.initialize(voice="fish:e7af89da8abc4fbdacd9a10ab9881933", rate="speed=1.15", provider_identity=fish)
        with self.assertRaisesRegex(ValueError, "GENERATED_PROVIDER_IDENTITY_MISMATCH"):
            self.record_scene(1, provider_identity=fish, generated_provider_identity={**fish, "prosody_speed": 1.1})
        self.assertFalse((self.audio_dir / "audio" / "01.mp3").exists())

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

    def test_fish_zero_duration_wordboundary_is_durable_and_reusable(self):
        fish = {
            "provider": "fish.audio",
            "endpoint": "https://api.fish.audio/v1/tts/stream/with-timestamp",
            "model": "s2.1-pro-free",
            "reference_id": "e7af89da8abc4fbdacd9a10ab9881933",
            "prosody_speed": 1.15,
            "format": "mp3",
            "sample_rate": 44100,
            "mp3_bitrate": 128,
            "normalize": False,
            "language": "zh-TW",
            "parser_version": "fish-audio-timestamp-stream-v1",
            "pipeline_version": "daily-gainers-fish-tts-v1",
        }
        voice = f"fish:{fish['reference_id']}"
        rate = "speed=1.15"
        self.initialize(voice=voice, rate=rate, provider_identity=fish)
        self.record_scene(1, provider_identity=fish, boundary_duration=0)
        self.record_scene(2, provider_identity=fish, boundary_duration=0)

        current = json.loads(self.manifest.read_text(encoding="utf-8"))
        self.assertEqual(checkpoint.missing_scenes(current), [])
        self.assertEqual(checkpoint.validate_checkpoint(current, self.audio_dir), [])
        self.assertTrue(checkpoint.boundary_valid(
            [{"text": "內容", "offset": 0, "duration": 0}],
            allow_zero_duration=True,
        ))
        self.assertFalse(checkpoint.boundary_valid(
            [{"text": "內容", "offset": 0, "duration": 0}],
        ))
        self.assertFalse(checkpoint.boundary_valid(
            [{"text": "內容", "offset": 0, "duration": -1}],
            allow_zero_duration=True,
        ))

        reused = self.initialize(voice=voice, rate=rate, provider_identity=fish)
        self.assertEqual(checkpoint.missing_scenes(reused), [])
        self.assertEqual([item["status"] for item in reused["scenes"]], ["success", "success"])

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


class TtsRecoveryWorkflowContractTests(unittest.TestCase):
    def read_head(self, path):
        return subprocess.run(
            ["git", "show", f"HEAD:{path}"],
            check=True, capture_output=True, text=True
        ).stdout

    def test_fresh_scene_runner_uses_fish_once_without_edge_fallback(self):
        workflow = self.read_head(".github/workflows/daily-gainers-tts-scene-recovery.yml")
        synth = self.read_head("scripts/synthesize_daily_gainers_fish_tts.py")
        self.assertIn("  synthesize:\n", workflow)
        self.assertIn("max-parallel: 1", workflow)
        self.assertNotIn("--limit", workflow)
        self.assertIn("fail-fast: false", workflow)
        self.assertIn("synthesize_daily_gainers_fish_tts.py --plan", workflow)
        self.assertNotIn("edge-tts==", workflow)
        self.assertNotIn("synthesize_daily_gainers_tts.py", workflow)
        self.assertEqual(workflow.count("FISH_API_KEY: ${{ secrets.FISH_API_KEY }}"), 1)
        synthesize = workflow.split("  synthesize:\n", 1)[1].split("\n  sync-status:\n", 1)[0]
        self.assertIn("FISH_API_KEY: ${{ secrets.FISH_API_KEY }}", synthesize)
        self.assertEqual(synth.count("request_tts(spoken_text, api_key)"), 1)
        self.assertNotIn("edge-tts", synth)
        self.assertIn("Fish Audio transport failed", synth)

    def test_render_only_validates_existing_checkpoint_without_api_or_mutating_init(self):
        workflow = self.read_head(".github/workflows/daily-gainers-date-render-only.yml")
        render = workflow.split("Restore and validate durable cross-run TTS checkpoint", 1)[1]
        self.assertIn("daily_gainers_tts_checkpoint.py validate", render)
        self.assertIn("--provider-identity", render)
        self.assertNotIn("daily_gainers_tts_checkpoint.py init", render)
        self.assertNotIn("FISH_API_KEY", workflow)
        self.assertNotIn("secrets.FISH_API_KEY", workflow)
        self.assertNotIn("synthesize_daily_gainers_fish_tts.py --plan", render)
        self.assertIn('"engine":source["engine"]', render)

    def test_fifo_resolver_skips_only_dates_with_valid_complete_checkpoints(self):
        workflow = self.read_head(".github/workflows/daily-gainers-tts-scene-recovery.yml")
        candidates = workflow.split("      - name: Enumerate FIFO TTS date candidates", 1)[1].split(
            "      - name: Resolve FIFO target date from validated checkpoints", 1
        )[0]
        resolver = workflow.split("      - name: Resolve FIFO target date from validated checkpoints", 1)[1].split(
            "      - name: Re-run formal script and news gates", 1
        )[0]

        self.assertIn("sort | paste -sd' ' -", candidates)
        self.assertIn('if [ -n "$REQUESTED_DATE" ]', resolver)
        self.assertIn('date="$REQUESTED_DATE"', resolver)
        self.assertIn('for candidate in $CANDIDATE_DATES', resolver)
        self.assertIn("git ls-remote --heads origin", resolver)
        self.assertIn("git archive", resolver)
        self.assertIn("daily_gainers_tts_checkpoint.py validate", resolver)
        self.assertIn("--provider-identity", resolver)
        self.assertIn("if validation_output=", resolver)
        self.assertIn('Skipping completed FIFO date $candidate', resolver)
        self.assertIn('Selecting earliest incomplete date $candidate', resolver)
        self.assertIn("Every candidate has a validated complete checkpoint", resolver)
        self.assertNotIn("daily_gainers_tts_checkpoint.py init", resolver)
        self.assertLess(workflow.index("Resolve FIFO target date from validated checkpoints"),
                        workflow.index("Re-run formal script and news gates"))

    def test_srt_builder_accepts_only_explicit_fish_provider_manifest(self):
        srt = self.read_head("scripts/build_daily_gainers_srt.py")
        self.assertIn('tts_engine not in ("edge-tts", "fish.audio")', srt)
        self.assertIn('tts_manifest["provider_identity"].get("provider") != "fish.audio"', srt)
        self.assertIn('tts_scene.get("engine") != tts_engine', srt)
        self.assertIn('"Fish Audio timestamp alignment + synthesized MP3 durations"', srt)
        self.assertIn('"Edge TTS actual WordBoundary offsets + synthesized MP3 durations"', srt)


if __name__ == "__main__":
    unittest.main()
