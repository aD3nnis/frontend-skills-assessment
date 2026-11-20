# Notes

## What I changed and why

## Task 2 bug

## Task 5 improvements

## Q1 Data flow

## Q2 Task 1 call

## Q3 Ship/no-ship

## What I'd do with more time

## Task 4: transaction detail page

**What I built**
- `/transactions/:id` loads one transaction from the existing `GET /api/transactions/:id`, so a link or a reload works. It shows loading, not-found (404) and error states; the error state has a retry. It also renders the one `VOIDED` row in the data, whose status isn't in the enum.
- List rows are now real links, so they work with the keyboard and open in a new tab. That cleared the 2 `jsx-a11y` lint warnings (lint is now 0 warnings).
- I replaced the click-to-open modal with this page and deleted the modal: one place to see details, a shareable URL, a working back button, and it matches the routed `/transactions/new` page.
- `fetchTransactionById` throws `TransactionNotFoundError` on a 404 and a plain `Error` otherwise, so the page can tell "doesn't exist" from "couldn't load". It checks `rsp.ok` (the older service functions don't) and URL-encodes the id.
- The hook remembers which id each result belongs to and ignores a stale response, so switching quickly between ids never shows the wrong transaction.

**Why the modal felt slow.** Clicking a row set page state, which re-filtered and re-rendered all 10,000 rows (rows aren't memoized and use `key={i}`). The page avoids that cost on open. Going back to the list still refetches and renders everything on this branch; pagination (Task 1) removes the cause, and the Task 1 author reports it fixed the loading problem on their branch. I did not profile it myself.

**How I checked it.** Service unit tests (written first and seen failing): ok, 404, 500, network failure, and an id with `/`, space and `%`. The rest I checked by hand in a browser: all fields match the API, loading spinner, `nope` and `a/b` show not-found, `txn_000681` (`VOIDED`) renders, click and Enter on a row navigate, back and direct URL work, stopping the API shows the error state and retry recovers, and a slow first request can't overwrite a later one. `npm test`, `npm run lint` and both builds pass.

**Not done**
- No component tests: `apps/web` has vitest but no testing-library or jsdom, and I didn't add tooling in an evening.
- `fetchTransactions` and `createTransaction` still don't check `rsp.ok`; they belong to Tasks 1 and 3.
- `VOIDED` isn't in `TransactionStatus`; the page degrades gracefully, but the enum or the data should be fixed.
- I did not memoize list rows or fix `key={i}`; that overlaps Task 1.
