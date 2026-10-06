# Turso TWSE Institutional Live Shadow Ledger v1

Status: **WAITING / ACTIVE EVIDENCE**

This is a durable human-readable checkpoint for Phase 11 live shadow accumulation. The machine ledger is the non-production Turso table `turso_live_shadow_evidence_v1`; this document records independently verified checkpoints from authoritative workflow evidence.

Rules:
- owner authorization date: 2026-10-06 Asia/Taipei;
- only genuine eligible TWSE trading dates on/after authorization may count;
- canonical `main:data_twse_institutional_investors/<date>_twse_institutional_investors.json` must exist first;
- no independent TWSE refetch;
- exact shadow write/read parity must pass before acceptance;
- duplicates count once;
- missing canonical file, non-trading day, parity failure, database-unavailable, or any other failed classification does not advance the count;
- target: 20 accepted consecutive eligible live trading dates;
- canonical repository files remain source of truth.

## Accepted dates

| # | Trade date | Canonical source SHA-256 | Rows | Contract hash | Instrument coverage | Evidence |
|---:|---|---|---:|---|---|---|
| 1 | 2026-10-06 | `5d339a98f21de4afddfdd5ddac32f4388857c1cf8724d5f3f4746b059c18efcf` | 1,078 | `45e19b2ff46fa27a4b1d6e9222ecacdd14daf012a0a06e66b7cbb51cf9d81908` | stock 1,044; innovation_board 31; TDR 3; unmatched 0; ambiguous 0 | run `37482832144`, job `112335159710`, artifact `11422217604` |

Current accepted count: **1 / 20**

Remaining: **19**

Current state: **WAITING_ACTIVE_EVIDENCE**

Duplicate-safety proof:
- first 2026-10-06 collection: accepted count became 1, `duplicate=false`;
- immediate second collection of the same date: accepted count remained 1, `duplicate=true`.

No production migration, primary-read switch, PR merge, or canonical-source change is authorized by this ledger.
