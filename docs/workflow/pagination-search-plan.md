# Plan: pagination and search
Date: 2026-11-19 · Spec: [pagination-search-spec.md](pagination-search-spec.md) · Starting state: existing project

## Goal
The transactions page requests and shows one page at a time, search runs on the server against the full dataset, and the count and "Total processed" describe every match.

## Approach
The server filters, sorts, slices and computes the totals. The client debounces the input, keeps `q` and `page` in the URL, drops stale responses, and shows loading and error states. It follows the repo's existing patterns: a factory-closure service on the API, a service function plus `useEffect` hook on the web.

## My understanding of the plan
Right now the browser downloads all 10,000 transactions, searches them itself, and draws every match. The plan moves that work to the server so the browser only handles one page at a time.

**What the app does after the change**
- The browser asks for "page 3 of results for 'visa'". The server finds the matches, picks the 25 for that page, and sends back those rows plus two numbers: how many rows matched in total, and the "Total processed" amount across all of them.
- The summary bar shows those server numbers. Without that, the total would only cover the 25 rows on screen, which would be wrong.

**Why the server does the searching and counting**
- It already holds all the data. Sending everything to the browser just to throw most of it away is slow and gets worse as the data grows.
- The rule for what counts as "processed" (approved transactions only) then lives in one place instead of two copies that have to stay in sync.

**What stays in the browser**
- **Waiting after typing:** the search waits about 0.3 seconds after you stop typing before it asks the server, so there is no request per keystroke.
- **Ignoring old answers:** if a slow response arrives after a newer one, it is thrown away so the screen doesn't flip back to old results.
- **Page and search in the URL:** the address holds `?q=visa&page=3`, so a refresh or a shared link shows the same view.
- **Errors:** a failed request shows a message with a retry button instead of a blank page.

**Newest first:** 83 transactions share one timestamp. Without a second sort key (the id), rows could repeat or go missing between pages.

**How the work is split:** three independent tasks first (server search-and-page function, input validation, the browser's URL helpers), then the server route, the browser's data fetching, the page and summary bar, and finally a test of the whole thing in the running app.

**What it doesn't do:** add libraries, or add automated tests for the waiting, ignoring and error behavior (chosen by the user; checked by hand). The server logic and URL helpers do get automated tests.

## What it reuses
| Need | Already in the repo | Example |
|---|---|---|
| Approved-only cents sum | `sumProcessedAmount`, `isProcessed` | `apps/api/src/services/transaction-service.ts:19-26` |
| Service factory with closures | `createTransactionService` | `apps/api/src/services/transaction-service.ts:30` |
| Test fixture builder | `make(...)` | `apps/api/src/services/transaction-service.test.ts:7` |
| URL state | `react-router-dom` (`useSearchParams`) | `apps/web/src/App.tsx:2` |
| Pagination UI | Ant Design `Pagination` | antd 5, used across `apps/web/src` |
| Fetch plus hook pattern | service function plus `useEffect` hook | `apps/web/src/hooks/useTransactions.ts:6`, `apps/web/src/services/transaction-service.ts:5` |

Departures from the repo's patterns: a small hand-written `useDebouncedValue` hook (the web app has no debounce library; lodash is API-only), and an `AbortController` on the fetch (not used elsewhere). No new dependencies.

## Contracts
```
GET /api/transactions?q=<text>&page=<int, default 1>&pageSize=<int 1..100, default 25>
200 { transactions: Transaction[], page, pageSize, total, totalProcessed }
400 { error: string }   // page or pageSize not a positive integer, or pageSize > 100
```
- `q`: trimmed, case-insensitive substring of `merchantName`, `id`, `cardBrand` or `status`; empty or missing matches everything.
- Order: `createdAt` descending, ties broken by `id` ascending.
- A `page` past the end returns 200 with an empty `transactions` and the correct `total`.
- `totalProcessed`: APPROVED only, summed in cents over every match (reuse `sumProcessedAmount`).
- Web URL: `?q=<text>&page=<n>`, defaults omitted; bad values fall back to page 1 and an empty search.

## Tasks
| # | Component | Task | Files it may touch | Done when | Proved by | Depends on |
|---|---|---|---|---|---|---|
| 1 | API service | `list({q,page,pageSize})`: filter, sort, slice, `total`, `totalProcessed`; keep `getAll` | `apps/api/src/services/transaction-service.ts`, `apps/api/src/services/transaction-service.test.ts` | Criteria 1-4 and 11 hold at service level | New service tests, shown failing first | none |
| 2 | API validation | Pure `parseListQuery(query)` returning params or an error message | `apps/api/src/utils/list-query.ts`, `apps/api/src/utils/list-query.test.ts` (new) | Valid values parse; `0`, `-1`, `abc`, `1.5`, `pageSize=101` rejected | New unit tests | none |
| 3 | API route | Wire the route: parse, 400 on error, call `list`, return the contract | `apps/api/src/index.ts` | Contract response; 400 on bad input | `curl` against the running API (criteria 1, 5) | 1, 2 |
| 4 | Web helpers | `TransactionPage` type; pure `parseListParams` and `buildListSearch` | `apps/web/src/utils/list-params.ts`, `apps/web/src/utils/list-params.test.ts` (new), `apps/web/src/models/transaction.ts` | Round-trips; bad input falls back | New unit tests | none |
| 5 | Web data | `fetchTransactions({q,page,pageSize,signal})` throwing on non-OK; `useTransactionPage` hook (abort stale, keep previous data, `error`, `retry`); `useDebouncedValue` | `apps/web/src/services/transaction-service.ts`, `apps/web/src/hooks/useTransactions.ts`, `apps/web/src/hooks/useDebouncedValue.ts` (new) | Hook returns `{data, loading, error, retry}` (later also `dataMatches`, see the decisions file); stale responses dropped | Driven in the running app (criteria 7, 9) | 3, 4 |
| 6 | Web UI | Page with input state and debounce into the URL; Ant `Pagination` (fixed 25, no size changer); `SummaryBar` takes `total` and `totalProcessed`; list `key={t.id}`; loading, error and retry; delete `computeTotal` and its tests; update the "mirrors" comment in the API service | `apps/web/src/pages/TransactionsPage.tsx`, `apps/web/src/components/SummaryBar.tsx`, `apps/web/src/components/TransactionList.tsx`, `apps/web/src/utils/format.ts`, `apps/web/src/utils/format.test.ts`, `apps/web/src/App.css`, `apps/api/src/services/transaction-service.ts` (comment only) | Criteria 6-11 in the browser | Manual run, screenshot, `npm test`, `npm run lint` | 4, 5 |
| 7 | Verify | Run the app; check criteria 6-11; compare the summary against a script using the old rule for 2-3 terms (criterion 8); screenshot for the PR | none (docs only) | All 12 criteria evidenced in the decisions file | commands and output | 6 |

## Order
- Group A (in parallel): 1, 2, 4. Their files don't overlap and none needs another.
- Then: 3 (needs 1 and 2).
- Then: 5, then 6 (6 also edits a comment in the API service, so it runs after task 1 is committed).
- Then: 7.

## Tests
| Acceptance criterion | Test or check |
|---|---|
| 1, 2, 3, 4, 11 | Service tests (task 1): page slicing; `total` and `totalProcessed` across pages with DECLINED, PENDING, REFUNDED and VOIDED rows; per-field, case and trim matching; all pages concatenated equal the full list with no duplicates (shared-timestamp fixture); `create` then `list` puts the new row first |
| 5 | Task 2 unit tests, plus `curl` for a 400 and a past-the-end page |
| 6 | Browser: Network tab shows `page` and `pageSize`; the DOM holds at most 25 rows |
| 7 | Manual typing test with the Network tab (one request after the pause); stale handling by throttling in devtools. Not automated: no DOM test tooling, and the user chose pure helpers over adding jsdom |
| 8 | One-off script over `transactions.json` with the old filter, compared with the UI for 2-3 terms |
| 9 | Stop the API and reload: error and retry shown; previous rows kept when a later page fails |
| 10 | Task 4 tests, plus a manual reload with `?q=visa&page=3` |
| 12 | `npm test` and `npm run lint` |

## Running this plan
The session that builds this plan is the controller. It owns git and the plan; nothing else commits.
- **A parallel group:** start one subagent per task, all in one message. Give each its task row, the Contracts section, the conventions for its component (from `map.md`: named-export arrow functions, factory-closure service, tests next to code as `*.test.ts`), and these rules: edit only the files in your border; if you need a file outside it, stop and report; don't commit.
- **After each group:** run `git status --short` and check every changed file sits inside a task's border. Read each diff against its "Done when". Run the tests. Then commit one task at a time (Conventional Commits, short lowercase imperative, Co-Authored-By last).
- **Tests first:** write each new test and show it failing, with its output, before the code that makes it pass.
- **Tasks in order:** the controller does them itself.
- **Worktrees are not used** for subagents: a subagent's worktree starts from the default branch, so it would not see this branch's earlier tasks. Tasks with separate file borders are safe in one checkout.
- **When the build departs from this plan:** say so to the user and add it to `pagination-search-decisions.md` with the reason. Don't quietly edit the plan to match.

## Risks
- Offset paging: a transaction created between page loads shifts page boundaries (accepted in the spec).
- `pageSize` is fixed at 25 in the UI; the API still accepts up to 100.
- Debounce, stale-response and error-state behavior is verified by hand, not by automated tests.
