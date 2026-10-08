#!/usr/bin/env python3
"""Map TTS word boundaries to caption cues using spoken normalization."""
import re

def chars(text):
    return re.sub(r"[\s，。！？、；：,.!?;:（）()「」『』【】\[\]—-]", "", str(text)).lower()

def align_cues(cues, normalize, boundaries, duration, tolerance=0.10):
    """Return per-cue (start,end), seconds relative to a single audio scene.

    Match Edge TTS word boundaries in sequence to the normalized spoken text.
    Reject uncertain alignment rather than silently revert to length-weighted cues.
    """
    voiced = [chars(normalize(cue)) for cue in cues]
    if not voiced or any(not s for s in voiced):
        raise ValueError("Empty subtitle cue after spoken normalization")
    complete = "".join(voiced)
    positions = []
    index = 0
    for event in boundaries:
        word = chars(event.get("text",""))
        if not word:
            continue
        where = complete.find(word, index)
        if where < 0:
            # Edge might normalize e.g. digits/pronunciation beyond our text;
            # only allow short skips, never arbitrarily reassign an entire cue.
            continue
        start = float(event["offset"]) / 10_000_000
        end = (float(event["offset"]) + float(event.get("duration",0))) / 10_000_000
        positions.append((where,where+len(word),start,end))
        index = where + len(word)
    covered = sum(b-a for a,b,_,_ in positions)
    if covered < len(complete) * (1 - tolerance) or not positions:
        raise ValueError(f"WordBoundary coverage insufficient: {covered}/{len(complete)} characters")
    output = []
    cursor = 0
    for i, cue in enumerate(voiced):
        first, last = cursor,cursor+len(cue)
        inside = [b for b in positions if b[0] < last and b[1] > first]
        if not inside:
            raise ValueError(f"No word boundary for cue {i+1}")
        start = max(0,inside[0][2])
        output.append([start,0])
        cursor = last
    for i in range(len(output)):
        # Cue transitions are positioned at first utterance of the next cue.
        # This prevents a spoken sentence starting before its caption.
        output[i][1] = output[i+1][0] if i+1 < len(output) else duration
        if output[i][1] <= output[i][0]:
            raise ValueError(f"Non-monotonic subtitle alignment at cue {i+1}")
    return output
