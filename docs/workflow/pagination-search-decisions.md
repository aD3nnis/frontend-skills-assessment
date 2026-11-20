# Decisions: pagination and search
Date: 2026-11-19 · [Spec](pagination-search-spec.md) · [Plan](pagination-search-plan.md)

Branch: worktree-pagination-search
Type: Feature
Phase: Ship

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
- API app: `apps/api/src/app.ts` (new), `apps/api/src/index.ts`: the routes moved unchanged into `createApp(service)` so the route can be tested; `index.ts` keeps only start-up and `listen`. `apps/api/src/app.test.ts` tests the route on a throwaway port.
- Removed `computeTotal` (`apps/web/src/utils/format.ts`) and `format.test.ts`: the file held only `computeTotal` tests, whose cases the API service tests already cover.

## Departures from the plan
- Built the tasks myself in this session instead of starting a subagent per task in group A: they were small and I wanted each test shown failing before its code. Same borders and one commit per task.
- Added a fix commit (`798356f`) for a type error in my own test fixture, found by `tsc` after the task 1 commit.
- Ports 3000 and 4000 were already taken by processes that aren't this session's, so verification ran the web app on 3100 and the API on 4100 through a temporary `vite.verify.config.ts` (deleted, never committed).
- `/simplify` (four review agents: reuse, simplification, efficiency, altitude) removed `useDebouncedValue.ts`, which the plan listed: the search box now starts its own timer from `onChange`, so the `latest` ref and the URL-to-input-to-URL effect loop are gone. The hook file is renamed `useTransactionPage.ts` to match its export.
- Added after the walkthrough: the `app.ts` split and `app.test.ts` (criterion 5's 400 had no test), and a fix to the search timer in `TransactionsPage.tsx` (see "Second opinion").
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

### Break-it checks
| Criterion | Line broken | Test that failed |
|---|---|---|
| 2: total covers every match | `totalProcessed: sumProcessedAmount(matches)` limited to the page slice (`transaction-service.ts:64`) | "returns one page and the match count and approved total for every match" (got 10, expected 90); "covers the whole shipped dataset across pages and agrees with getSummary" (got 11343.59, expected 6488615.4) |
| 3: search covers all four fields | `t.status` removed from the field list (`transaction-service.ts:45`) | "matches merchantName, id, cardBrand and status, case-insensitively and trimmed" (`pend` returned `[]`) |
| 4: no repeated or skipped rows | `"id"` tie-break removed from `_.orderBy` (`transaction-service.ts:55`) | "orders newest first and breaks timestamp ties by id so pages never repeat or skip a row" |
| 5: bad input gets a 400 | the `if (!parsed.ok)` branch deleted (first in `index.ts`, then `app.ts`) | first run: **none failed** (the route had no test), so `app.test.ts` was added; second run: 8 tests failed with `expected 500 to be 400` |
| 11: new row appears first | `unshift` changed to `push` | **none failed**: array position doesn't affect display order |
| 11 (the line that matters) | sort `"desc"` changed to `"asc"` | "puts a newly created transaction first" (got `txn_000153`, expected `txn_010001`); the tie-break test |

Every break was restored, and the diff showed no leftover change each time. Criteria 1, 6 to 10 and 12 were not broken line by line: they rest on the manual checks above and the existing tests.

### Second opinion
- Search timer undoing a page click (`TransactionsPage.tsx`): reproduced in the browser. Typing a space on `?q=visa&page=3` then clicking page 4 within 300 ms sent the URL back to page 3, because react-router's `setSearchParams(fn)` gives `fn` the URL from the render it was created in (`node_modules/react-router-dom/dist/index.js:1031`). Fixed by reading `window.location.search` in the timer (the app uses `BrowserRouter`, `main.tsx:13`) and correcting the comments that overclaimed. Rechecked on the running app: a space then a page click stays on page 4; a real change still resets to page 1; typed text then a page click leaves the box and the URL agreeing.
- Route 400 had no test: fixed by the `app.ts` split and `app.test.ts` (42 API tests now pass).
- Not fixed, per "fix what's necessary, nothing out of scope": a padded URL (`?q=%20visa%20`) keeps its spaces in the input and address bar while the API trims, so results are right (cosmetic); `unshift` in `create` no longer affects ordering (harmless); no length cap on `q`.

### Reviewer subagent (against the spec, 2026-11-19)
Ran `npm test` (API 42, web 12), lint (0 errors, same 2 warnings) and `tsc` (clean) on its own. Criteria 1, 2, 3, 4, 5, 11 and 12 met with named tests; 10 met for parsing, by hand for reload and paste; 6, 7, 8 and 9 partly met because they rest on manual checks. It did not run the app.
- Criterion 8: the reviewer found no recorded comparison. The comparison was run (seven terms, identical counts and totals, under "How it was verified"), but its script lived in a scratch folder and is not in the repo.
- Fixed: after a failed request the old list and totals stayed on screen looking current under the new search text. They are now dimmed (`results-stale`, opacity 0.45) while the error banner shows, and the dimming clears when a request succeeds. Checked in the browser by making one search fail: dimmed with the banner and "Retry", then cleared by a working search. This goes a little beyond criterion 9 as written, which only asks for an error with Retry; the user chose to fix it because it was small.
- Not fixed, for the PR's known gaps: no automated tests for debounce, stale responses or the error state (criteria 7 and 9; the user chose not to add jsdom); the page-past-the-end redirect, the empty-state message, `key={t.id}`, the `app.ts` split, the `computeTotal` removal and the removed query `console.log` are beyond the spec's literal text and are listed here; no length cap on `q`; `PAGE_SIZE` is 25 in the web and the API default separately; `createTransaction` does not check the response status (existed before this branch); an empty `?page=` falls back to the default instead of a 400, by design.

### Code review (`/code-review medium main`, 2026-11-19, round 1)
7 findings, none blocking.
1. Fixed (`1ee45bf`): the `[q]` sync effect also ran for the page's own URL write, so a key typed between the write and React's commit was overwritten and its pending search cancelled. Reproduced first in the browser by injecting "ab" inside the router's `history.replaceState` call (the box reverted to "a", URL stayed `?q=a`). The page now records the text it wrote (`ownWriteQ`) and the effect skips that echo; after the fix the same injection leaves the box on "ab" and the URL on `?q=ab`. An outside URL change still updates the box, and a later outside change back to the same text still syncs (flag cleared once seen). Tests (42 API, 12 web), lint (same 2 warnings) and types unchanged. No automated test: it needs the DOM tooling that was left out.
2. Skipped: the past-the-end redirect guard compares only `data.page` with the URL's page, not the search. Not reachable from the app's own controls today because typing resets to page 1.
3. Skipped: the search timer reads `window.location.search`, which assumes a browser-history router (`BrowserRouter`, `main.tsx:13`). Revisit if the router type changes.
4. Skipped: no automated tests for debounce, stale responses or the error state (criteria 7 and 9); the user chose pure helpers over adding jsdom.
5. Skipped: a padded `?q=%20visa%20` stays untrimmed in the box and address bar; results are right because the API trims. Cosmetic.
6. Skipped: each list request filters, sorts and sums all matches (a few ms at 10,000 rows); worth revisiting around 100k rows.
7. Skipped: page size 25 is defined in the web and as the API default.

## Reviewed by hand
Walkthrough depth chosen: the riskiest few.
- `apps/api/src/services/transaction-service.ts`: user said `total` is the number of matches and does not change with the page, and `totalProcessed` covers all matches and is wider than the page. Corrected: page 3 is rows 51 to 75 (the next 25), not everything left over; confirmed on real data (pages 3 and 4 each 25 rows, page 5 none).
- `apps/api/src/utils/list-query.ts`: user said a malformed page should error, not be guessed, because guessing would show false information. Confirmed; added that the web side is lenient on purpose and the API strict.
- `apps/web/src/pages/TransactionsPage.tsx`: user said the debounce stops it sending another request. Correct for the debounce; the question was about Back and the pending timer, which found the stale-URL bug above.
- `apps/web/src/hooks/useTransactionPage.ts`: user said it would still show the old search's results. Correct for a stale answer; added that without the abort guards the aborted request also sets a spurious error.
- `apps/web/src/utils/list-params.ts`: user said the spaces would be parsed out. Corrected: the web code keeps them, and the API trims them.
- Read by Claude only: `apps/api/src/index.ts`, `apps/api/src/app.ts`, `apps/api/src/utils/list-query.test.ts`, `apps/api/src/services/transaction-service.test.ts`, `apps/api/src/app.test.ts`, `apps/web/src/App.css`, `components/SummaryBar.tsx`, `components/TransactionList.tsx`, `models/transaction.ts`, `services/transaction-service.ts`, `utils/format.ts`, `utils/list-params.test.ts`.

## Map
- Updated by `/map` on 2026-11-19 at `1c7aec5`. Facts that moved: the list route and its response (query params, 400s, page plus totals), where filtering, paging and totals happen (API, not the browser), the routes' location (`app.ts`, with `index.ts` only starting the server), the fetch hook's name and behavior, the URL-held search state, tests (42 API, 12 web, none before), and the "Total processed" rule (server only). It also corrected facts that moved on `main` before this branch (`400e561`, `f903594`): the hard-coded secrets are gone and `NOTES.md` is tracked. The Structurizr model was revalidated (exit 0) and compared with the tables.
- `docs/workflow/map.md` and `map/` are git-excluded in this repo (`.git/info/exclude`), so they are not part of the PR; the header here has no link to the map for that reason.

## Not verified
- Debounce, stale-response handling and the error state have no automated test (the user chose pure helpers over adding jsdom). They were checked by hand as above.
- The Back button restoring the search text from the URL was not exercised.
- No production build (`npm run build`) was run.
- The 2,503-match and similar checks use the seed data only; a much larger dataset was not tried.

## With more time
- Page-size selector (10 / 25 / 50 / 100) and "1–25 of N" range text on the pager: raised by the user while checking the UI, deferred on their say-so. It needs `pageSize` in the URL (`?pageSize=`), `showSizeChanger` and `showTotal` on Ant's `Pagination`, and a spec update (criterion 10 covers only `q` and `page`). The API already accepts up to 100. A pager at the top of the list or fixed to the bottom of the window would also save scrolling.
- Add jsdom and Testing Library to test the hook and page behavior automatically.
- Cursor-based pagination if the data moves out of memory, and a search index if the dataset grows.
- Column sorting and status filters.
