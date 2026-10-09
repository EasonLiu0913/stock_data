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
    """Find caption punctuation cuts against spoken text, without requiring
    identical punctuation counts (speech normalization may differ)."""
    if caption == speech:
        return [(part, part) for part in split_phrases(caption)]
    # Compare strings without punctuation for stable correspondences; source
    # punctuation remains attached to the caption and speech independently.
    import unicodedata
    def normalize_char(ch):
        return ch not in PUNCT and not ch.isspace()
    cplain = "".join(ch for ch in caption if normalize_char(ch))
    splain = "".join(ch for ch in speech if normalize_char(ch))
    # Only use exact common regions for boundaries; never split the expansion
    # of a numerical token (e.g. 5% -> 百分之五).
    matcher = SequenceMatcher(None, cplain, splain, autojunk=False)
    mapping = {0: 0, len(cplain): len(splain)}
    for block in matcher.get_matching_blocks():
        for offset in range(block.size + 1):
            mapping[block.a + offset] = block.b + offset
    caption_parts = split_phrases(caption)
    result = []
    cpos = spos = 0
    for idx, part in enumerate(caption_parts):
        cnext = cpos + len(part)
        if idx == len(caption_parts) - 1:
            snext = len(speech)
        else:
            plain_cut = sum(normalize_char(ch) for ch in caption[:cnext])
            if plain_cut not in mapping:
                # A punctuation split inside transformed speech cannot be
                # reliably aligned; retain it with the following phrase.
                result.append((part, ""))
                cpos = cnext
                continue
            spoken_plain_cut = mapping[plain_cut]
            snext = 0
            visible = 0
            for j, ch in enumerate(speech):
                if normalize_char(ch):
                    visible += 1
                if visible >= spoken_plain_cut:
                    snext = j + 1
                    break
            while snext < len(speech) and speech[snext] in PUNCT:
                snext += 1
            snext = max(spos, snext)
        result.append((part, speech[spos:snext]))
        cpos, spos = cnext, snext
    # Merge punctuation fragments whose speech split is unresolvable.
    merged = []
    for c, spoken in result:
        if not spoken and merged:
            merged[-1] = (merged[-1][0] + c, merged[-1][1])
        else:
            merged.append((c, spoken))
    if not merged or any(not c or not sp for c, sp in merged):
        raise ValueError("Unalignable speech/caption semantic phrase")
    if "".join(c for c, _ in merged) != caption or "".join(sp for _, sp in merged) != speech:
        raise ValueError("Paired phrase content mismatch")
    return merged


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
