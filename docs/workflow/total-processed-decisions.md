# Decisions: total processed
Date: 2026-11-19

Branch: claude/fix-total-processed-67c9b0
Type: Bug fix
Phase: Ship

## Detours and switches
- none

## What changed and why
- API: `apps/api/src/services/transaction-service.ts`: added `isProcessed` (APPROVED only) and `sumProcessedAmount` (sums `total` in integer cents); `getSummary().totalVolume` uses it. Reason: the old line summed every row's `amount`, giving 25,438,084.33 instead of 6,488,615.40.
- Web: `apps/web/src/utils/format.ts`: `computeTotal` skips non-APPROVED rows and sums `total` in cents, with a comment pointing at the API copy. The apps share no package, and `lodash` is only an API dependency, so it keeps the existing plain `for` loop.
- Tests: one vitest file per workspace with the same cases (all statuses, `total` not `amount`, float drift, empty list); the API file also checks the shipped-data figure.

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

## Departures from the plan
- The float-drift test fixture was 0.1 + 0.2 in the plan and the first commits. The walkthrough break-it check showed it passes even with the per-row rounding removed (0.1 * 100 and 0.2 * 100 are exact), so both test files now use 1.15 + 2.30 = 3.45 (commit fb75468). No source change.

## Tried and abandoned
- none

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

### Break-it checks (walkthrough, 2026-11-19)
Each line was broken, the tests run, and the line restored (`git diff HEAD` on the source files empty afterwards).
| Criterion | Line broken | Test that failed |
|---|---|---|
| Only APPROVED counts (API) | `transaction-service.ts:22`, `=== APPROVED` changed to `!== DECLINED` | 4 failed: `isProcessed` "is true only for APPROVED", `isProcessed` "excludes VOIDED and statuses it has never seen", `sumProcessedAmount` "counts only the APPROVED row…", `getSummary` "totalVolume is the APPROVED total only" |
| Only APPROVED counts (web) | `format.ts:17`, `if` condition replaced by `true` | 2 failed: `computeTotal` "counts only the APPROVED row…" (2100 vs 100), "returns 0 for an empty list and for a list with no APPROVED rows" (50 vs 0) |
| Sums `total`, not `amount` | `transaction-service.ts:26`, `t.total` to `t.amount` | 2 failed: "sums total (amount + surcharge), not amount alone" (100 vs 103), `getSummary` real data (6299522.49 vs 6488615.4) |
| Sums in whole cents | `transaction-service.ts:26`, `Math.round(t.total * 100)` to `t.total * 100` | none failed with the 0.1 + 0.2 fixture, so the criterion was unproven: fixture changed to 1.15 + 2.30 (fb75468). Re-break on both API (`:26`) and web (`format.ts:18`): "adds in cents so 1.15 + 2.30 is exactly 3.45" fails with 3.4499999999999993 vs 3.45 |

After fb75468: `npm test` exit 0 (API 7, web 4), `npm run lint` 0 errors, the same 2 warnings.

## Reviewed by hand
- `apps/api/src/services/transaction-service.ts`: the user said `count` and `totalSurcharge` still cover the whole list, which is right (lines 38 and 40). Correction: `totalVolume` now includes the surcharge (`total`), so it and `totalSurcharge` are on different bases. Out of scope, recorded under With more time.
- `apps/web/src/utils/format.ts`: the user said it follows how the neighbouring code does the job. Confirmed: the original was already a `for` loop, and `lodash` is only in `apps/api/package.json`. Consequence: the web repeats the status check inline, so the two copies can drift.
- Break-it predictions: the user got the API denylist, the `total` vs `amount` and the web "returns 0" cases right; missed that "counts only the APPROVED row" also fails on the web, and that the 0.1 + 0.2 test would not catch removed rounding.
- Read by Claude only: `apps/api/src/services/transaction-service.test.ts` and `apps/web/src/utils/format.test.ts` (apart from the break-it runs above); `NOTES.md` (the user is writing it).

## Map
- Deferred: the user chose to skip it for now. There is no `docs/workflow/map.md`; until `/map` runs, the repo has no written description of its components and data flow. This change only touches two functions, so it does not move any documented fact.

## Not verified
- `npm run dev` on the standard ports 3000/4000: blocked by the main checkout's running dev server, so the exact command was not exercised here; API and web were started on 4100 and 3001 instead.
- The web page was not pointed at this branch's API (its proxy is fixed to port 4000), so the browser check covers the web-side `computeTotal` only; the API figure is covered by the `curl` above and the API test.
- Spec criteria 11 (`NOTES.md`) and the `/setup` rerun belong to later steps and were not done here.
- 2026-11-19: Verify passed; `/simplify` shortened two comments; `/setup` filled both hooks and CLAUDE.md. Moved to Review.

## With more time
- Guard a missing or NaN `total` so the bar cannot show `$NaN` silently (`format.ts:18`, `transaction-service.ts:26`).
- Test half-cent rounding (`Math.round` on values like x.xx5).
- Decide whether `approved` in lowercase or padded should count; matching is strict today.
- Remove the drift risk between the two copies of the rule: a test that compares them, or have the web read the server summary (see Pending).
- Put `count` and `totalSurcharge` in `getSummary` on the same basis as `totalVolume`, or document that they cover all statuses.
- Run `/map` to write the repo map.
- 2026-11-19: `/code-review medium main` found no bugs (5 low items). Finding 1 (total follows the search filter, `TransactionsPage.tsx:50`) left as is: out of scope for this bug fix and a Task 1 question. Moved to Ship.
