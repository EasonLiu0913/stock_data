# Monthly Revenue Rejected / Deprioritized Ideas

Last updated: 2026-08-07

This file records ideas that should not be repeatedly rediscovered without new evidence.

`Rejected` here means "not supported enough for promotion from the current evidence", not permanently impossible.

## MoM > 0 as a standalone factor

Status: deprioritized.

Reason:

- Initial universe-relative uplift was weak or inconsistent across horizons.
- Short-term positive month-over-month revenue alone did not provide enough additional selection value.

May still be used as a conditional feature with strong YoY growth.

## YoY acceleration as a standalone factor

Status: deprioritized.

Reason:

- Initial D1/D3/D5 discrimination was weak.
- Longer horizons showed some improvement, but not enough to outperform simpler sustained-high-YoY definitions consistently.

May still be useful as a secondary feature.

## Raising YoY threshold from 20% to 30% solely to make the factor "stronger"

Status: not supported by current evidence.

Reason:

- Sample size falls.
- Uplift did not consistently improve enough to compensate.

Do not assume a stricter threshold is automatically a better signal.

## Semiconductor + high revenue growth as an automatic preferred combination

Status: rejected as an assumption.

Reason:

- Semiconductor stocks were strong during parts of the sample.
- After comparison against the same-industry universe, some revenue definitions provided little or negative additional uplift.

Industry strength must not be confused with factor selection value.

## Shipping as a production candidate from the first industry breakdown

Status: downgraded to observation.

Reason:

- Several D5 industry-relative results initially looked strong.
- Market-regime segmentation reduced confidence and suggested that part of the aggregate result was regime-dependent.

More historical regimes are required before reconsideration.

## Using market regime as a strategy gate

Status: prohibited architecture, not merely rejected research.

Reason:

- It hides valid strategy matches and changes the meaning of a strategy across dates.
- Market environment must remain research context and dashboard guidance.

See `../../decisions/ADR-002-market-environment.md`.
