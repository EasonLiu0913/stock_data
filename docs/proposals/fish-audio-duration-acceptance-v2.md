# Fish Audio duration acceptance change proposal v2

Status: owner-requested, prepared on branch `codex/fish-test-duration-acceptance-v2`; applies only to the isolated Fish Audio timestamped migration test after this change is integrated.

## Evidence

- Current `main` at proposal time: `01944d6a560e46ebd98a2b5d80acf253179c8067`.
- Fish timestamp test run #7 (`42625150916`) synthesized the frozen 20261103 scene 1 successfully and produced a playable MP3 with Fish timestamp alignment coverage 1.0.
- The existing duration assertion failed at 59.925 seconds against the 60–90 second condition. The measured audio is only 75 ms below its lower bound.
- The run remains failed; this proposal does not retroactively reinterpret its result or claim an artifact was uploaded.

## Requested acceptance change

For the isolated Fish migration experiment only, require MP3 duration to be at least 50 seconds, with no upper-duration assertion. Keep the exact frozen scene and all existing provider/model/reference/speed, media format, bitrate, sample rate, channel count, alignment coverage, timeline, artifact-retention, and secret-handling checks.

## Rationale and tradeoff

A 50-second lower bound allows reasonable provider/codec duration variation while still rejecting implausibly short output for this frozen narration. Removing the 90-second ceiling avoids rejecting a valid narration solely because a provider renders it more slowly or with longer pauses. Since this experiment submits one fixed scene per run and has a bounded job timeout, it does not introduce a variable-length production batch.

This change is specific to test evidence. It does not revise the frozen MVP10-A/B criteria, production narration limits, render gates, or publication authorization.

## Verification boundary

The new condition applies only to a new workflow run that checks out the integrated workflow on `main`. Run #7 and its failure evidence remain unchanged. No retry of unchanged inputs is authorized by this proposal.
