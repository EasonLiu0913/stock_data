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


def _split_long(caption, speech, max_chars=MAX_CHARS):
    if len(caption) <= max_chars:
        return [(caption, speech)]
    if caption == speech:
        return [(caption[i:i+max_chars], speech[i:i+max_chars])
                for i in range(0, len(caption), max_chars)]
    # Map an internal caption offset to the equivalent speech position by
    # matching unchanged text. Numbers can expand in the spoken version.
    matcher = SequenceMatcher(None, caption, speech, autojunk=False)
    matches = matcher.get_matching_blocks()
    points = [(0, 0)]
    for block in matches:
        points.extend((block.a + offset, block.b + offset) for offset in range(block.size + 1))
    points.append((len(caption), len(speech)))
    points = sorted(set(points))
    result = []
    cap_offset = speech_offset = 0
    while len(caption) - cap_offset > max_chars:
        target = cap_offset + max_chars
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


def _paired_phrases(caption, speech):
    """Split on caption punctuation only where spoken text has a safe boundary.

    An unmatched boundary is deferred into the next phrase rather than
    producing an empty spoken segment or guessing audio timing.
    """
    if caption == speech:
        return [(part, part) for part in split_phrases(caption)]
    keep = lambda ch: ch not in PUNCT and not ch.isspace()
    cplain = "".join(ch for ch in caption if keep(ch))
    splain = "".join(ch for ch in speech if keep(ch))
    matcher = SequenceMatcher(None, cplain, splain, autojunk=False)
    mapping = {}
    for block in matcher.get_matching_blocks():
        for offset in range(block.size + 1):
            mapping[block.a + offset] = block.b + offset

    def raw_speech_offset(plain_offset):
        if plain_offset == len(splain):
            return len(speech)
        count = 0
        for pos, ch in enumerate(speech):
            if keep(ch):
                count += 1
            if count >= plain_offset:
                end = pos + 1
                while end < len(speech) and speech[end] in PUNCT:
                    end += 1
                return end
        return len(speech)

    result = []
    cap_start = speech_start = 0
    cap_end = 0
    parts = split_phrases(caption)
    for index, part in enumerate(parts):
        cap_end += len(part)
        if index == len(parts) - 1:
            spoken_end = len(speech)
        else:
            plain_cut = sum(keep(ch) for ch in caption[:cap_end])
            if plain_cut not in mapping:
                continue
            spoken_end = raw_speech_offset(mapping[plain_cut])
            if spoken_end <= speech_start or spoken_end >= len(speech):
                continue
        result.append((caption[cap_start:cap_end], speech[speech_start:spoken_end]))
        cap_start, speech_start = cap_end, spoken_end

    if not result or any(not c or not spoken for c, spoken in result):
        raise ValueError("No valid paired semantic phrase boundaries")
    if "".join(c for c, _ in result) != caption or "".join(sp for _, sp in result) != speech:
        raise ValueError("Paired phrase content mismatch")
    return result

def segment_pairs(pairs, max_chars=MAX_CHARS, max_phrases=MAX_PHRASES):
    units = []
    for pair in pairs:
        caption, speech = pair["caption"], pair["speech"]
        for c, spoken in _paired_phrases(caption, speech):
            units.extend(_split_long(c, spoken, max_chars) if len(c) > max_chars else [(c, spoken)])
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
