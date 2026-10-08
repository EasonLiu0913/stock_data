#!/usr/bin/env python3
"""Normalize TTS narration without altering captions or slide display text."""
import re
from datetime import date

_DATE = re.compile(
    r"(?<![0-9/])(?:(?P<year>20[0-9]{2})/)?"
    r"(?P<month>0?[1-9]|1[0-2])/(?P<day>0?[1-9]|[12][0-9]|3[01])(?![0-9/])"
)
_DIGITS = "零一二三四五六七八九"


def _spoken_number(number):
    number = int(number)
    if number <= 10:
        return "十" if number == 10 else _DIGITS[number]
    if number < 20:
        return "十" + ("" if number == 10 else _DIGITS[number % 10])
    return _DIGITS[number // 10] + "十" + ("" if number % 10 == 0 else _DIGITS[number % 10])


def normalize_spoken_dates(text):
    """Convert 10/7 to 十月七日, 2026/10/07 to 二零二六年十月七日.

    Applied to TTS and lip-sync only. SRT must retain scene narration.
    """
    def replace(match):
        year = match.group("year")
        month = int(match.group("month"))
        day = int(match.group("day"))
        try:
            date(int(year) if year else 2024, month, day)
        except ValueError:
            return match.group(0)
        prefix = "".join(_DIGITS[int(n)] for n in year) + "年" if year else ""
        return f"{prefix}{_spoken_number(month)}月{_spoken_number(day)}日"

    return _DATE.sub(replace, str(text or ""))


# A slash joining two Chinese concepts means a spoken conjunction, not punctuation.
# Do not rewrite slashes in dates, ratios, stock codes, URLs, or identifiers.
_HAN_SLASH = re.compile(r"(?<=[\\u3400-\\u9fff])\\s*/\\s*(?=[\\u3400-\\u9fff])")
_SPOKEN_PHRASES = {
    "法人/分點": "法人與分點",
    "PCB / CPO": "PCB 與 CPO",
    "PCB/CPO": "PCB 與 CPO",
}


def normalize_spoken_text(text):
    """Prepare spoken narration; keep plan narration unchanged for captions."""
    spoken = normalize_spoken_dates(text)
    for source, replacement in _SPOKEN_PHRASES.items():
        spoken = spoken.replace(source, replacement)
    return _HAN_SLASH.sub("與", spoken)
