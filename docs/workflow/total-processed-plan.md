# Plan: total processed
Date: 2026-11-19 · Spec: docs/workflow/total-processed-spec.md · Starting state: existing project

## My understanding of the plan
**The problem:** the dashboard has a box called "Total processed", and the number in it is too big. It adds up every transaction in the list, including ones where no money moved. The list has 10,000 transactions and the box shows about $25.4 million. The real figure is about $6.5 million.

**What "total processed" means:** the amount of money that actually went through. A payment goes through when the bank approves the card and the money is taken. Those are the `APPROVED` transactions, and they are the only ones that should count.

Today the box also counts these:

| Status | What it really means | Should it count? |
|---|---|---|
| Approved | Card accepted, money taken | Yes |
| Declined | Card rejected, no money moved | No |
| Pending | Still waiting, not finished | No |
| Refunded | Money was given back | No (my judgment call) |
| Voided | Cancelled (one odd row in the data) | No |

**What it means for a client:** this is a payments product, so a client is probably a business reading this dashboard to see how much money they took. Today it tells them they processed $25.4M when only $6.5M went through. They might think they earned four times what they did, or report the wrong number to their accountant or boss.

**What the fix does:**
- Counts only approved transactions.
- Adds the amounts up in whole cents, which avoids tiny rounding errors like 25438084.33000013.
- Gets the same answer from the website and from the server's own summary, which has the same mistake.

**Judgment calls that are mine, not facts from the repo:**
- Refunded doesn't count. You could argue it should, because the money did go through before it was returned.
- I sum `total` (the sale `amount` plus the card `surcharge`), which is what was charged to cards and what a processor statement shows. The alternative is the sale `amount` alone ($6,299,522.49 on this data). Your call, made after we discussed the client view.
- The number still changes when you type in the search box.

## Goal
"Total processed" counts only APPROVED transactions (summed in integer cents) in both the web summary bar and the API summary, proven by a test per workspace that failed first.

## Approach
The API owns the rule: two small named exports in `apps/api/src/services/transaction-service.ts` (`isProcessed`, `sumProcessedAmount`), used by `getSummary().totalVolume`. The web mirrors it in `computeTotal` (`apps/web/src/utils/format.ts`) with a comment pointing at the API copy, because the apps share no package. `SummaryBar`, the search filter, enums, endpoints and package.json scripts stay untouched. Tests are plain vitest, next to the code, no DOM.

## What it reuses
| Need | Already in the repo | Example |
|---|---|---|
| Summing | `_.sumBy` / `_.round` (lodash, already used) | `apps/api/src/services/transaction-service.ts:28` |
| Web sum | existing plain `for` loop in `computeTotal` | `apps/web/src/utils/format.ts:11-17` |
| Status values | `TransactionStatus` enum (both apps) | `apps/api/src/models/transaction.ts`, `apps/web/src/models/transaction.ts:9` |
| Test runner | vitest 1.6, `"test": "vitest run"` already in both workspaces | `apps/*/package.json` |
| Test location | none yet (no tests in repo): co-locate `*.test.ts` | new |

Departures: none. No new dependency. Needs `npm install` first because this worktree has no `node_modules` (lockfile should not change).

## Options (decisions file)
| Decision | Chosen | Turned down |
|---|---|---|
| Where the rule lives | API owns it, web mirrors with a comment | web only (leaves API `totalVolume` wrong, no API test); shared package (new workspace, too big) |
| Which statuses count | APPROVED allowlist | all (bug); APPROVED+REFUNDED; denylist |
| `amount` or `total` | `total` (amount + surcharge): money charged to cards, matches a processor statement | `amount` alone (sale value; API `totalVolume` used it, but that code is the bug) |
| Test scope | one vitest file per workspace, pure functions | jsdom/testing-library (not installed); `--passWithNoTests` (hides empty suite) |
| Commits | red tests committed first, then fix | squash test+fix into one |

## Contracts
`isProcessed(t: { status: string }): boolean`, true only for `"APPROVED"`.
`sumProcessedAmount(ts: Transaction[]): number`, sums `total` (amount + surcharge) of processed rows as integer cents, returns dollars (`cents / 100`); `0` for empty. Web `computeTotal(ts)` returns the same numbers for the same input. `getSummary()` shape is unchanged.

## Tasks
| # | Component | Task | Files it may touch | Done when | Proved by | Depends on |
|---|---|---|---|---|---|---|
| 0 | setup | `npm install` | `node_modules` only | vitest resolves | `npx vitest --version` in both workspaces; `git status` clean | none |
| 1 | api | Failing tests: fixture with one row per status incl. `VOIDED` and an invented status, drift case (0.1+0.2), empty list, and `getSummary().totalVolume` = 6488615.40 on real data | `apps/api/src/services/transaction-service.test.ts` | test file fails for the right reason (totalVolume 25438084.33; helpers missing) | `npm test -w @assessment/api`, failing output shown | 0 |
| 2 | api | Fix: add `isProcessed`, `sumProcessedAmount`; use in `getSummary` | `apps/api/src/services/transaction-service.ts` | task 1 tests pass | `npm test -w @assessment/api`; `npm run build -w @assessment/api` | 1 |
| 3 | web | Failing tests for `computeTotal`: same fixture cases | `apps/web/src/utils/format.test.ts` | fails (returns sum of all statuses) | `npm test -w @assessment/web`, failing output shown | 0 |
| 4 | web | Fix: `computeTotal` filters APPROVED, sums cents, mirror comment | `apps/web/src/utils/format.ts` | task 3 tests pass | `npm test -w @assessment/web`; `npm run build` | 3 |
| 5 | verify | lint, all tests, builds, browser check of $6,488,615.40 and search behavior; `curl` the summary; ask user to rerun `/setup` | none | all green | commands below | 2, 4 |
| 6 | docs | `NOTES.md` (same headings as main checkout skeleton) with "Task 2 bug"; finish decisions file | `NOTES.md`, `docs/workflow/total-processed-*.md` | read-through | read the file | 5 |

## Order
Tasks 1→2 (api) and 3→4 (web) touch disjoint files, so they could run as two parallel groups, but each is a few lines and the user is new to the repo, so I'd run them in order in one session: 0, 1, 2, 3, 4, 5, 6. Commits: `test: add failing tests for total processed` (1 and 3), `fix: count only approved transactions in total processed` (2 and 4), `docs: add task 2 notes and decisions` (6). Say if you'd rather have separate api/web commits.

## Tests
| Spec criterion | Check |
|---|---|
| 1 API totalVolume = 6488615.40 | task 1 real-data test; `curl localhost:4000/api/transactions/summary` |
| 2, 3 non-approved, VOIDED, unknown status excluded | fixture tests, both workspaces |
| 4 cents, no drift | 0.1+0.2 test, both workspaces |
| 5 web matches API | same fixture in both test files; mirror comment |
| 6 empty / no approved gives 0 | unit tests |
| 7 bar shows $6,488,615.40 | `npm run dev`, built-in browser |
| 8 search still changes total and count | browser: search `declined` → $0.00; one merchant |
| 9 nothing else changed | `git diff --stat main` lists only plan files |
| 10 checks pass | `npm test`, `npm run lint`, `npm run build`, `npm run build -w @assessment/api` |
| 11 NOTES.md | read it |

## Running this plan
I do every task myself in this checkout, in order; I own git. If the build departs from this plan I say so and record it in the decisions file instead of editing the plan quietly. After Verify: `/simplify` on touched lines only, then ask the user to rerun `/setup`. Then pause for OK before Review (`/walkthrough`, then `/code-review medium main`). No PR until the user says.

## Verification
`npm test` (both workspaces, each ≥1 file), `npm run lint` (expect only the 2 existing a11y warnings in `TransactionList.tsx`), `npm run build`, `npm run build -w @assessment/api`, then browser check at `npm run dev`.
