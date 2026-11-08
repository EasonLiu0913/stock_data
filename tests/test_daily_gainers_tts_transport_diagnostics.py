import asyncio
import sys
import types
import unittest
from pathlib import Path

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


if __name__ == "__main__":
    unittest.main()
