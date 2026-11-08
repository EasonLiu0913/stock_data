"""Opt-in, payload-free transport observations for the pinned Edge TTS client.

The observer wraps only edge_tts.communicate's aiohttp reference while one
request is active. It records transport metadata, never message contents.
"""

from __future__ import annotations

import time
from collections import Counter
from contextlib import contextmanager


class TransportObservation:
    def __init__(self) -> None:
        self.started = time.monotonic()
        self.handshake_started: float | None = None
        self.handshake_ms: int | None = None
        self.handshake_status: int | None = None
        self.message_counts: Counter[str] = Counter()
        self.message_bytes: Counter[str] = Counter()
        self.close_code: int | None = None
        self.transport_error: str | None = None
        self.audio_bytes = 0
        self.word_boundary_count = 0

    def record_message(self, message: object) -> None:
        message_type = getattr(message, "type", "unknown")
        name = getattr(message_type, "name", None) or str(message_type)
        data = getattr(message, "data", b"")
        if isinstance(data, str):
            size = len(data.encode("utf-8"))
        else:
            try:
                size = len(data)
            except TypeError:
                size = 0
        self.message_counts[name] += 1
        self.message_bytes[name] += size

    def as_dict(self, *, result: str) -> dict:
        return {
            "elapsed_ms": round((time.monotonic() - self.started) * 1000),
            "handshake_ms": self.handshake_ms,
            "handshake_status": self.handshake_status,
            "websocket_message_counts": dict(sorted(self.message_counts.items())),
            "websocket_message_bytes": dict(sorted(self.message_bytes.items())),
            "websocket_close_code": self.close_code,
            "transport_error_type": self.transport_error,
            "audio_bytes_yielded": self.audio_bytes,
            "word_boundary_count": self.word_boundary_count,
            "result": result,
        }


class _ObservedWebSocket:
    def __init__(self, websocket: object, observation: TransportObservation) -> None:
        self._websocket = websocket
        self._observation = observation
        self._iterator = websocket.__aiter__()

    def __getattr__(self, name: str):
        return getattr(self._websocket, name)

    def __aiter__(self):
        return self

    async def __anext__(self):
        message = await self._iterator.__anext__()
        self._observation.record_message(message)
        return message


class _ObservedWebSocketContext:
    def __init__(self, context: object, observation: TransportObservation) -> None:
        self._context = context
        self._observation = observation
        self._websocket = None

    async def __aenter__(self):
        self._observation.handshake_started = time.monotonic()
        try:
            self._websocket = await self._context.__aenter__()
        except Exception as error:
            self._observation.handshake_ms = round(
                (time.monotonic() - self._observation.handshake_started) * 1000
            )
            self._observation.transport_error = type(error).__name__
            raise
        self._observation.handshake_ms = round(
            (time.monotonic() - self._observation.handshake_started) * 1000
        )
        response = getattr(self._websocket, "_response", None)
        self._observation.handshake_status = getattr(response, "status", None)
        return _ObservedWebSocket(self._websocket, self._observation)

    async def __aexit__(self, exc_type, exc, traceback):
        try:
            return await self._context.__aexit__(exc_type, exc, traceback)
        finally:
            if self._websocket is not None:
                code = getattr(self._websocket, "close_code", None)
                self._observation.close_code = code if isinstance(code, int) else None
            if exc is not None and self._observation.transport_error is None:
                self._observation.transport_error = type(exc).__name__


class _ObservedSession:
    def __init__(self, session: object, observation: TransportObservation) -> None:
        self._session = session
        self._observation = observation

    async def __aenter__(self):
        await self._session.__aenter__()
        return self

    async def __aexit__(self, exc_type, exc, traceback):
        return await self._session.__aexit__(exc_type, exc, traceback)

    def ws_connect(self, *args, **kwargs):
        return _ObservedWebSocketContext(
            self._session.ws_connect(*args, **kwargs), self._observation
        )


class _AiohttpProxy:
    def __init__(self, aiohttp_module: object, observation: TransportObservation) -> None:
        self._aiohttp_module = aiohttp_module
        self._observation = observation

    def __getattr__(self, name: str):
        if name == "ClientSession":
            original = getattr(self._aiohttp_module, name)

            def observed_client_session(*args, **kwargs):
                return _ObservedSession(original(*args, **kwargs), self._observation)

            return observed_client_session
        return getattr(self._aiohttp_module, name)


@contextmanager
def observe_communicate_transport(communicate_module: object, observation: TransportObservation):
    """Temporarily instrument edge_tts.communicate without changing aiohttp globally."""
    original = communicate_module.aiohttp
    communicate_module.aiohttp = _AiohttpProxy(original, observation)
    try:
        yield
    finally:
        communicate_module.aiohttp = original
