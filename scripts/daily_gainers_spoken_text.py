#!/usr/bin/env python3
"""Normalize spoken dates without altering captions or slide display text."""
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
