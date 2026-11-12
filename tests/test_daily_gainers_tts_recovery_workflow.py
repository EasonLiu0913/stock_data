import re
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
RENDER_WORKFLOW = ROOT / ".github" / "workflows" / "daily-gainers-date-render-only.yml"
RECOVERY_WORKFLOW = ROOT / ".github" / "workflows" / "daily-gainers-tts-scene-recovery.yml"


class TtsRecoveryWorkflowDiagnosticsTests(unittest.TestCase):
    def test_diagnostics_are_enabled_for_single_attempt_scene_jobs(self):
        workflow = RECOVERY_WORKFLOW.read_text(encoding="utf-8")
        synthesize_job = workflow.split("\n  synthesize:\n", 1)[1].split("\n  sync-status:\n", 1)[0]
        self.assertRegex(synthesize_job, r"(?m)^\s+TAIWAN_STOCK_TTS_MAX_ATTEMPTS:\s*['\"]1['\"]\s*$")
        self.assertRegex(synthesize_job, r"(?m)^\s+TAIWAN_STOCK_TTS_TRANSPORT_DIAGNOSTICS:\s*['\"]1['\"]\s*$")

    def test_payload_free_diagnostics_artifact_is_uploaded_after_any_scene_outcome(self):
        workflow = RECOVERY_WORKFLOW.read_text(encoding="utf-8")
        upload = re.search(
            r"(?ms)^      - name: Upload payload-free TTS transport diagnostics\n(?P<body>.*?)(?=^      - name: |^  sync-status:)",
            workflow,
        )
        self.assertIsNotNone(upload)
        body = upload.group("body")
        self.assertIn("if: always() && env.SCENE_ID != '0'", body)
        self.assertIn("uses: actions/upload-artifact@v7", body)
        self.assertIn("${{ runner.temp }}/scene/tts-transport-diagnostics.json", body)
        self.assertIn("if-no-files-found: warn", body)
        self.assertIn("retention-days: 7", body)
        self.assertNotIn("audio/", body)

    def test_successor_uses_isolated_new_voice_checkpoint_for_write_and_render(self):
        recovery = RECOVERY_WORKFLOW.read_text(encoding="utf-8")
        render = RENDER_WORKFLOW.read_text(encoding="utf-8")
        voice = "fish:0715599c7277458591efda3ff230a51e"
        suffix = "-fish-0715599c7277458591efda3ff230a51e"
        self.assertIn("FISH_TTS_VOICE: " + voice, recovery)
        self.assertIn("FISH_TTS_VOICE: " + voice, render)
        self.assertIn("tts-audio-pending-$candidate" + suffix, recovery)
        self.assertIn("tts-audio-pending-$DATE" + suffix, recovery)
        self.assertIn("HEAD:refs/heads/tts-audio-pending-$DATE" + suffix, recovery)
        render_ref = "tts-audio-pending-${" + "{ inputs.date }}" + suffix
        self.assertIn(render_ref, render)
        self.assertNotIn("fish:e7af89da8abc4fbdacd9a10ab9881933", recovery)
        self.assertNotIn("fish:e7af89da8abc4fbdacd9a10ab9881933", render)
        self.assertNotIn("tts-audio-pending-$DATE\"", recovery)