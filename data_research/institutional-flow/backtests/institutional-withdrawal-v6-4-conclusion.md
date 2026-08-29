# Institutional Withdrawal v6.4 — Research Conclusion

## Status

v6.4 is complete as a frozen development-sample durability diagnostic.

- Existing frozen v6.3 failure candidates: 5
- Durable confirmations under the pre-registered 2-of-3 rule: 5
- Candidate failures rejected as non-durable: 0
- Insufficient persistence follow-up: 0

The v6.4 rule was not changed after observing outcomes.

## Main result

The 3-session persistence rule does **not** improve specificity.

All four known v6.1 `persistent_withdrawal_consistent` cases remain durable:

1. 2317 / fragile 2026-06-18 / candidate 2026-06-26 — broken 3/3, supply 3/3.
2. 2454 / fragile 2026-06-12 / candidate 2026-07-08 — broken 3/3, supply 3/3.
3. 2382 / fragile 2026-06-18 / candidate 2026-07-17 — broken 3/3, supply 3/3.
4. 2449 / fragile 2026-06-18 / candidate 2026-07-14 — broken 2/3, supply 3/3.

However, the known false promotion also remains durable:

- 2449 / fragile 2026-05-22 / candidate 2026-06-08 — broken 3/3, supply 3/3, despite its frozen v6.1 outcome being `absorbed_or_false_positive`.

## Interpretation

The false 2449 May episode is not merely a one-session shakeout. It can sustain several sessions of apparent price failure while supply evidence remains active, and then recover later.

Therefore this lifecycle cannot be separated reliably by a short persistence rule alone:

`candidate failure → 2-of-3 broken sessions + supply`

Both durable withdrawal cases and the known absorbed false-positive satisfy it.

This is an important negative result: **short-horizon persistence is not the missing discriminator.**

## Research decision

Do not retrospectively lengthen or tighten v6.4.

The next distinct hypothesis should study **recovery / reclaim behavior after candidate failure**, rather than merely requiring more broken days. A suitable v6.5 study should pre-register a recovery-state diagnostic such as:

1. follow candidate failures beyond the 3-session persistence window;
2. measure whether price reclaims the fragile anchor and how quickly;
3. measure recovery toward the post-anchor running peak or prior failure zone;
4. distinguish persistent supply from supply that disappears during recovery;
5. test whether the false 2449 / 2026-05-22 episode shows a materially faster or stronger reclaim than the four withdrawal-consistent cases;
6. preserve all v6.2/v6.3/v6.4 rules as frozen historical layers.

The key next question is no longer whether the failure lasts a few days, but whether **demand returns strongly enough to repair the failed structure**.

## Safety

Development-sample research only. Historical TDCC remains association-only because original publication timestamps are unknown. No production promotion until untouched or walk-forward validation exists.
