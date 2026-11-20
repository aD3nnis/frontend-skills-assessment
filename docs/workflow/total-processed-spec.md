# Spec: total processed
Date: 2026-11-19 · Starting state: existing project

## Task
`INSTRUCTIONS.md` Task 2: "The 'Total processed' figure in the summary bar is wrong. Track down why and fix it. Write a short note on the bug and how you fixed it."

## In my own words
The summary bar adds up every transaction, including declined, pending, refunded and unknown-status ones, so it reports far more money than was actually processed. After the fix it counts only approved transactions, and shows the same figure the API's summary reports.

## Where
- Summary bar: `apps/web/src/components/SummaryBar.tsx:11` calls `computeTotal`; `:16` shows it as "Total processed".
- Web sum: `apps/web/src/utils/format.ts:11-17` (`computeTotal`).
- Search filter feeding the bar: `apps/web/src/pages/TransactionsPage.tsx:19-26` (filter), `:50` (`<SummaryBar transactions={filtered} />`).
- API sum: `apps/api/src/services/transaction-service.ts:28` (`totalVolume`, inside `getSummary`), served at `apps/api/src/index.ts:25`.
- Status enums: `apps/web/src/models/transaction.ts:9-14` and `apps/api/src/models/transaction.ts` (APPROVED, DECLINED, REFUNDED, PENDING).
- Data: `apps/api/src/data/transactions.json` (10,000 rows).

## How it works today
- `computeTotal` adds `t.amount` for every transaction with float `+=`, and never looks at `status` (`format.ts:12-15`).
- `getSummary().totalVolume` does the same on the server: `_.sumBy(transactions, "amount")` over all rows (`transaction-service.ts:28`).
- The bar sums the search-filtered list, so typing in the search box changes the total (`TransactionsPage.tsx:50`).
- Figures from the dataset (computed from the JSON): all rows 25,438,084.33; APPROVED only 6,299,522.49 by `amount`, 6,488,615.40 by `total` (amount + surcharge, the figure this task uses).
- Statuses in the data: APPROVED, PENDING, REFUNDED, DECLINED, plus one row (`txn_000681`) with `VOIDED`, which is not in either enum.
- Neither workspace has a test file yet, so `npm test` currently fails ("No test files found"). Both workspaces already have `"test": "vitest run"` and vitest installed.
- There is no `NOTES.md` yet and no `docs/workflow/map.md`.

## Known, assumed, unknown
- **Known:** the bug and both copies of it (above, with `file:line`). The dataset sums were computed from the JSON file. The one `VOIDED` row exists (`grep -c VOIDED` on the JSON returns 1).
- **Assumed:** "processed" means APPROVED only; no spec or doc in the repo defines it, so this is a judgment, recorded in `docs/workflow/total-processed-decisions.md`. If wrong (e.g. refunds should count), only the allowlist changes.
- **Assumed:** `total` (= `amount + surcharge`, what was charged to cards) is the figure to sum, not `amount` alone ($6,299,522.49). It matches what a payment processor statement shows. The alternative is a one-word change; chosen with the user after discussing the client view.
- **Assumed:** the total should keep following the search filter, since the "Transactions" count beside it does.
- **Unknown:** none that block the work. Whether Task 1 will make the web read the server summary is not decided; if it does, the web copy of the rule can go away.
- No `docs/workflow/map.md` exists. I did not run `/map`; "Where" above comes from reading and searching the code directly.

## Acceptance criteria
1. The API summary's `totalVolume` equals the sum of `total` over APPROVED transactions only: 6,488,615.40 on the shipped data. · Check: API vitest test calling the service's `getSummary()` and asserting this figure, plus `curl localhost:<api-port>/api/transactions/summary`.
2. Non-approved transactions (DECLINED, PENDING, REFUNDED) and the unknown `VOIDED` status are excluded. · Check: unit tests with a small hand-made list containing one of each status, and the `VOIDED` row, asserting only the APPROVED row's total is counted.
3. A status that is not APPROVED, including one the code has never seen, is excluded by default (allowlist, not a denylist). · Check: unit test with an invented status string.
4. Sums are done in integer cents, so values like 0.1 + 0.2 produce 0.30 and the full dataset gives exactly 6488615.40, not a float-drift value. · Check: unit test with amounts that drift under plain float addition.
5. The web's `computeTotal` follows the same rule and returns the same numbers as the API for the same input. · Check: web vitest test with the same hand-made list as criterion 2; plus a mirror comment in `format.ts` pointing at the API rule.
6. An empty list, or a list with no APPROVED rows, gives 0 and does not throw. · Check: unit tests in both workspaces.
7. In the running app, with no search text, "Total processed" shows $6,488,615.40 (not $25,438,084.33). · Check: `npm run dev`, open the dashboard in the browser, read the bar.
8. In the running app, typing in the search box still changes the total and the "Transactions" count together (e.g. searching `declined` shows $0.00; searching a single merchant shows only that merchant's approved totals). · Check: browser check against `npm run dev`.
9. Nothing else changed: `TransactionStatus` enums, `totalSurcharge`, the search filter, API endpoints and `package.json` scripts are untouched. · Check: `git diff --stat` shows only the files the plan lists.
10. `npm test`, `npm run lint`, `npm run build` and `npm run build -w @assessment/api` all pass. `npm test` runs at least one test file in each workspace and is not made to pass with `--passWithNoTests`. · Check: run each command and read the exit code.
11. `NOTES.md` has a Task 2 section: the bug in a sentence, the cause, the fix, and the decisions (APPROVED only, `total`, cents, the `VOIDED` row). · Check: read the file.

## Blast radius
Searched `apps/*/src` for `computeTotal`, `SummaryBar`, `getSummary`, `totalVolume` and `/summary`:
- `computeTotal` is used only by `SummaryBar.tsx:11`. The bar is rendered only by `TransactionsPage.tsx:50`. If it breaks, the dashboard's headline figure is wrong or the page crashes.
- `getSummary` / `totalVolume` is used only by the route at `apps/api/src/index.ts:25-26`. The web does not call that route today (no match in `apps/web/src`), so changing `totalVolume` changes the API's output but not the UI. Any outside consumer of `/api/transactions/summary` would see a smaller number; none found in this repo.
- `TransactionStatus` is used in the API's `create` (`transaction-service.ts:41`) for new transactions, which are APPROVED, so a newly created transaction counts toward the total.
- I did not search outside this repo.

## Out of scope
- Adding `VOIDED` to the `TransactionStatus` enum or cleaning the data row: the allowlist keeps it out of the total without touching either.
- `totalSurcharge`, the search filter logic, API endpoints, `package.json` scripts.
- Making the web read the server summary (Task 1 territory); this task keeps two mirrored copies of the rule.
- jsdom / testing-library component tests: the UI is checked in the browser instead.
