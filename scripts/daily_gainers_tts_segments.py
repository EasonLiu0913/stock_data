#!/usr/bin/env python3
"""Research-only, fail-closed helpers for eventual Edge TTS scene segmentation.

No synthesis, publication, audio concatenation, or fabricated timing happens here.
"""
import re

TICKS_PER_SECOND = 10_000_000


def split_spoken_text(text, max_chars=100):
    """Split at natural punctuation, preserving exact input text and order."""
    if not isinstance(text, str) or not text or max_chars < 2 or not any(ch.isalnum() for ch in text):
        raise ValueError("Invalid speech or segment size")
    chunks = re.findall(r"[^。！？!?；;\n]+[。！？!?；;\n]?", text)
    if "".join(chunks) != text:
        raise ValueError("Unable to losslessly segment speech")
    output = []
    for chunk in chunks:
        if len(chunk) > max_chars:
            raise ValueError("Sentence too long for lossless punctuation segmentation")
        if output and len(output[-1]) + len(chunk) <= max_chars:
            output[-1] += chunk
        else:
            output.append(chunk)
    if not output or "".join(output) != text or any(not s.strip() for s in output):
        raise ValueError("Empty or incomplete speech segment")
    return output


def combine_word_boundaries(parts):
    """Shift true Edge word events by measured audio durations, in 100 ns ticks.

    parts: ordered sequence of (duration_seconds, word_boundaries). Caller must
    independently validate MP3s and concatenate precisely the same audio order.
    """
    if not parts:
        raise ValueError("Missing audio segments")
    events = []
    elapsed = 0
    for duration_seconds, boundaries in parts:
        duration_ticks = round(float(duration_seconds) * TICKS_PER_SECOND)
        if duration_ticks <= 0 or not boundaries:
            raise ValueError("Invalid segment duration or missing WordBoundary")
        previous_end = -1
        for item in boundaries:
            offset = item.get("offset")
            duration = item.get("duration")
            word = item.get("text")
            if (not isinstance(offset, int) or isinstance(offset, bool) or
                not isinstance(duration, int) or isinstance(duration, bool) or
                offset < 0 or duration <= 0 or not isinstance(word, str) or not word.strip()):
                raise ValueError("Malformed WordBoundary")
            if offset < previous_end or offset + duration > duration_ticks:
                raise ValueError("Nonmonotonic or out-of-audio WordBoundary")
            events.append({"text": word, "offset": elapsed + offset, "duration": duration})
            previous_end = offset + duration
        elapsed += duration_ticks
    if not events:
        raise ValueError("No verified speech boundaries")
    return events, elapsed / TICKS_PER_SECOND
