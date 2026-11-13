#!/usr/bin/env python3
"""Display spoken Chinese percentage phrases as complete Arabic-numeral captions."""
import re

_DIGITS = {
    "零": 0, "〇": 0, "○": 0,
    "一": 1, "二": 2, "兩": 2, "两": 2, "三": 3, "四": 4,
    "五": 5, "六": 6, "七": 7, "八": 8, "九": 9,
}
_SMALL_UNITS = {"十": 10, "百": 100, "千": 1000}
_BIG_UNITS = {"萬": 10_000, "億": 100_000_000, "兆": 1_000_000_000_000}
_CHINESE_NUMBER_CHARS = "零〇○一二兩两三四五六七八九十百千萬億兆點"
_NUMBER = re.compile(
    rf"百分之\s*([0-9]+(?:\.[0-9]+)?|[{_CHINESE_NUMBER_CHARS}]+)"
)


def _chinese_integer(value):
    total = 0
    section = 0
    digit = 0
    for char in value:
        if char in _DIGITS:
            digit = _DIGITS[char]
        elif char in _SMALL_UNITS:
            section += (digit or 1) * _SMALL_UNITS[char]
            digit = 0
        elif char in _BIG_UNITS:
            section += digit
            total += (section or 1) * _BIG_UNITS[char]
            section = 0
            digit = 0
        else:
            return None
    return total + section + digit


def _caption_number(value):
    if not any(char in _DIGITS or char in _SMALL_UNITS or char in _BIG_UNITS or char == "點"
               for char in value):
        return value

    if value.count("點") > 1:
        return None
    whole, separator, fraction = value.partition("點")
    whole_value = _chinese_integer(whole)
    if whole_value is None:
        return None
    if not separator:
        return str(whole_value)

    fraction_digits = []
    for char in fraction:
        if char not in _DIGITS:
            return None
        fraction_digits.append(str(_DIGITS[char]))
    if not fraction_digits:
        return None
    return f"{whole_value}.{''.join(fraction_digits)}"


def normalize_spoken_percentages(text):
    """Convert complete 百分之-number phrases without changing spoken timing text."""
    def replace(match):
        value = _caption_number(match.group(1))
        return f"{value}%" if value is not None else match.group(0)

    return _NUMBER.sub(replace, str(text or ""))
