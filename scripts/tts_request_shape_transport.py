"""Payload-free WebSocket telemetry for the isolated TTS request-shape study."""
from __future__ import annotations

from collections import Counter
from contextlib import contextmanager
from datetime import datetime, timezone
import time


class RequestCapExceeded(RuntimeError):
    pass


class RequestBudget:
    def __init__(self, limit: int) -> None:
        if limit <= 0:
            raise ValueError("limit must be positive")
        self.limit = limit
        self.used = 0
        self.started = time.monotonic()

    def begin(self) -> int:
        if self.used >= self.limit:
            raise RequestCapExceeded(f"websocket connection cap {self.limit} reached")
        self.used += 1
        return self.used


def _utc_now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="milliseconds").replace("+00:00", "Z")


class RequestShapeObservation:
    def __init__(self, budget: RequestBudget) -> None:
        self.budget = budget
        self.started = time.monotonic()
        self.connections: list[dict] = []
        self.message_counts: Counter[str] = Counter()
        self.message_bytes: Counter[str] = Counter()
        self.audio_bytes = 0
        self.word_boundary_count = 0

    def begin_connection(self) -> dict:
        ordinal = self.budget.begin()
        connection = {
            "global_ordinal": ordinal,
            "started_at_utc": _utc_now(),
            "elapsed_since_experiment_start_ms": round((time.monotonic() - self.budget.started) * 1000),
            "handshake_ms": None,
            "handshake_status": None,
            "message_counts": {},
            "message_bytes": {},
            "close_code": None,
            "transport_error_type": None,
        }
        self.connections.append(connection)
        return connection

    def record_message(self, message: object, connection: dict) -> None:
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
        connection["message_counts"][name] = connection["message_counts"].get(name, 0) + 1
        connection["message_bytes"][name] = connection["message_bytes"].get(name, 0) + size

    def as_dict(self) -> dict:
        return {
            "websocket_connection_attempt_count": len(self.connections),
            "websocket_connection_attempts": self.connections,
            "websocket_message_counts": dict(sorted(self.message_counts.items())),
            "websocket_message_bytes": dict(sorted(self.message_bytes.items())),
            "elapsed_ms": round((time.monotonic() - self.started) * 1000),
            "audio_bytes_yielded": self.audio_bytes,
            "word_boundary_count": self.word_boundary_count,
        }


class _ObservedWebSocket:
    def __init__(self, websocket: object, observation: RequestShapeObservation, connection: dict) -> None:
        self._websocket = websocket
        self._observation = observation
        self._connection = connection
        self._iterator = websocket.__aiter__()

    def __getattr__(self, name: str):
        return getattr(self._websocket, name)

    def __aiter__(self):
        return self

    async def __anext__(self):
        message = await self._iterator.__anext__()
        self._observation.record_message(message, self._connection)
        return message


class _ObservedContext:
    def __init__(self, context: object, observation: RequestShapeObservation, connection: dict) -> None:
        self._context = context
        self._observation = observation
        self._connection = connection
        self._websocket = None

    async def __aenter__(self):
        started = time.monotonic()
        try:
            self._websocket = await self._context.__aenter__()
        except Exception as error:
            self._connection["handshake_ms"] = round((time.monotonic() - started) * 1000)
            self._connection["transport_error_type"] = type(error).__name__
            raise
        self._connection["handshake_ms"] = round((time.monotonic() - started) * 1000)
        response = getattr(self._websocket, "_response", None)
        self._connection["handshake_status"] = getattr(response, "status", None)
        return _ObservedWebSocket(self._websocket, self._observation, self._connection)

    async def __aexit__(self, exc_type, exc, traceback):
        try:
            return await self._context.__aexit__(exc_type, exc, traceback)
        finally:
            if self._websocket is not None:
                code = getattr(self._websocket, "close_code", None)
                self._connection["close_code"] = code if isinstance(code, int) else None
            if exc is not None and self._connection["transport_error_type"] is None:
                self._connection["transport_error_type"] = type(exc).__name__


class _ObservedSession:
    def __init__(self, session: object, observation: RequestShapeObservation) -> None:
        self._session = session
        self._observation = observation

    async def __aenter__(self):
        await self._session.__aenter__()
        return self

    async def __aexit__(self, exc_type, exc, traceback):
        return await self._session.__aexit__(exc_type, exc, traceback)

    def ws_connect(self, *args, **kwargs):
        connection = self._observation.begin_connection()
        return _ObservedContext(self._session.ws_connect(*args, **kwargs), self._observation, connection)


class _AiohttpProxy:
    def __init__(self, aiohttp_module: object, observation: RequestShapeObservation) -> None:
        self._aiohttp_module = aiohttp_module
        self._observation = observation

    def __getattr__(self, name: str):
        if name == "ClientSession":
            original = getattr(self._aiohttp_module, name)

            def observed_session(*args, **kwargs):
                return _ObservedSession(original(*args, **kwargs), self._observation)

            return observed_session
        return getattr(self._aiohttp_module, name)


@contextmanager
def observe(communicate_module: object, observation: RequestShapeObservation):
    original = communicate_module.aiohttp
    communicate_module.aiohttp = _AiohttpProxy(original, observation)
    try:
        yield
    finally:
        communicate_module.aiohttp = original
