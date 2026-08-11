# Fundamental Event Timeline — Phase 2 Acceptance

Last updated: 2026-08-11

## Result

**PASS — Phase 2 is accepted at the shadow information-state layer.**

Production FAS/FQ remains unchanged by design.

## Acceptance question

Can the repository determine, for a historical cutoff, the newest fundamental information the market could actually know without relying on one universal conservative filing deadline?

For the acceptance case 2330 / 2026Q2, the answer is yes.

## Official acceptance evidence

Verified official TSMC sources establish:

```text
2026-07-13  June 2026 monthly sales event
2026-07-16  Q2 2026 earnings release
2026-07-16 14:00–15:30 Asia/Taipei  Q2 earnings conference
```

The earnings release states:

```text
revenue             NT$1,270.38bn
net income          NT$706.56bn
EPS                 NT$27.25
gross margin        67.7%
operating margin    60.3%
net margin          55.6%
```

These are stored as traceable verified events in:

```text
data_fundamental_events_verified/2330/2026.json
```

Daily anti-lookahead makes the Q2 earnings/conference information effective on 2026-07-17.

## State-resolution acceptance

The Phase 2 resolver rule is:

```text
newer fiscal period wins first
same fiscal period: formal report supersedes preliminary earnings
```

Therefore at cutoff:

```text
2026-07-17
```

2330 must resolve to:

```text
latest financial period = 2026Q2
latest financial event  = preliminary_earnings
EPS                     = 27.25
confidence              = verified_company_ir
```

It must not remain on 2026Q1 solely because a Q2 fallback/legal filing deadline has not passed.

Regression coverage locks this behavior.

## Historical MOPS acceptance boundary

The historical MOPS adapter is implemented through Playwright and normalizes visible historical material-information rows into the canonical event schema.

Historical MOPS coverage is intentionally **observable rather than assumed complete**.

A company/year that returns zero usable rows is recorded as zero coverage; the system does not manufacture dates to fill the gap.

This boundary is considered correct Phase 2 behavior because the state resolver can combine:

```text
current official exchange evidence
historical MOPS evidence when available
verified official company IR evidence
conservative fallback only when stronger availability evidence is absent
```

The objective is correct historical knowledge state, not artificial 100% timestamp coverage.

## Completed Phase 2 components

```text
scripts/fundamental_state_resolver.js
scripts/build_latest_known_fundamental_state.js
scripts/crawl_mops_historical_fundamental_events.js
tests/fundamental_state_resolver.test.js
config/fundamental-state-schema.v1.json
data_fundamental_events_verified/2330/2026.json
docs/research/fundamental-events/phase-2-latest-known-state.md
.github/workflows/build-fundamental-state-phase2.yml
```

## Workflow safety

`[07 研究] Fundamental Event Timeline－Phase 2 State Build` is manual `workflow_dispatch` only.

It does not:

- use `workflow_run`;
- deploy Pages;
- trigger prediction;
- modify Strategy Registry;
- change production FQ/FAS.

## Phase 2 conclusion

The project now has a canonical answer to:

> What was the latest-known fundamental state at this historical cutoff?

The old `conservative_known_date` remains available as fallback evidence, but it is no longer the only conceptual availability model.

## Next gate

The next phase is **event-driven FQ research migration**, not immediate production replacement.

Required next work:

1. derive FQ from `latest_financial_information` with provenance (`preliminary` vs `formal`);
2. rerun the complete FAS >= 8 + FQ >= 10 historical study using event-driven availability;
3. compare signal-date changes, sample changes and performance against the old conservative-deadline study;
4. only after the evidence is reviewed, version/promote the production strategy if the thesis remains supported.
