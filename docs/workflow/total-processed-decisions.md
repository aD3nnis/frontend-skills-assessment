# Decisions: total processed
Date: 2026-11-19

Branch: claude/fix-total-processed-67c9b0
Type: Bug fix
Phase: Change

## Detours and switches
- none

## Options considered
| Decision | Chosen | Turned down | Why |
|---|---|---|---|
| Which statuses count as "processed" | APPROVED only (allowlist) | all statuses (current); APPROVED+REFUNDED; denylist of DECLINED/PENDING/REFUNDED | Only approved payments were actually processed; an allowlist keeps the unknown `VOIDED` status and any future status out by default |
| `amount` or `total` | `total` (amount + surcharge) | `amount` alone | What was charged to cards is what "processed" means in payments and what a processor statement shows; chosen with the user. Earlier draft used `amount` only because the buggy API `totalVolume` did |
| Search-filtered total | keep (total follows the list) | always show the overall total | The "Transactions" count beside it is filtered too, so the bar summarises what is on screen |
| Summing | integer cents | float `+=` | Float addition drifts (25438084.33000013 vs 25438084.33) |

## Pending (proposed, not yet approved)
- Rule location revised after a message from the parent session (2026-11-19): the API owns "processed" (`isProcessed` + a cents-based sum in `apps/api/src/services/transaction-service.ts`, used by `getSummary.totalVolume`); the web keeps a mirrored copy in `utils/format.ts` with a comment pointing at the API one, because the apps share no package. If Task 1 makes the web read the server summary, the web copy goes away.
- Tests: vitest only, one test file in each workspace (`npm test` fails until both have one), no `--passWithNoTests`, no jsdom or testing-library; the API test calls the service functions directly.
- Not touching: the `TransactionStatus` enum (`VOIDED`), `totalSurcharge`, the search filter, API endpoints, package.json scripts.
- End of Verify: ask the user to rerun `/setup` once both tests pass.

## Plan approved (2026-11-19)
- Plan: [total-processed-plan.md](total-processed-plan.md). Spec: [total-processed-spec.md](total-processed-spec.md). Target figure on the shipped data is 6,488,615.40 (cents sum checked).
- Commits: red tests first, then the fix, then docs. No PR until the user says; `/code-review medium main` before any PR.
