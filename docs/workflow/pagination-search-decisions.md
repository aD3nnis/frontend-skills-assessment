# Decisions: pagination and search
Date: 2026-11-19 · [Spec](pagination-search-spec.md) · [Plan](pagination-search-plan.md)

Branch: worktree-pagination-search
Type: Feature
Phase: Change

## Detours and switches
- 2026-11-19: the worktree's branch was first cut from `origin/main` (the initial commit, without the two merged fixes), so I reset it to local `main` (400e561) before any work. `.claude/` and `docs/workflow/map*` are git-excluded locally, so they were copied in from the main checkout.

## Options considered
| Decision | Chosen | Turned down | Why |
|---|---|---|---|
| Where filtering, paging and totals happen | Server | Browser (current) | The server holds the full dataset, and the summary totals must cover all matches, not one page. Also keeps the "approved only" rule in one place |
| How to test the web behavior (debounce, stale responses, URL state, errors) | Pure helpers tested with the existing vitest; the rest checked by hand | Add jsdom and Testing Library (3 dev dependencies) | The user chose no new dependencies. The cost is that debounce, stale-response and error-state behavior have no automated test |
| Pagination style | Offset (`page`, `pageSize`) | Cursor | The list is in memory and users jump between pages. A new row can shift boundaries, which the spec accepts |
| Page size in the UI | Fixed 25 | Page-size selector | Simpler; the API still accepts up to 100 |

## What changed and why
- API service: `apps/api/src/services/transaction-service.ts`: `listTransactions` / `service.list` filter, sort (newest first, `id` tie-break), slice and return `total` and `totalProcessed` over all matches. The "approved only" rule now has one copy.
- API validation: `apps/api/src/utils/list-query.ts`: strict parsing; a bad `page`, `pageSize` or a repeated parameter is a 400, not a silent fix.
- API route: `apps/api/src/index.ts`: `GET /api/transactions` returns the paged contract. The old `console.log` of the query was dropped with the `getAll` call.
- Web data: `apps/web/src/services/transaction-service.ts`, `hooks/useTransactions.ts`, `hooks/useDebouncedValue.ts`: one page per request, abort on change, previous page kept while loading, error and retry.
- Web UI: `apps/web/src/pages/TransactionsPage.tsx`, `components/SummaryBar.tsx`, `components/TransactionList.tsx`: Ant `Pagination`, `?q=&page=` in the URL, summary from the server, `key={t.id}` instead of the array index.
- Removed `computeTotal` (`apps/web/src/utils/format.ts`) and `format.test.ts`: the file held only `computeTotal` tests, whose cases the API service tests already cover.

## Departures from the plan
- Built the tasks myself in this session instead of starting a subagent per task in group A: they were small and I wanted each test shown failing before its code. Same borders and one commit per task.
- Added a fix commit (`798356f`) for a type error in my own test fixture, found by `tsc` after the task 1 commit.
- Ports 3000 and 4000 were already taken by processes that aren't this session's, so verification ran the web app on 3100 and the API on 4100 through a temporary `vite.verify.config.ts` (deleted, never committed).
- `/simplify` (four review agents: reuse, simplification, efficiency, altitude) removed `useDebouncedValue.ts`, which the plan listed: the search box now starts its own timer from `onChange`, so the `latest` ref and the URL-to-input-to-URL effect loop are gone. The hook file is renamed `useTransactionPage.ts` to match its export.
- A page past the end shown through the URL (`page=99999`) now moves to the last real page. This goes slightly beyond the spec's criterion 5, which only covers the API's response.

## How it was verified
Acceptance criteria (spec numbering). API tests, the `curl` checks and the browser checks were run on 2026-11-19.

- 1-4, 11 (service): `npm test -w @assessment/api`, 31 tests pass (14 service, 17 query). The 7 new service tests were run first and failed with `service.list is not a function` and a missing `listTransactions`; the query and web helper tests failed first on a missing module.
- 1, 5 (route): `curl http://localhost:4100/api/transactions` returned 25 rows, `total` 10000, `totalProcessed` 6488615.4. `?q=%20VISA%20&page=2&pageSize=5` gave total 2503. `page=99999` gave 0 rows and total 10000. `page=0`, `page=abc`, `page=1.5`, `pageSize=101`, `pageSize=-1`, `page=1&page=2` all returned 400 with an `error` message.
- 6: browser: 25 rows, pagination `1 2 3 4 5 ••• 400`, request `GET /api/transactions?page=1&pageSize=25`.
- 7: typing "visa" key by key sent one request (`...&q=visa`). With the "zz" request slowed to 2.5 s and "visa" typed meanwhile, the page ended on the visa results (2,503) and no stale "no match" message.
- 8: one-off script over `transactions.json` with the old filter and total rule against the API, for `visa`, `  AMEX `, `pend`, `blue ridge`, `txn_0001`, `zzzz` and an empty search: counts and totals identical in all seven.
- 9: with the API stopped, going to page 2 showed "Could not load transactions (HTTP 500)" with a Retry button and the previous 25 rows still on screen; after restarting the API, Retry loaded page 2.
- 10: loading `?q=visa&page=3` restored the input text and page 3; `?q=visa&page=99999` moved to `page=101` (3 rows, 2,503 = 100 x 25 + 3); changing the search from page 101 reset to page 1.
- 11 (UI): created "Pagination Check Co" through the form; it appeared first (`txn_010001`) and the count went to 10,001.
- 12: `npm test`: API 31 passed, web 12 passed. `npm run lint`: 0 errors, 2 warnings (both the existing `jsx-a11y` ones in `TransactionList.tsx`). `tsc --noEmit` clean for both apps.

Screenshot of a searched, paged view (`?q=blue ridge&page=2`) is in the session's tool results; it is not committed.

### After /simplify
Re-run because the page's search logic changed (2026-11-19): `npm test` API 31 and web 12 pass, `npm run lint` 0 errors and the same 2 warnings, `tsc --noEmit` clean. In the browser: a trailing space typed on `?q=visa&page=3` stayed in the input and did not change the URL or page; typing "amex" sent one request (`...&q=amex`) and went to page 1; changing the URL from outside (as Back does) updated the input to "blue ridge" and showed 488 matches without writing back to the URL.

### Simplify findings not applied
- API clamping a page past the end (altitude, simplification): it would change criterion 5, which says the API returns an empty page with the true total. The web redirect stays.
- `getAll` kept for the startup log: it existed before this branch, so it is out of scope.
- Skipping the full sort for an empty search, precomputing lowercase text: under 10 ms at 10,000 rows; only worth it around 100k rows.
- `PAGE_SIZE` (web) and `DEFAULT_PAGE_SIZE` (API) both 25, and the two `parsePositiveInt` variants: separate apps with different strictness on purpose; nothing shared to import.

## Not verified
- Debounce, stale-response handling and the error state have no automated test (the user chose pure helpers over adding jsdom). They were checked by hand as above.
- The Back button restoring the search text from the URL was not exercised.
- No production build (`npm run build`) was run.
- The 2,503-match and similar checks use the seed data only; a much larger dataset was not tried.

## With more time
- Add jsdom and Testing Library to test the hook and page behavior automatically.
- Cursor-based pagination if the data moves out of memory, and a search index if the dataset grows.
- Column sorting and status filters.
