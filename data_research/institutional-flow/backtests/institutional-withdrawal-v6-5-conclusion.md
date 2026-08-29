# Institutional Withdrawal v6.5 — Research Conclusion

## Status

v6.5 is complete as a frozen development-sample recovery/reclaim diagnostic.

- Frozen v6.4 durable candidates: 5
- Confirmed reclaim within the pre-registered sessions 4–15 recovery window: 1
- No reclaim within 15 sessions: 4
- Insufficient recovery follow-up: 0

The v6.5 rule was not changed after observing results.

## Main result

The pre-registered recovery/reclaim rule produces a perfect descriptive separation on the already-inspected development sample:

- all four v6.1 `persistent_withdrawal_consistent` candidates: **0/4 reclaimed**;
- the one v6.4 durable candidate later known as `absorbed_or_false_positive`: **1/1 reclaimed**.

This is the first layer in the v6.x research sequence that separates the known 2449 May false failure from all four withdrawal-consistent failures without weakening the earlier failure rules.

## Withdrawal-consistent candidates

None reclaimed the fragile anchor within the 15-session recovery window:

1. 2317 / fragile 2026-06-18 / candidate 2026-06-26
   - post-candidate trough: -12.85% vs fragile anchor
   - maximum rebound from trough: +0.21%
   - end of window: -12.66% vs fragile anchor

2. 2454 / fragile 2026-06-12 / candidate 2026-07-08
   - post-candidate trough: -24.64%
   - maximum rebound from trough: +2.70%
   - end of window: -22.61%

3. 2382 / fragile 2026-06-18 / candidate 2026-07-17
   - post-candidate trough: -25.80%
   - maximum rebound from trough: +8.96%
   - end of window: -20.74%

4. 2449 / fragile 2026-06-18 / candidate 2026-07-14
   - post-candidate trough: -34.04%
   - maximum rebound from trough: +20.64%
   - end of window: -20.42%

Even the withdrawal-consistent cases that experienced meaningful rebounds did not repair the original fragile-anchor structure within the frozen window.

## 2449 May false-failure recovery

The known false promotion behaves differently:

- fragile anchor: 2026-05-22, close 296
- v6.3 candidate failure: 2026-06-08
- post-candidate trough: 2026-06-10, -8.11% vs anchor
- first one-day anchor reclaim: 2026-06-18, session 8
- first confirmed price-repair window: sessions 7–9
- confirmed reclaim date: **2026-06-22, session 9**
- price repair: 2/3 closes at or above the fragile anchor
- supply-relief families in the same window: **foreign relief + ownership-transfer relief**
- Broker relief was not required and remained false
- maximum rebound from trough by reclaim: +24.63%
- end of session-15 window: +14.02% vs fragile anchor

This indicates that the May episode was not merely a temporary pause in a continuing breakdown. Demand returned strongly enough to reclaim the prior fragile structure while two independent supply families eased.

## Interpretation

The v6.x lifecycle is now better described as:

`persistent ownership transfer → fragile distribution → immediate/delayed candidate failure → short durability → recovery/reclaim test`

The important distinction is not whether a failure can last several sessions. v6.4 showed that both genuine withdrawal and the 2449 May absorbed episode can remain broken for 3/3 sessions while supply evidence remains active.

The new discriminator is whether demand subsequently repairs the pre-failure structure while supply pressure meaningfully eases.

In this development sample:

- **failure + no reclaim** is consistent with durable withdrawal pressure;
- **failure + confirmed reclaim** is consistent with repaired absorption / false failure.

## Research decision

Do not tune v6.5 further on these five candidates.

The development sample has now been repeatedly inspected and is no longer suitable for validating any additional threshold refinement. The next meaningful step should be validation rather than another in-sample v6.x threshold layer.

Recommended next phase:

1. freeze the lifecycle rules from v6.0 through v6.5;
2. create a single research-only lifecycle classifier that reproduces those frozen layers without using outcome labels;
3. identify an untouched historical or forward TDCC period with adequate Broker, foreign-flow, and OHLCV coverage;
4. run walk-forward / untouched validation on a broader stock universe;
5. measure sensitivity, specificity, precision, false-reclaim rate, time-to-failure, and time-to-reclaim;
6. only after untouched validation decide whether any portion of the lifecycle is suitable for production monitoring.

The current perfect 4-vs-1 separation is promising, but because it occurs in a heavily inspected development sample it must not be presented as validated predictive performance.

## Safety

Development-sample research only. Historical TDCC remains association-only because original publication timestamps are unknown. No production promotion until untouched or walk-forward validation exists.
