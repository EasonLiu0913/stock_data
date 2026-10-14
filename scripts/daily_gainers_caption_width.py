"""Fail-closed screen-width gate for current V2 captions.

Use measured glyph advances from the final caption font in the render QA.
This conservative preflight counts punctuation and spaces, not only Hanzi.
"""
import unicodedata

MAX_COLUMNS = 26
MAX_CODEPOINTS = 30

def display_columns(text):
    total = 0.0
    for char in text:
        if char in "\\r\\n":
            raise ValueError("Caption must be a single line")
        kind = unicodedata.east_asian_width(char)
        total += 1.0 if kind in ("F", "W", "A") else 0.65
    return total

def check_caption(text, max_columns=MAX_COLUMNS):
    if not isinstance(text, str) or not text:
        raise ValueError("Empty caption")
    if len(text) > MAX_CODEPOINTS:
        raise ValueError("Caption exceeds code-point budget including punctuation")
    width = display_columns(text)
    if width > max_columns:
        raise ValueError(f"Caption exceeds conservative width budget: {width:.2f}/{max_columns}")
    if text[0] in "，。！？；、：,!?;:":
        raise ValueError("Orphan leading punctuation")
    return width
