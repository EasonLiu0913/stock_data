# Institutional Withdrawal v6.2 — Research Conclusion

## Status

v6.2 is complete as a frozen development-sample diagnostic.

- Fragile events: 10
- Confirmed failure transitions within the pre-registered 10-session window: 1
- No failure within 10 sessions: 6
- Insufficient follow-up: 3

The v6.2 rule was **not** relaxed after observing outcomes.

## Main finding

The pre-registered rule is highly specific but low-sensitivity.

The only confirmed transition is:

- **2317 / fragile anchor 2026-06-18 → failure transition 2026-06-26 (5 sessions)**
- price from anchor: -7.45%
- trigger: price breakdown + foreign supply + persistent TDCC ownership transfer + Broker pressure

This is the cleanest observed example of supply continuing while price absorption fails.

## Important negative result

Three v6.1 events classified as `persistent_withdrawal_consistent` did **not** trigger v6.2 within 10 sessions:

- 2454 / 2026-06-12
- 2382 / 2026-06-18
- 2449 / 2026-06-18

Their v6.1 20D outcomes were materially weak, but the weakness was not captured by the frozen 10-session price-failure + contemporaneous-supply rule.

This suggests that institutional distribution can pass through an intermediate absorption/rebound period before demand finally weakens. A short, continuously-confirmed supply window is therefore insufficient to describe all persistent-withdrawal cases.

## False-positive behavior

Neither of the two v6.1 `absorbed_or_false_positive` cases triggered v6.2:

- 2303 / 2026-06-12
- 2449 / 2026-05-22

That is directionally useful: the stricter transition rule did not promote these absorbed cases to failure.

## 2449 interpretation

For 2449:

- 2026-05-22 fragile distribution: no v6.2 failure within 10 sessions; later classified by v6.1 as absorbed/false-positive.
- 2026-06-18 fragile distribution: no v6.2 failure within 10 sessions even though the 20D outcome later became -12.32%.
- 2026-08-21: insufficient future follow-up.

The June episode is the key limitation of v6.2: the market continued to absorb/rebound during the first 10 sessions, then weakened later. This supports studying a **delayed failure transition** rather than weakening the current rule.

## Research decision

Do not alter v6.2 thresholds retrospectively.

The next distinct hypothesis should be pre-registered separately as a delayed-transition study, for example:

1. extend observation to 20 trading sessions;
2. distinguish immediate failure from delayed failure;
3. allow a prior verified ownership-transfer regime to remain relevant even if the latest weekly TDCC/Broker state temporarily normalizes;
4. explicitly model rebound failure after an absorption phase;
5. test whether delayed failure improves sensitivity without promoting the two known absorbed/false-positive events.

This should be treated as a new methodology version rather than a patch to v6.2.

## Safety

Development-sample research only. Historical TDCC remains association-only because original publication timestamps are unknown. No production promotion until untouched/walk-forward validation exists.
