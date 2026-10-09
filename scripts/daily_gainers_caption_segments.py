"""Build single-line caption cues from paired display/spoken text.

Punctuation is the primary boundary; each timed caption holds at most three
phrases and 30 visible characters. The spoken counterpart is split at matching
punctuation, preserving speech/caption equivalence.
"""
import re
from difflib import SequenceMatcher

PUNCT = "，。！？；、：,!?;:"
MAX_CHARS = 30
MAX_PHRASES = 3


def split_phrases(value):
    return [piece for piece in re.findall(r"[^，。！？；、：,!?;:]*[，。！？；、：,!?;:]?|[^，。！？；、：,!?;:]+", value) if piece]


def _split_long(caption, speech):
    if len(caption) <= MAX_CHARS:
        return [(caption, speech)]
    # Map an internal caption offset to the equivalent speech position by
    # matching unchanged text. Numbers can expand in the spoken version.
    matcher = SequenceMatcher(None, caption, speech, autojunk=False)
    matches = matcher.get_matching_blocks()
    points = [(0, 0)]
    for block in matches:
        points.extend([(block.a, block.b), (block.a + block.size, block.b + block.size)])
    points.append((len(caption), len(speech)))
    points = sorted(set(points))
    result = []
    cap_offset = speech_offset = 0
    while len(caption) - cap_offset > MAX_CHARS:
        target = cap_offset + MAX_CHARS
        # Select a corresponding boundary from equal runs, preventing a cut
        # through numbers that are pronounced differently from their caption.
        options = [(a, b) for a, b in points if cap_offset < a <= target and b > speech_offset]
        if not options:
            raise ValueError("Cannot safely split long caption across transformed speech tokens")
        boundary, spoken_boundary = max(options)
        result.append((caption[cap_offset:boundary], speech[speech_offset:spoken_boundary]))
        cap_offset, speech_offset = boundary, spoken_boundary
    result.append((caption[cap_offset:], speech[speech_offset:]))
    return result


def segment_pairs(pairs, max_chars=MAX_CHARS, max_phrases=MAX_PHRASES):
    units = []
    for pair in pairs:
        caption, speech = pair["caption"], pair["speech"]
        cparts, sparts = split_phrases(caption), split_phrases(speech)
        if len(cparts) != len(sparts):
            raise ValueError("Caption and speech punctuation boundaries differ")
        for c, s in zip(cparts, sparts):
            if not c or not s:
                raise ValueError("Empty paired phrase")
            if c[-1] in PUNCT and (not s or s[-1] != c[-1]):
                raise ValueError("Caption/speech punctuation mismatch")
            units.extend(_split_long(c, s) if len(c) > max_chars else [(c, s)])
    out = []
    current_c = current_s = ""
    count = 0
    for c, s in units:
        if current_c and (len(current_c) + len(c) > max_chars or count >= max_phrases):
            out.append({"caption": current_c, "speech": current_s})
            current_c = current_s = ""
            count = 0
        current_c += c
        current_s += s
        count += 1
    if current_c:
        out.append({"caption": current_c, "speech": current_s})
    if "".join(x["caption"] for x in out) != "".join(x["caption"] for x in pairs):
        raise ValueError("Caption lost text in segmentation")
    if "".join(x["speech"] for x in out) != "".join(x["speech"] for x in pairs):
        raise ValueError("Speech lost text in segmentation")
    if any(len(x["caption"]) > max_chars or "\n" in x["caption"] for x in out):
        raise ValueError("A caption exceeds the single-line limit")
    return out
