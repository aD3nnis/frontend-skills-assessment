# Decisions: total processed
Date: 2026-11-19

Branch: claude/fix-total-processed-67c9b0
Type: Bug fix
Phase: Verify

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

## How it was verified (2026-11-19, commit 40f3fbd)
Commands run from the worktree root; exit codes read directly.
- `npm test`: exit 0. API 1 file / 7 tests, web 1 file / 4 tests, all pass.
- `npm run lint`: exit 0, 0 errors, 2 warnings (the existing jsx-a11y ones at `apps/web/src/components/TransactionList.tsx:26`).
- `npm run build`: exit 0 (tsc + vite; only the usual >500 kB chunk notice).
- `npm run build -w @assessment/api`: exit 0.
- `curl localhost:4100/api/transactions/summary` against this branch's API: `{"count":10000,"totalVolume":6488615.4,"totalSurcharge":763737.79}`. Port 4100 because ports 3000 and 4000 were already taken by a dev server from the main checkout (old code, still returned `totalVolume` 25438084.33), which I left running.
- Browser (built-in pane) on this branch's web at http://localhost:3001, with the page's list data coming from the existing server on 4000 (the list endpoint is unchanged; the total is computed in the web):
  - no search: Transactions 10,000, Total processed $6,488,615.40 (was $25,438,084.33)
  - `declined`: 2,556 transactions, $0.00
  - `approved`: 2,446 transactions, $6,488,615.40 (unchanged)
  - `Blue Ridge Outfitters`: 488 transactions, $275,941.92
  - Each of the filtered figures matches a separate calculation from `transactions.json` (APPROVED rows, `total` in cents, same search match).
- Spec criterion 9: `git diff --stat main` lists only the two test files, the two source files and the three `docs/workflow/total-processed-*.md` files; nothing else.
- Screenshot of the unfiltered bar: kept in the session scratchpad, outside the repo.

## What changed and why
- The write-up for this task is in `NOTES.md` (Task 2 bug section).

## Not verified
- `npm run dev` on the standard ports 3000/4000: blocked by the main checkout's running dev server, so the exact command was not exercised here; API and web were started on 4100 and 3001 instead.
- The web page was not pointed at this branch's API (its proxy is fixed to port 4000), so the browser check covers the web-side `computeTotal` only; the API figure is covered by the `curl` above and the API test.
- Spec criteria 11 (`NOTES.md`) and the `/setup` rerun belong to later steps and were not done here.
