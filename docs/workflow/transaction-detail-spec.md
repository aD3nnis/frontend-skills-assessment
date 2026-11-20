# Spec: transaction detail
Date: 2026-11-19 · Starting state: existing project

## Task
`INSTRUCTIONS.md` Task 4: "Add a dedicated page that shows the full details of a single transaction (for example at `/transactions/:id`). Routing is already set up with react-router, and the API already exposes `GET /api/transactions/:id`. Wire up navigation to it from wherever makes sense, and handle the states you'd expect a real page to handle."

## In my own words
Clicking a transaction in the list takes the user to its own page at `/transactions/:id`, which loads that one transaction from the API and shows all its fields. The page also behaves sensibly while loading, when the transaction doesn't exist, and when the request fails, and it can be opened directly from a URL or reloaded.

## Where
- Routes: `apps/web/src/App.tsx:21-24` has `/` and `/transactions/new`; nothing for `/transactions/:id`. `BrowserRouter` is in `apps/web/src/main.tsx:13`.
- List rows: `apps/web/src/components/TransactionList.tsx:25-26`, a `div` with `onClick={() => onSelect(t)}` and `key={i}` (index key).
- Current "details" UI: `apps/web/src/components/TransactionModal.tsx:12-50`, an antd `Modal` with a `Descriptions` of merchant, card brand, amount, surcharge (with rate), total, status, date. It is opened from `apps/web/src/pages/TransactionsPage.tsx:14,52,54` (`selected` state).
- Web data layer: `apps/web/src/services/transaction-service.ts:5-24` has `fetchTransactions` and `createTransaction`; no fetch-by-id.
- API route: `apps/api/src/index.ts:35-41`, `GET /api/transactions/:id`, returns the transaction, or `404 {"error":"Transaction not found"}`. Service: `apps/api/src/services/transaction-service.ts:35` (`getById`, a linear `find`).
- Dev proxy: `apps/web/vite.config.ts:8-10` sends `/api` to `localhost:4000`.
- Shared helpers: `formatCurrency` and `formatDate` (`apps/web/src/utils/format.ts`), `statusTagColor` (`apps/web/src/utils/status.ts:3-14`).
- Page style to follow: `apps/web/src/pages/NewTransactionPage.tsx` (antd, page component under `pages/`); loading spinner pattern in `TransactionsPage.tsx:28-34` (`app-loading` + antd `Spin`).

## How it works today
- Clicking a list row opens the modal; the URL does not change, so a transaction can't be linked to, bookmarked or reloaded (`TransactionsPage.tsx:14,52`).
- The modal shows the already-loaded row; it makes no request and has no loading or error state (`TransactionModal.tsx:24-47`).
- The rows are not keyboard-reachable. ESLint reports 2 warnings on `TransactionList.tsx:26` (`click-events-have-key-events`, `no-static-element-interactions`); `npm run lint` shows 0 errors, 2 warnings.
- `GET /api/transactions/:id` already works on the server (`index.ts:35-41`); nothing in the web calls it (searched `apps/web/src` for `transactions/`: only the list and create calls in `transaction-service.ts`).
- The web service never checks `rsp.ok` (`transaction-service.ts:6-8`): a 404 body `{"error":...}` would be parsed as if it were a transaction.
- `statusTagColor` has no default branch (`status.ts:3-14`), so a status outside the four enum values returns `undefined`. The data has one such row: `txn_000681` has status `VOIDED` (`apps/api/src/data/transactions.json:76`).
- The 10,000 ids in the data are all distinct (checked: no duplicate `"id"` values).
- `npm test` passes (API 7, web 4) and `npm run lint` has 0 errors, run in this worktree on 2026-11-19 after the Task 2 fix merged.

## Known, assumed, unknown
- **Known:** everything above, each from the file and line shown.
- **Assumed:** the page fetches the single transaction from `GET /api/transactions/:id` (as the task suggests) rather than reading it from list state, so a direct URL or reload works. If wrong, the page would depend on the list being loaded first.
- **Decided (2026-11-19, with the user):** clicking a row **replaces** the modal with navigation to the page, so there is one place to see details; the modal and its `selected` state are removed. The opening lag the user saw comes from re-rendering all 10,000 list rows on click (`TransactionsPage.tsx:14,19-26,52`, rows unmemoized with `key={i}` at `TransactionList.tsx:26`), not from the modal. The page avoids that cost on open; the list's own slowness is Task 1's (pagination) and is not changed here. Not measured by Claude: this is from reading the code. The user tested Task 1's branch and reports it fixes the loading problem (told by the user 2026-11-19; not checked here), which fits the code reading.
- **Assumed:** rows become real links (an anchor or react-router `Link`, reachable by keyboard), which also clears the 2 lint warnings. Whole-row click still works.
- **Assumed:** the page shows what the modal shows plus the id and surcharge rate, in the same antd `Descriptions` style. No new fields exist in the API response.
- **Assumed:** Task 1 (pagination and search, a separate session) will change `TransactionsPage.tsx` and possibly `TransactionList.tsx`. This task keeps its edits to those two files small so the later rebase is easy. Not checked: I haven't read that session's changes.
- **Unknown:** none that block the work.

## Acceptance criteria
Time-boxed to one evening (decided with the user). The web app has vitest but no testing-library, jsdom or vitest config (`apps/web/package.json`), so no component tests: logic that can be tested without a DOM gets a unit test next to the code, and the page's states are checked by hand in the browser and recorded in the decisions file. Criteria 1-5 and 8 below are therefore "Check: browser", with the unit-testable part named where there is one.

1. Visiting `/transactions/<id>` for an existing id shows that transaction's id, merchant, card brand, amount, surcharge with rate, total, status and date, formatted with `formatCurrency` and `formatDate`. · Check: a test of the page with a mocked fetch, plus opening `/transactions/txn_000001` against `npm run dev` and comparing it with the API's `curl localhost:4000/api/transactions/txn_000001`.
2. While the request is pending the page shows a loading indicator, not an empty or half-filled page. · Check: test with a never-resolving fetch; browser check with network throttling.
3. An id that doesn't exist (API returns 404) shows a clear "transaction not found" state with a way back to the list; it does not show a blank page or a crash. · Check: test with a 404 response; browser check at `/transactions/nope`.
4. A failed request (network error or 5xx) shows an error state with a retry control, distinct from not-found. · Check: tests for a rejected fetch and a 500 response; manual check by stopping the API.
5. A status the enum doesn't know (`txn_000681`, `VOIDED`) still renders: the status text is shown and the page doesn't crash. · Check: test with a `VOIDED` fixture; browser check at `/transactions/txn_000681`.
6. Clicking a row in the list navigates to `/transactions/<id>`, and the same navigation works from the keyboard (focus a row, press Enter). The 2 ESLint warnings on `TransactionList.tsx` are gone. · Check: browser check; `npm run lint` shows 0 warnings for that file.
7. Opening `/transactions/<id>` directly and reloading the page works; browser back returns to the list. · Check: browser check (open the URL in a new tab, reload, press back).
8. Changing from one id to another (navigating between detail URLs) doesn't show the previous transaction's data under the new id, and a slow earlier response doesn't overwrite a later one. · Check: test that changes the `id` param while the first request is pending.
9. An id with unusual characters (spaces, `/`, `%`) is encoded when building the request URL and ends in the not-found state, not a crash. · Check: unit test of the service function with such an id; browser check.
10. The web service checks `rsp.ok` for the new fetch-by-id call and does not treat an error body as a transaction. Existing `fetchTransactions` and `createTransaction` behavior is unchanged (Task 3 owns the form). · Check: unit test; `git diff` shows no edits to those two functions.
11. `npm test`, `npm run lint` and `npm run build` pass, and the new tests are in files next to the code they test. · Check: run each command and read the exit codes.
12. `NOTES.md` has a Task 4 section: what was built, the states handled, the modal decision, and anything left. · Check: read the file.

## Blast radius
Searched `apps/web/src` and `apps/api/src` for `onSelect`, `TransactionModal`, `getById` and `transactions/:id`:
- `TransactionModal` is used only by `TransactionsPage.tsx:7,54`. `onSelect` is used only by `TransactionList.tsx:9,12,26` and `TransactionsPage.tsx:52`. Removing the modal affects only the list page; if the navigation breaks, users can no longer see any transaction's details.
- `getById` and `GET /api/transactions/:id` are used only by `index.ts:36` and defined at `transaction-service.ts:35`. No web code calls them today, so this task is its first consumer and doesn't change the server.
- `App.tsx` routes: adding `/transactions/:id` next to `/transactions/new`. React Router ranks the static path `new` above `:id`, so `/transactions/new` should keep working; criterion 1's tests include the form route as a regression check.
- Task 1 (separate session, main folder) will likely edit `TransactionsPage.tsx` and `TransactionList.tsx`; whichever branch merges second needs a rebase. Task 3 will edit `NewTransactionPage.tsx` and `POST /api/transactions`, which this task doesn't touch, except that a created transaction (`txn_<n>`, `transaction-service.ts:45`) is reachable at its detail URL after creation.
- I did not search outside this repo.

## Out of scope
- Server-side changes: the existing `GET /api/transactions/:id` is used as it is (including its `find` over the array, which is fine at 10,000 rows).
- Pagination, search and server totals (Task 1); the New Transaction form and money input handling (Task 3).
- Editing, refunding or deleting a transaction from the page.
- Adding `VOIDED` to the status enums or cleaning the data row (same call as the Task 2 spec).
- Component tests and browser-automation tests: no testing-library, jsdom or Playwright setup in this repo, and adding it is not tonight's work. Listed in `NOTES.md` under "more time".
- Optimizing the list's rendering (memoizing rows): Task 1's area, and it would conflict with that session's edits. Amended 2026-11-19 after the reviewer subagent's finding: the row's `key` was changed from `key={i}` to `key={t.id}` anyway, because that same line was being rewritten into a `Link`; the user chose to keep it. Nothing else about list rendering changed.
