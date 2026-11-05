# TAIWAN STOCK — Per-stock verification attempt limit v1
Owner instruction: 2026-11-06. Scope: daily 5% research checkpoint review, including FIRST_PASS and REMEDIATION. This policy does not replace AI v3 contracts, original A/B, or upload authorization.

## Bound and definition
- The count is per trading date and exact stock code. Maximum **10 attempts total per stock**, INCLUDING the FIRST_PASS attempt and every remediation retry. For an exact-date list of 44 unique codes the mathematical upper bound is 44 × 10 = 440 **recorded/reserved verification attempts** (not 440 workflow runs or GitHub API calls). If another date has N stocks, the limit is N × 10.
- An attempt begins when a stock-specific substantive validation/verification or evidence-retry is about to run. Preliminary listing/index/sha reads without individual verification do not count. A failed, pending, interrupted, or passed check still counts after reservation. A batch of 3 stocks counts as 1 attempt for each stock, not one for the batch. A check already conclusively passed is not re-run without affected source changes, and even source changes do NOT reset the lifetime cap.
- At 10 reservations, status is PAUSED_LIMIT and that stock is not validated again by either the hourly or half-hourly Agent. Other stocks proceed. Clearing a pause or raising a cap requires explicit owner approval; never rotate filename/version, change date/code or silently reset counts.

## Durable authoritative data
- Store one append-only logical ledger per date+code at `research_pending/daily-gainers-ai-verification-attempts/YYYYMMDD/<CODE>.json` on remote main. Existing `daily-gainers-ai-verification-checkpoints` retain substantive per-stock findings but are NOT independently authoritative for attempts. If repository policy disallows this path, use an explicitly approved equivalent on main and report the blocker; do not fake persistence.
- Example required fields:
```json
{
  "schema": "stock-verification-attempt-ledger-v1",
  "target_date": "20261104",
  "code": "1709",
  "max_attempts": 10,
  "attempt_count": 1,
  "state": "PENDING",
  "attempts": [
    {
      "attempt_number": 1,
      "attempt_id": "unique-stable-id",
      "phase": "FIRST_PASS",
      "status": "PENDING",
      "started_at": "actual ISO-8601 timestamp or unavailable",
      "finished_at": null,
      "agent_task_id": "actual or unavailable",
      "agent_run_id": "actual or unavailable",
      "source_sha": {"raw": "actual", "facts": "actual", "news": "actual", "research_checkpoint": "actual"},
      "check_results": [{"check_id": "O01", "status": "PENDING", "reason": "Original scheduled run proof not retrieved", "evidence_ref": "actual citation/path or unavailable", "next_action": "query original run trace"}],
      "failure_reason_codes": ["O01"],
      "github_reservation_commit_sha": "actual or unavailable",
      "github_result_commit_sha": null
    }
  ]
}
```
- For every attempt persist the exact per-check status PASS/FAIL/PENDING/NOT_REQUIRED, precise failure/pending reason, observed error/code, evidence references, and next step. Historical attempts must remain in the array; subsequent attempts append rather than replace. `attempt_count === attempts.length`, numbers contiguous, unique attempt_id, count ≤ 10. When 10 attempts are recorded and no full VERIFIED, state=PAUSED_LIMIT, preserve full history.
- For earlier checkpoint-only work, reconstruct historic attempts ONLY when there is distinguishable persisted execution evidence; preserve a `history_reconstruction` field distinguishing verified historical counts and unknown earlier repetitions. Never claim the lifetime 440 bound retroactively if earlier attempts cannot be accounted for.

## Concurrency and write order
1. Before EACH per-stock attempt, fetch that code's ledger and latest main HEAD. If count ≥10, skip without checking and move to the next stock. If no ledger exists, reconcile the already persisted first-pass record, including its first substantive validation, before starting a new attempt.
2. **Reserve and commit** the next attempt number on main BEFORE any substantive retry, using GitHub Contents API SHA compare-and-swap of the per-stock file. A new file is created atomically; 409/422 or another competing update means re-fetch and reconsider the limit. If reservation cannot be persisted and read back, do NOT perform the attempt.
3. Run the stock verification, then update SAME ledger attempt with actual per-check outcomes and failure reasons using latest blob SHA; read back updated blob SHA and commit. Preserve all earlier attempts when modifying JSON. Keep verified results in substantive verification checkpoint too. If execution is interrupted, reserved attempt still counts, remains PENDING/INTERRUPTED until resolved, and cannot be silently reclaimed.
4. Two agents must share exactly these main ledgers, never maintain separate counters in private contexts. If a ledger is malformed, unexpectedly disappears or contradicts existing persisted checkpoint history, fail closed for that stock, report the discrepancy, and continue other safe stocks. Never rewrite a ledger to bypass the cap.
5. FIRST_PASS continues FIFO to uncovered stocks regardless of UNVERIFIED outcome; only after N/N first-pass coverage start REMEDIATION. A PAUSED_LIMIT stock counts as already first-pass covered only if a real first-pass verification record exists; never call a skipped check a successful first pass.
6. At end of each run report per stock code, FIRST_PASS/REMEDIATION, attempt_count/10, most recent check failure/pending reason codes and evidence, ledger SHA/commit, overall VERIFIED/UNVERIFIED/INVALID/PAUSED_LIMIT and next action; totals include attempts reserved and completed, remaining allowed attempts, number paused, and any history ambiguity.

## Gates
- The retry limit is a resource budget, not a passing condition. PAUSED_LIMIT and PENDING cannot be promoted to VERIFIED or used to bypass original official Validator, A/B, or publication gates.
- All policies preventing unsourced numbers, fabricated provenance, misleading news timelines and unauthorized YouTube uploads remain in effect.
