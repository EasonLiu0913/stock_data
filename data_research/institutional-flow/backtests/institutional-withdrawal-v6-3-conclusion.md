# Institutional Withdrawal v6.3 — Research Conclusion

## Status

v6.3 is complete as a frozen development-sample delayed-transition diagnostic.

- Fragile events: 10
- Immediate failures preserved from v6.2: 1
- Confirmed delayed failures during sessions 11–20: 4
- No failure within 20 sessions: 1
- Insufficient follow-up: 4

The pre-registered v6.3 thresholds were not changed after observing results.

## Main positive result

All four v6.1 `persistent_withdrawal_consistent` events are now captured by the combined v6.2 + v6.3 lifecycle:

1. 2317 / fragile 2026-06-18 → immediate failure 2026-06-26, session 5.
2. 2454 / fragile 2026-06-12 → delayed failure 2026-07-08, session 17, rebound-failure path.
3. 2382 / fragile 2026-06-18 → delayed failure 2026-07-17, session 19, delayed-breakdown path.
4. 2449 / fragile 2026-06-18 → delayed failure 2026-07-14, session 16, rebound-failure path.

Within this already-inspected development sample, extending the lifecycle from 10 to 20 sessions therefore removes the sensitivity gap identified in v6.2.

## Specificity cost

The improvement is not free.

Of the two v6.1 `absorbed_or_false_positive` cases:

- 2303 / 2026-06-12 remains correctly unconfirmed through 20 sessions.
- 2449 / 2026-05-22 is incorrectly promoted to delayed failure on 2026-06-08 (session 11).

The 2449 false promotion used the rebound-failure path:

- running post-anchor peak gain: +14.36%
- return from anchor at trigger: -2.53%
- drawdown from running peak: -14.77%
- contemporaneous supply confirmation: Broker only

However, the frozen v6.1 20D outcome for this event was +14.53%, so this was a temporary pullback inside an absorbed regime rather than durable absorption failure.

## Interpretation

v6.3 demonstrates that a delayed-transition layer is necessary, but a **single-session rebound-failure trigger is not sufficient**.

The lifecycle picture is now:

`persistent ownership transfer → fragile distribution → absorption/rebound → candidate failure → either durable failure or recovery`

v6.3 can identify the candidate-failure point, but it cannot yet distinguish a durable failure from a temporary shakeout with enough specificity.

## Research decision

Do not retrospectively tighten or relax v6.3.

The next separate hypothesis should test **failure persistence / durability confirmation**. A suitable pre-registered v6.4 study should ask whether a candidate failure remains broken for more than one session before promotion. Candidate concepts include:

1. require price-failure persistence for at least 2 of the next 3 trading sessions;
2. distinguish recovery above the fragile anchor from continued trading below it;
3. require renewed supply confirmation during the persistence window rather than only on the first failure day;
4. compare whether the known false 2449 / 2026-05-22 candidate quickly recovers while 2454, 2382, and 2449 / 2026-06-18 remain structurally weak;
5. preserve the v6.2 immediate failure as a separate high-specificity path.

Any such rule must be a new methodology version and must not modify v6.3 after the fact.

## Safety

Development-sample research only. Historical TDCC remains association-only because original publication timestamps are unknown. No production promotion until an untouched or walk-forward validation sample exists.
