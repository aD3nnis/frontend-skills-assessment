# Spec: pagination and search
Date: 2026-11-19 · Starting state: existing project

## Task
"Task 1 - Add pagination and search (frontend + backend). Right now the API returns every transaction in a single response and the UI renders all of them at once. Add pagination so the app only requests and shows a page at a time, and make the search box work well against the full dataset. You get to decide the API contract and the UI. We're interested in how you split the work between client and server and why." ([INSTRUCTIONS.md](../../INSTRUCTIONS.md))

## In my own words
The transactions page requests one page of results at a time, with the search term sent to the API. The list, the count and "Total processed" all describe everything that matches the search, not just the rows on screen. The README-level behavior of the search (what it matches) stays the same.

## Where
- API route: `apps/api/src/index.ts:19-23`: `GET /api/transactions` ignores query params and returns every transaction.
- API service: `apps/api/src/services/transaction-service.ts:33`: `getAll` returns the whole in-memory array; `:55` `create` puts new rows first with `unshift`.
- Web service and hook: `apps/web/src/services/transaction-service.ts:5-9`, `apps/web/src/hooks/useTransactions.ts:6-18`: one fetch on mount, no parameters.
- Web page: `apps/web/src/pages/TransactionsPage.tsx:12-52`: filters in the browser, passes the filtered list to the summary bar and the list.
- Web components: `apps/web/src/components/SummaryBar.tsx:11`, `apps/web/src/components/TransactionList.tsx:26`.
- Total rule: `apps/web/src/utils/format.ts:13` mirrors `apps/api/src/services/transaction-service.ts` (`isProcessed`, `sumProcessedAmount`).

## How it works today
- The API returns `{ transactions }` with all 10,000 seed rows (`apps/api/src/data/transactions.json`, counted with a script on 2026-11-19; ids are unique).
- The browser lowercases the search term and keeps a row if the term is a substring of `merchantName`, `id`, `cardBrand` or `status` (`TransactionsPage.tsx:18-26`). An empty term keeps everything.
- "Transactions" count and "Total processed" are computed from the filtered list (`TransactionsPage.tsx:50`, `SummaryBar.tsx:11`), so they change with the search. Total counts APPROVED rows only, summed in cents.
- Every keystroke re-filters 10k rows and re-renders all matches, with `key={i}` (`TransactionList.tsx:26`).
- After creating a transaction the page navigates to `/` and refetches (`NewTransactionPage.tsx:20`, `useTransactions.ts:10`).
- The seed file is already ordered newest first; 83 rows share the timestamp `2026-05-17T00:00:00.000Z`, so `createdAt` alone is not a stable sort key.
- Status counts in the seed: DECLINED 2556, REFUNDED 2523, PENDING 2474, APPROVED 2446, VOIDED 1.

## Known, assumed, unknown
- **Known:** the facts above, each with its `file:line` or the script that showed it. Baseline `npm test` passes in this worktree (web 4 tests).
- **Assumed:** (1) the data stays in memory, so filtering 10k rows per request is fast enough without an index; if it grows into a database the filter moves into a query. (2) Offset pagination is acceptable: a transaction created between two page loads can shift page boundaries. (3) Keeping the current search semantics (case-insensitive substring over the four fields) is what "work well" needs, plus not freezing the UI.
- **Unknown:** none that the repo can answer. Page size options (25 default, capped at 100) are a design choice recorded in the plan.

## Acceptance criteria
1. `GET /api/transactions` accepts `q`, `page` (1-based, default 1) and `pageSize` (default 25, max 100) and returns `{ transactions, page, pageSize, total, totalProcessed }`, where `transactions` holds at most `pageSize` rows. · Check: API unit tests on the service and a request against the running API.
2. `total` is the number of rows matching `q` across the whole dataset and `totalProcessed` is the APPROVED-only sum (in cents, as today) over all those rows, not just the page. · Check: test with a fixture where the matching rows span several pages and include non-APPROVED statuses and VOIDED.
3. `q` matches case-insensitively as a substring of `merchantName`, `id`, `cardBrand` or `status`, after trimming; an empty or missing `q` matches everything. · Check: tests per field, with mixed case and surrounding spaces.
4. Results are ordered newest first with `id` as the tie-break, so paging through every page returns each matching row exactly once. · Check: test that concatenating all pages equals the full filtered list with no duplicates, using fixture rows that share a timestamp.
5. A `page` past the last page returns an empty `transactions` array with the correct `total`. A non-integer or out-of-range `page` or `pageSize` returns 400 with `{ error }`, not a 500 or a silently changed value. · Check: tests for `0`, `-1`, `abc`, `1.5`, `pageSize=101`, and a page beyond the end.
6. The page renders one page of rows only and has paging controls showing the current page and total pages. Changing page requests that page from the API. · Check: run the app; the network tab shows requests with `page` and `pageSize`; the DOM holds at most `pageSize` rows. Hook or component test where practical.
7. Typing in the search box sends the term to the API after a short debounce (about 300 ms), not on every keystroke, and resets to page 1. Responses that arrive out of order never overwrite a newer one. · Check: hook test with fake timers and a stale-response case; manual check typing quickly.
8. The "Transactions" count and "Total processed" show the server's `total` and `totalProcessed` for the whole search, and match what the old browser-side filter gave for the same term on the full dataset. · Check: compare, for two or three terms, against a one-off script over `transactions.json` using the old rule.
9. The page keeps showing the previous results (marked as loading) while a new page loads. A failed request shows an error message with a retry action, not a blank or a crash. · Check: manual with the API stopped; test for the error state.
10. `q` and `page` are kept in the URL (`?q=&page=`), so a reload or a pasted link restores the same view. · Check: manual reload; test of the parsing, including bad values falling back to page 1 and an empty search.
11. A transaction created through the new-transaction form appears first in the list after returning to `/`. · Check: manual flow, plus a service test that `create` then list puts it on page 1.
12. `npm test` and `npm run lint` still pass with no new lint errors. · Check: both commands, output pasted into the decisions file.

## Blast radius
Searched `getAll|getSummary|fetchTransactions|useTransactions|computeTotal` and the route string across `apps`:
- `getAll` is also used for the startup log at `apps/api/src/index.ts:50` and in service tests; it stays as is, so those are unaffected.
- The response shape of `GET /api/transactions` changes (added fields; the `transactions` key stays). The only consumer in this repo is `apps/web/src/services/transaction-service.ts:5`. Any external caller that expected every row would now get one page.
- `GET /api/transactions/summary` and `GET /api/transactions/:id` are not changed.
- `computeTotal` (`apps/web/src/utils/format.ts:13`) and its tests would no longer be used by the page if the server supplies the total. Whether to delete it is a plan decision; the rule it mirrors stays on the server.
- `TransactionsPage`, `TransactionList`, `SummaryBar` and `useTransactions` change; `NewTransactionPage` and `TransactionModal` do not.
- The transactions page is the app's main screen, so a regression there affects every user of the dashboard.

## Out of scope
- Sorting by column, filters by status or date range, and fuzzy or full-text search: not asked for.
- Cursor (keyset) pagination: offset is enough for an in-memory list; revisit if the data moves to a database.
- Changing the data store, the summary route, input validation on POST, or the 500 handler that returns `stack`: separate tasks.
- Task 2 (the total's definition) is already fixed on `main`; this task only moves where it is computed.
