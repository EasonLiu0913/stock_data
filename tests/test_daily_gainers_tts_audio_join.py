#!/usr/bin/env python3
"""Offline codec plumbing tests with synthetic tones, NOT generated speech."""
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
from daily_gainers_tts_audio_join import join_verified_mp3


class Mp3JoinTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)

    def tone(self, filename, hz):
        path = self.root / filename
        subprocess.run([
            "ffmpeg", "-nostdin", "-hide_banner", "-loglevel", "error", "-y",
            "-f", "lavfi", "-i", f"sine=frequency={hz}:duration=0.45",
            "-c:a", "libmp3lame", "-b:a", "128k", str(path)
        ], check=True)
        return path

    @staticmethod
    def events(word):
        # Only synthetic fixture values. Real media must carry actual events.
        return [{"text": word, "offset": 500000, "duration": 1300000}]

    def test_join_real_mp3_bytes_and_offsets(self):
        left = self.tone("left.mp3", 440)
        right = self.tone("right.mp3", 660)
        result = self.root / "joined.mp3"
        metadata = join_verified_mp3(
            [(left, self.events("甲")), (right, self.events("乙"))], result)
        self.assertTrue(result.is_file())
        self.assertGreater(result.stat().st_size, 1000)
        self.assertEqual(metadata["segments"], 2)
        self.assertEqual([x["text"] for x in metadata["word_boundaries"]], ["甲", "乙"])
        self.assertGreater(metadata["word_boundaries"][1]["offset"], 4000000)
        self.assertLessEqual(
            abs(metadata["duration_seconds"] - metadata["source_duration_seconds"]), 0.085)

    def test_missing_word_boundaries_refuse_output(self):
        source = self.tone("valid.mp3", 440)
        result = self.root / "bad.mp3"
        with self.assertRaises(ValueError):
            join_verified_mp3([(source, [])], result)
        self.assertFalse(result.exists())

    def test_invalid_mp3_refuse_output(self):
        bad = self.root / "invalid.mp3"
        bad.write_bytes(b"not audio" * 40)
        result = self.root / "bad.mp3"
        with self.assertRaises((ValueError, subprocess.CalledProcessError)):
            join_verified_mp3([(bad, self.events("甲"))], result)
        self.assertFalse(result.exists())

    def test_input_output_alias_rejected(self):
        source = self.tone("source.mp3", 440)
        with self.assertRaises(ValueError):
            join_verified_mp3([(source, self.events("甲"))], source)

    def test_out_of_range_boundary_rejected(self):
        source = self.tone("source.mp3", 440)
        output = self.root / "bad.mp3"
        with self.assertRaises(ValueError):
            join_verified_mp3([(source, [{"text": "甲", "offset": 9000000,
                                         "duration": 3000000}])], output)
        self.assertFalse(output.exists())


if __name__ == "__main__":
    unittest.main()
