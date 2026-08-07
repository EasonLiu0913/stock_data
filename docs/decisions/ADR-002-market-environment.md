# ADR-002: Market Environment Is Research Context, Not Strategy Gate

- Status: Accepted
- Date: 2026-08-07

## Context

Market regime affects returns and factor behavior. It is tempting to disable strategies in bear markets or only show candidates in bull markets.

That would make strategy definitions inconsistent across dates and would hide the difference between "no stock matched" and "the system suppressed valid matches".

## Decision

Market environment may be used for:

- Historical research.
- Dashboard explanation.
- Risk/context text.
- Comparing factor behavior across regimes.

Market environment must not:

- Exclude a stock that otherwise matches a strategy.
- Turn a strategy on/off.
- Make a strategy disappear from the UI.
- Change the logical definition of a fixed strategy.

## Rationale

The same strategy should mean the same thing every day. Users may interpret market context themselves rather than having valid matches silently hidden.

## Consequences

- Research can still show that a factor is weaker in certain regimes.
- Production lists remain comparable across time.
- Fixed strategies can continue to display zero candidates when none match.
- Market context remains explanatory rather than a hidden decision gate.

## Related

- `../architecture/research-platform.md`
- `../research/monthly-revenue/methodology.md`
