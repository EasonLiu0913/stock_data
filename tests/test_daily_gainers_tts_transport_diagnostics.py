import json
import runpy
import sys
import tempfile
import types
import unittest
from contextlib import ExitStack
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))

from daily_gainers_tts_transport_diagnostics import (  # noqa: E402
    TransportObservation,
    observe_communicate_transport,
)


class _Message:
    def __init__(self, name, data):
        self.type = types.SimpleNamespace(name=name)
        self.data = data


class _WebSocket:
    def __init__(self, messages, close_code=1000):
        self._response = types.SimpleNamespace(status=101)
        self.close_code = close_code
        self.messages = messages

    def __aiter__(self):
        async def generate():
            for message in self.messages:
                yield message
        return generate()


class _WebSocketContext:
    def __init__(self, websocket):
        self.websocket = websocket

    async def __aenter__(self):
        return self.websocket

    async def __aexit__(self, *_args):
        return False


class _Session:
    def __init__(self, websocket):
        self.websocket = websocket

    async def __aenter__(self):
        return self

    async def __aexit__(self, *_args):
        return False

    def ws_connect(self, *_args, **_kwargs):
        return _WebSocketContext(self.websocket)


class TransportDiagnosticsTests(unittest.IsolatedAsyncioTestCase):
    async def test_captures_handshake_messages_and_close_without_payload(self):
        websocket = _WebSocket([
            _Message("TEXT", "private transcript must not be recorded"),
            _Message("BINARY", b"private audio bytes"),
        ], close_code=1000)
        aiohttp_module = types.SimpleNamespace(
            ClientSession=lambda *_args, **_kwargs: _Session(websocket),
            WSMsgType=object(),
        )
        communicate_module = types.SimpleNamespace(aiohttp=aiohttp_module)
        observation = TransportObservation()

        with observe_communicate_transport(communicate_module, observation):
            async with communicate_module.aiohttp.ClientSession() as session:
                async with session.ws_connect("wss://example.invalid/?secret=redacted") as ws:
                    seen = [message async for message in ws]

        self.assertEqual(len(seen), 2)
        record = observation.as_dict(result="complete")
        self.assertEqual(record["handshake_status"], 101)
        self.assertEqual(record["websocket_close_code"], 1000)
        self.assertEqual(record["websocket_message_counts"], {"BINARY": 1, "TEXT": 1})
        self.assertEqual(record["websocket_message_bytes"], {"BINARY": 19, "TEXT": 39})
        serialized = repr(record)
        self.assertNotIn("private transcript", serialized)
        self.assertNotIn("private audio", serialized)
        self.assertNotIn("secret=", serialized)
        self.assertIs(communicate_module.aiohttp, aiohttp_module)

    async def test_handshake_exception_is_recorded_and_original_module_restored(self):
        class FailedContext:
            async def __aenter__(self):
                raise OSError("sensitive diagnostic text")

        class FailedSession(_Session):
            def ws_connect(self, *_args, **_kwargs):
                return FailedContext()

        aiohttp_module = types.SimpleNamespace(
            ClientSession=lambda *_args, **_kwargs: FailedSession(None),
        )
        communicate_module = types.SimpleNamespace(aiohttp=aiohttp_module)
        observation = TransportObservation()

        with self.assertRaises(OSError):
            with observe_communicate_transport(communicate_module, observation):
                async with communicate_module.aiohttp.ClientSession() as session:
                    async with session.ws_connect("wss://example.invalid"):
                        pass

        record = observation.as_dict(result="error")
        self.assertIsNone(record["handshake_status"])
        self.assertEqual(record["transport_error_type"], "OSError")
        self.assertNotIn("sensitive diagnostic text", repr(record))
        self.assertIs(communicate_module.aiohttp, aiohttp_module)

    async def test_proxy_does_not_change_non_transport_module_attributes(self):
        marker = object()
        aiohttp_module = types.SimpleNamespace(marker=marker, ClientSession=lambda: None)
        communicate_module = types.SimpleNamespace(aiohttp=aiohttp_module)
        with observe_communicate_transport(communicate_module, TransportObservation()):
            self.assertIs(communicate_module.aiohttp.marker, marker)
        self.assertIs(communicate_module.aiohttp, aiohttp_module)


class _FakeAiohttpSession:
    def __init__(self, websocket):
        self.websocket = websocket

    async def __aenter__(self):
        return self

    async def __aexit__(self, *_args):
        return False

    def ws_connect(self, *_args, **_kwargs):
        return _WebSocketContext(self.websocket)


class SynthesisIntegrationTests(unittest.TestCase):
    def _run_synthesizer(self, root, *, fail):
        output = root / "output"
        output.mkdir()
        plan = output / "plan.json"
        plan.write_text(json.dumps({
            "schema_version": 2,
            "scenes": [{"id": 1, "speech_text": "敏感逐字稿測試。"}],
        }, ensure_ascii=False), encoding="utf-8")

        websocket = _WebSocket([
            _Message("TEXT", "敏感逐字稿不可進 diagnostics"),
            _Message("BINARY", "敏感音訊內容不可進 diagnostics".encode("utf-8")),
        ])
        aiohttp_module = types.ModuleType("aiohttp")
        aiohttp_module.__version__ = "test-aiohttp"
        aiohttp_module.ClientSession = lambda *_args, **_kwargs: _FakeAiohttpSession(websocket)
        communicate_module = types.ModuleType("edge_tts.communicate")
        communicate_module.aiohttp = aiohttp_module
        edge_tts_module = types.ModuleType("edge_tts")
        edge_tts_module.__version__ = "test-edge-tts"
        edge_tts_module.communicate = communicate_module

        class FakeNoAudioReceived(Exception):
            pass

        class FakeCommunicate:
            def __init__(self, **_kwargs):
                pass

            async def stream(self):
                async with communicate_module.aiohttp.ClientSession() as session:
                    async with session.ws_connect("wss://fake.invalid/?private=1") as ws:
                        async for _message in ws:
                            pass
                if fail:
                    raise FakeNoAudioReceived("private failure detail")
                yield {"type": "audio", "data": b"x" * 1200}
                yield {"type": "WordBoundary", "text": "敏感逐字稿", "offset": 0, "duration": 100}

        edge_tts_module.Communicate = FakeCommunicate
        modules = {
            "aiohttp": aiohttp_module,
            "edge_tts": edge_tts_module,
            "edge_tts.communicate": communicate_module,
        }
        script = Path(__file__).resolve().parents[1] / "scripts" / "synthesize_daily_gainers_tts.py"
        old_path = list(sys.path)
        sys.path.insert(0, str(script.parent))
        try:
            with ExitStack() as stack:
                stack.enter_context(patch.dict(sys.modules, modules))
                stack.enter_context(patch.dict("os.environ", {
                    "TAIWAN_STOCK_TTS_TRANSPORT_DIAGNOSTICS": "1",
                    "YOUTUBE_TTS_VOICE": "zh-TW-YunJheNeural",
                    "YOUTUBE_TTS_RATE": "+15%",
                }))
                stack.enter_context(patch.object(sys, "argv", [str(script), str(plan)]))
                stack.enter_context(patch("asyncio.sleep", new=lambda *_args, **_kwargs: _immediate_sleep()))
                if fail:
                    with self.assertRaisesRegex(RuntimeError, "Scene 1: Edge TTS failed"):
                        runpy.run_path(str(script), run_name="__main__")
                else:
                    runpy.run_path(str(script), run_name="__main__")
        finally:
            sys.path[:] = old_path
        diagnostics = json.loads((output / "tts-transport-diagnostics.json").read_text(encoding="utf-8"))
        manifest = json.loads((output / "tts-manifest.json").read_text(encoding="utf-8"))
        audio_path = output / "audio" / "01.mp3"
        audio_size = audio_path.stat().st_size if audio_path.is_file() else 0
        return diagnostics, manifest, audio_size

    def test_production_script_records_success_without_leaking_payload(self):
        with tempfile.TemporaryDirectory() as tmp:
            diagnostics, manifest, audio_size = self._run_synthesizer(Path(tmp), fail=False)
        self.assertEqual(len(diagnostics["attempts"]), 1)
        record = diagnostics["attempts"][0]
        self.assertEqual(record["handshake_status"], 101)
        self.assertEqual(record["websocket_close_code"], 1000)
        self.assertEqual(record["audio_bytes_yielded"], 1200)
        self.assertEqual(record["word_boundary_count"], 1)
        self.assertEqual(audio_size, 1200)
        self.assertNotIn("敏感逐字稿", json.dumps(diagnostics, ensure_ascii=False))
        self.assertNotIn("敏感音訊", json.dumps(diagnostics, ensure_ascii=False))
        self.assertNotIn("private=1", json.dumps(diagnostics, ensure_ascii=False))

    def test_production_script_stays_fail_closed_after_transport_failure(self):
        with tempfile.TemporaryDirectory() as tmp:
            diagnostics, manifest, audio_size = self._run_synthesizer(Path(tmp), fail=True)
        self.assertEqual(len(diagnostics["attempts"]), 6)
        self.assertTrue(all(item["outcome"] == "failure" for item in diagnostics["attempts"]))
        self.assertTrue(all(item["transport_error_type"] == "FakeNoAudioReceived" for item in diagnostics["attempts"]))
        serialized = json.dumps(diagnostics, ensure_ascii=False)
        self.assertNotIn("敏感逐字稿", serialized)
        self.assertNotIn("敏感音訊", serialized)
        self.assertNotIn("private=1", serialized)
        self.assertNotIn("private failure detail", serialized)
        self.assertEqual(manifest["scenes"], [])
        self.assertIsNone(manifest["engine"])
        self.assertEqual(audio_size, 0)


async def _immediate_sleep(_delay=None):
    return None


if __name__ == "__main__":
    unittest.main()
